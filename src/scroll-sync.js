/**
 * ScrollSync - Bidirectional Scroll Synchronization for Isometric 3D Navigation
 * 
 * Synchronizes scroll position with 3D navigation state:
 * - When user scrolls through content sections, the 3D view updates to match
 * - When user navigates the 3D view, the page scrolls to the corresponding section
 * 
 * @class ScrollSync
 * @param {Object} controller - The isometric 3D controller instance
 * @param {Object} options - Configuration options
 * @param {number} options.stickyThreshold - Top offset where sections become "active" (default: 320)
 * @param {number} options.scrollDuration - Scroll animation duration in ms (default: 1800)
 * @param {number} options.debounceDelay - Debounce delay for navigation updates in ms (default: 100)
 * @param {string} options.sectionSelector - CSS selector for content sections (default: '.description-section')
 * @param {string} options.dataSectionAttribute - Attribute name for linking 3D elements to sections (default: 'data-section')
 */
class ScrollSync {
    constructor(controller, options = {}) {
        this.controller = controller;
        this.options = {
            stickyThreshold: 320,
            scrollDuration: 1800,
            debounceDelay: 100,
            sectionSelector: '.description-section',
            dataSectionAttribute: 'data-section',
            ...options
        };
        
        this.programmaticScroll = false;
        this.lastScrollY = window.scrollY;
        this.scrollAnimationFrame = null;
        this.navigationDebounceTimer = null;
        this.currentNavigationTarget = null;
        
        this.setupBidirectionalSync();
    }

    /**
     * Sets up bidirectional synchronization between 3D navigation and page scrolling
     * @private
     */
    setupBidirectionalSync() {
        // 1. Navigation → Scroll: When 3D navigation changes, scroll to description
        this.controller.on('navigationChange', (data) => {
            const sectionId = data.element.getAttribute(this.options.dataSectionAttribute);
            if (sectionId && !this.programmaticScroll) {
                this.scrollToSection(sectionId);
            }
        });

        // 2. Scroll → Navigation: When scrolling, detect which section is in focus
        this.setupScrollDetection();
    }

    /**
     * Sets up IntersectionObserver to detect which content section is currently visible
     * @private
     */
    setupScrollDetection() {
        const sections = document.querySelectorAll(this.options.sectionSelector);

        // Build a map from section IDs to their corresponding 3D elements
        // Support multiple elements with the same data-section
        const sectionToNavElements = {};
        sections.forEach(section => {
            const sectionId = section.id;
            const navElements = document.querySelectorAll(
                `[${this.options.dataSectionAttribute}="${sectionId}"]`
            );
            if (navElements.length > 0) {
                sectionToNavElements[sectionId] = Array.from(navElements);
            }
        });

        // Detect manual user scroll to cancel programmatic scrolling
        const detectUserScroll = () => {
            if (this.programmaticScroll) {
                // User is manually scrolling during programmatic scroll - cancel it
                if (this.scrollAnimationFrame) {
                    cancelAnimationFrame(this.scrollAnimationFrame);
                    this.scrollAnimationFrame = null;
                }
                this.programmaticScroll = false;
            }
        };

        // Listen for wheel and touch events to detect manual scrolling
        window.addEventListener('wheel', detectUserScroll, { passive: true });
        window.addEventListener('touchmove', detectUserScroll, { passive: true });

        // Store intersection state for debounced processing
        const intersectionState = new Map();

        // Use IntersectionObserver with the sticky threshold as the trigger point
        const observer = new IntersectionObserver((entries) => {
            if (this.programmaticScroll) return;

            const currentScrollY = window.scrollY;
            this.lastScrollY = currentScrollY;

            // Update intersection state for all entries
            entries.forEach(entry => {
                intersectionState.set(entry.target.id, {
                    isIntersecting: entry.isIntersecting,
                    intersectionRatio: entry.intersectionRatio
                });
            });

            // Debounce navigation to prevent flickering during fast scrolling
            if (this.navigationDebounceTimer) {
                clearTimeout(this.navigationDebounceTimer);
            }

            this.navigationDebounceTimer = setTimeout(() => {
                // Process current intersection state
                const sortedEntries = Array.from(intersectionState.entries())
                    .filter(([id, state]) => state.isIntersecting)
                    .sort((a, b) => b[1].intersectionRatio - a[1].intersectionRatio);

                // Use the most visible section
                if (sortedEntries.length > 0) {
                    const [sectionId, state] = sortedEntries[0];
                    const navElements = sectionToNavElements[sectionId];
                    
                    if (navElements && navElements.length > 0 && sectionId) {
                        // Only update if the target section has changed
                        if (this.currentNavigationTarget !== sectionId) {
                            this.currentNavigationTarget = sectionId;
                            
                            // Trigger click on the first navigation element to handle everything consistently
                            // (navigation, highlighting, URL update with hash)
                            // All elements with the same data-section will be highlighted together
                            navElements[0].click();
                        }
                    }
                } else {
                    // No sections are intersecting - reset to default view
                    if (this.currentNavigationTarget !== null) {
                        this.currentNavigationTarget = null;
                        
                        // Clear URL (remove hash)
                        const baseUrl = window.location.pathname;
                        window.history.replaceState({}, '', baseUrl);
                        
                        this.controller.resetToDefault();
                        this.controller.clearHighlights();
                    }
                }
            }, this.options.debounceDelay);
        }, {
            // Trigger when section crosses the sticky threshold
            rootMargin: `-${this.options.stickyThreshold}px 0px -50% 0px`,
            threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        });

        sections.forEach(section => observer.observe(section));
    }

    /**
     * Checks if an element is visible in the viewport
     * @param {HTMLElement} element - The element to check
     * @param {number} marginTop - Top margin to consider (e.g., for sticky headers)
     * @returns {boolean} True if the element's top portion is visible
     * @private
     */
    isElementVisible(element, marginTop = 0) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        
        // Check if the top portion of the element is visible
        // Element is considered visible if its top is below the margin and above the bottom of viewport
        return rect.top >= marginTop && rect.top < viewportHeight;
    }

    /**
     * Smoothly scrolls to a specific content section
     * Only scrolls if the isometric container or target section is not already visible
     * @param {string} sectionId - The ID of the section to scroll to
     * @public
     */
    scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        // Check if both the isometric container and the section are already visible
        const isometricContainer = this.controller.container;
        const isContainerVisible = this.isElementVisible(isometricContainer, 0);
        const isSectionVisible = this.isElementVisible(section, this.options.stickyThreshold);
        
        // If both are visible, no need to scroll
        if (isContainerVisible && isSectionVisible) {
            // Just mark as programmatic to prevent scroll detection interference
            this.programmaticScroll = true;
            setTimeout(() => {
                this.programmaticScroll = false;
            }, 100);
            return;
        }

        // Cancel any in-progress scroll animation
        if (this.scrollAnimationFrame) {
            cancelAnimationFrame(this.scrollAnimationFrame);
        }

        this.programmaticScroll = true;

        // Custom smooth scroll with configurable duration
        const targetPosition = section.offsetTop;
        const startPosition = window.scrollY;
        const distance = targetPosition - startPosition;
        const duration = this.options.scrollDuration;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Use easeInOutQuad for smooth scrolling
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            window.scrollTo(0, startPosition + distance * eased);

            if (progress < 1) {
                this.scrollAnimationFrame = requestAnimationFrame(animate);
            } else {
                // Reset flag after scroll completes
                this.programmaticScroll = false;
                this.scrollAnimationFrame = null;
            }
        };

        this.scrollAnimationFrame = requestAnimationFrame(animate);
    }

    /**
     * Destroys the ScrollSync instance and cleans up event listeners
     * @public
     */
    destroy() {
        if (this.scrollAnimationFrame) {
            cancelAnimationFrame(this.scrollAnimationFrame);
        }
        if (this.navigationDebounceTimer) {
            clearTimeout(this.navigationDebounceTimer);
        }
    }
}
