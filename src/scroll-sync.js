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
 * @param {number|string} options.stickyThreshold - Top offset where sections become "active". 'auto' (default) = measured from .isometric-wrapper (top + offsetHeight) at runtime. Override with a numeric px value if needed.
 * @param {number} options.stickyGap - Gap in px between the sticky wrapper bottom and the section h2 (default: 10)
 * @param {number} options.scrollDuration - Scroll animation duration in ms (default: 1800)
 * @param {number} options.debounceDelay - Debounce delay for navigation updates in ms (default: 100)
 * @param {string} options.sectionSelector - CSS selector for content sections (default: '.description-section')
 * @param {string} options.dataSectionAttribute - Attribute name for linking 3D elements to sections (default: 'data-section')
 */
class ScrollSync {
    constructor(controller, options = {}) {
        this.controller = controller;
        this.options = {
            stickyThreshold: 'auto',
            stickyGap: 10,
            scrollDuration: 1800,
            debounceDelay: 100,
            sectionSelector: '.description-section',
            dataSectionAttribute: 'data-section',
            ...options
        };
        
        this.programmaticScroll = false;
        this.scrollTriggeredNavigation = false; // Prevents scroll→nav→scroll feedback loop
        this.lastScrollY = window.scrollY;
        this.scrollAnimationFrame = null;
        this.navigationDebounceTimer = null;
        this.currentNavigationTarget = null;

        // Auto-compute stickyThreshold from the rendered sticky block
        if (this.options.stickyThreshold === 'auto') {
            this.computeStickyThreshold();
        }
        // Inject derived CSS values into description sections
        this.applyStickyThresholdCSS();
        
        this.setupBidirectionalSync();
    }

    /**
     * Auto-computes stickyThreshold from the rendered .isometric-wrapper.
     * Measures: wrapper's CSS `top` + wrapper's offsetHeight.
     * Falls back to 320 if no wrapper is found.
     * @private
     */
    computeStickyThreshold() {
        const container = this.controller.container;
        // Look for .isometric-wrapper ancestor (holds header + viewport as one sticky unit)
        const wrapper = container.closest('.isometric-wrapper');
        if (wrapper) {
            const style = getComputedStyle(wrapper);
            const top = parseInt(style.top) || 0;
            const height = wrapper.offsetHeight;
            this.options.stickyThreshold = top + height;
        } else {
            // Legacy layout: container is directly sticky
            const style = getComputedStyle(container);
            const top = parseInt(style.top) || 0;
            const height = container.offsetHeight;
            this.options.stickyThreshold = top + height;
        }
    }

    /**
     * Injects scroll-margin-top on sections and top on section h2 elements
     * so they align right below the sticky block. This eliminates the need
     * to manually keep CSS magic numbers in sync with stickyThreshold.
     * @private
     */
    applyStickyThresholdCSS() {
        const threshold = this.options.stickyThreshold;
        const gap = this.options.stickyGap || 0;
        const effectiveTop = threshold + gap;
        document.querySelectorAll(this.options.sectionSelector).forEach(section => {
            section.style.scrollMarginTop = effectiveTop + 'px';
            const h2 = section.querySelector('h2');
            if (h2) h2.style.top = effectiveTop + 'px';
        });
    }

    /**
     * Sets up bidirectional synchronization between 3D navigation and page scrolling
     * @private
     */
    setupBidirectionalSync() {
        // 1. Navigation → Scroll: When 3D navigation changes, scroll to description
        this.controller.on('navigationChange', (data) => {
            const sectionId = data.element.getAttribute(this.options.dataSectionAttribute);
            // Don't scroll if this navigation was triggered by user scrolling (prevents feedback loop)
            if (sectionId && !this.programmaticScroll && !this.scrollTriggeredNavigation) {
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

        // Helper: reset to initial state (index -1)
        const resetToInitial = () => {
            if (this.currentNavigationTarget !== null) {
                this.currentNavigationTarget = null;
                const baseUrl = window.location.pathname;
                window.history.replaceState({}, '', baseUrl);
                this.controller.resetToDefault({ skipScroll: true });
                this.controller.clearHighlights();
            }
        };

        // Helper: select a section by id (triggers nav click)
        const selectSection = (sectionId) => {
            if (this.currentNavigationTarget === sectionId) return;
            const navElements = sectionToNavElements[sectionId];
            if (!navElements || navElements.length === 0) return;
            this.currentNavigationTarget = sectionId;
            this.scrollTriggeredNavigation = true;
            navElements[0].click();
            setTimeout(() => { this.scrollTriggeredNavigation = false; }, 50);
        };

        // Scroll-driven section detection (replaces IntersectionObserver).
        // Runs every frame via rAF for immediate, consistent response at any scroll speed.
        // Determines the active section by finding the last section whose top has scrolled
        // to or above the effective sticky boundary (stickyThreshold + stickyGap).
        const effectiveTop = this.options.stickyThreshold + (this.options.stickyGap || 0);
        let scrollTicking = false;
        window.addEventListener('scroll', () => {
            if (this.programmaticScroll || scrollTicking) return;
            scrollTicking = true;
            requestAnimationFrame(() => {
                scrollTicking = false;
                // Find the last section whose top has scrolled to or above the sticky boundary.
                // "Last" because sections are in DOM order — if multiple have crossed,
                // the bottom-most one is the one currently under the sticky block.
                let activeSection = null;
                for (let i = 0; i < sections.length; i++) {
                    if (sections[i].getBoundingClientRect().top <= effectiveTop) {
                        activeSection = sections[i];
                    } else {
                        break; // sections are in order, no need to check further
                    }
                }
                if (activeSection) {
                    selectSection(activeSection.id);
                } else {
                    // No section has reached the sticky boundary → reset to index -1
                    resetToInitial();
                }
            });
        }, { passive: true });
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

        // Compute effective top offset (sticky block + gap)
        const effectiveTop = this.options.stickyThreshold + (this.options.stickyGap || 0);

        // Check if both the isometric container and the section content are already visible
        const isometricContainer = this.controller.container;
        const isContainerVisible = this.isElementVisible(isometricContainer, 0);
        const isSectionVisible = this.isElementVisible(section, effectiveTop);
        
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

        // Scroll so the section's top aligns just below the sticky block + gap.
        // Use getBoundingClientRect for true viewport-relative position (offsetTop is
        // relative to the positioned parent, not the document).
        const rect = section.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top;
        const targetPosition = absoluteTop - effectiveTop;
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
