// ─── ViewState: Centralized state machine for 3D view phase ───────────────────
const Phase = Object.freeze({
  IDLE: 'idle',
  DRAGGING: 'dragging',
  ANIMATING: 'animating'
});

class ViewState {
  constructor() {
    this._phase = Phase.IDLE;
    this._navIndex = -1;
    this._subscribers = [];
  }

  get phase() { return this._phase; }
  get navIndex() { return this._navIndex; }

  /** Transition to a new phase. No-op if already in that phase. */
  transition(toPhase) {
    const from = this._phase;
    if (from === toPhase) return this;
    this._phase = toPhase;
    this._notify('phase', { from, to: toPhase });
    return this;
  }

  /** Update the active navigation index. */
  updateNavIndex(index) {
    const prev = this._navIndex;
    if (prev === index) return this;
    this._navIndex = index;
    this._notify('navIndex', { from: prev, to: index });
    return this;
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(callback) {
    this._subscribers.push(callback);
    return () => {
      this._subscribers = this._subscribers.filter(s => s !== callback);
    };
  }

  /** Get an immutable snapshot of current state. */
  snapshot() {
    return { phase: this._phase, navIndex: this._navIndex };
  }

  /** @private */
  _notify(type, data) {
    for (const cb of this._subscribers) {
      try { cb(type, data, this); } catch (e) { console.error('ViewState subscriber error:', e); }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────

class Isometric3D {
  /**
   * Initialize a new Isometric3D instance
   * @param {string} containerId - The ID of the HTML container element
   * @param {Object} options - Configuration options
   * @param {Object} options.defaultRotation - Default camera rotation angles (fallback when nav-points don't specify)
   * @param {number} options.defaultZoom - Default zoom level (fallback when nav-points don't specify)
   * @param {Object} options.initialRotation - Initial/home rotation angles (startup & spacebar reset, falls back to defaultRotation)
   * @param {number} options.initialZoom - Initial/home zoom level (startup & spacebar reset, falls back to defaultZoom)
   * @param {Object} options.mouseSensitivity - Mouse drag sensitivity
   * @param {Object} options.rotationLimits - Min/max rotation constraints
   * @param {string} options.urlPrefix - Prefix for URL hash parameters
   * @param {boolean} options.showCompactControls - Show compact control panel
   * @param {boolean} options.debugShadows - Enable shadow debugging
   * @param {string} options.navSelectedTarget - Navigation target behavior
   * @param {Array} options.connectors - Connector definitions array
   * @param {Object} options.connectorDefaults - Default connector line styles
   * @param {Object} options.dimmingAlpha - Alpha values for dimming non-highlighted elements
   * @param {number} options.dimmingAlpha.backgroundColor - Alpha for background colors (default: 0.2)
   * @param {number} options.dimmingAlpha.borderColor - Alpha for border colors (default: 0.2)
   * @param {number} options.dimmingAlpha.color - Alpha for text colors (default: 0.3)
   * @param {number} options.dimmingAlpha.svg - Alpha for SVG stroke/fill (default: 0.25)
   */
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    // Instance-specific state - Center is now (0,0,0)
    this.defaultRotation = {
      x: options.defaultRotation?.x || 45,
      y: options.defaultRotation?.y || 0,
      z: options.defaultRotation?.z || -35
    };

    // Initial rotation/zoom: the "home" point (startup & spacebar reset)
    // Falls back to defaultRotation/defaultZoom if not explicitly set
    this.initialRotation = {
      x: options.initialRotation?.x ?? this.defaultRotation.x,
      y: options.initialRotation?.y ?? this.defaultRotation.y,
      z: options.initialRotation?.z ?? this.defaultRotation.z
    };
    this.currentRotation = { ...this.initialRotation };

    this.defaultZoom = options.defaultZoom || 1.0;
    this.initialZoom = options.initialZoom ?? this.defaultZoom;
    this.currentZoom = this.initialZoom;

    // Translation for centering on elements
    this.currentTranslation = { x: 0, y: 0, z: 0 };
    this.defaultTranslation = { x: 0, y: 0, z: 0 };
    this.initialTranslation = { x: 0, y: 0, z: 0 };

    this.urlUpdateTimeout = null;
    this.labelUpdateTimeout = null; // Track label update timeout to prevent flicker

    // Centralized state machine (phase + navIndex)
    this._viewState = new ViewState();
    this.isClickNavigation = false; // Track if navigation is from a click (vs manual drag)
    this.isNavButtonClick = false; // Track if navigation is from nav button click
    this.hasManualPanAdjustment = false; // Track if pan was manually adjusted by user (drag/keyboard)
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.dragButton = null;
    this.lastUpdateTime = 0; // For throttling mouse events
    this.mouseMoveThrottle = 16; // ~60fps (16ms between updates)
    this.isInitialized = false; // Guard to prevent duplicate initialization
    this.shadowsCreated = false; // Guard to prevent creating shadows twice
    this.animationFrameId = null; // Track requestAnimationFrame for smooth dragging
    this.keyboardAnimationFrameId = null; // Track requestAnimationFrame for smooth keyboard navigation
    this.translationAnimationId = null; // Track requestAnimationFrame for translation animations
    this.navigationAnimationId = null; // Track requestAnimationFrame for smooth navigation animations
    this.lastKeyTime = 0; // For throttling keyboard events

    // Mouse sensitivity settings
    this.mouseSensitivity = {
      x: options.mouseSensitivity?.x || 0.5,
      z: options.mouseSensitivity?.z || 0.5,
      y: options.mouseSensitivity?.y || 0.3
    };

    // Rotation limits configuration (per instance)
    this.rotationLimits = {
      x: {
        min: options.rotationLimits?.x?.min ?? 0,
        max: options.rotationLimits?.x?.max ?? 90
      },
      y: {
        min: options.rotationLimits?.y?.min ?? -180,
        max: options.rotationLimits?.y?.max ?? 180
      },
      z: {
        min: options.rotationLimits?.z?.min ?? -180,
        max: options.rotationLimits?.z?.max ?? 180
      }
    };

    // URL parameter prefix for this instance
    this.urlPrefix = options.bookmarkPrefix || containerId + '_';

    // Compact controls option
    this.showCompactControls = options.showCompactControls || false;

    // Debug mode for shadow visualization
    this.debugShadows = options.debugShadows || false;

    // Nav-selected target face option
    // When clicking a face, which face should get .nav-selected?
    // Options: 'clicked' (default), 'top', 'bottom', 'front', 'back', 'left', 'right'
    this.navSelectedTarget = options.navSelectedTarget || 'clicked';

    // Connector definitions
    this.connectors = options.connectors || null;

    // Default connector settings
    this.connectorDefaults = {
      startLine: options.connectorDefaults?.startLine || undefined,  // 'arrow', 'arrowSmall', 'circle', 'arrow-circle', or undefined
      endLine: options.connectorDefaults?.endLine || undefined,        // 'arrow', 'arrowSmall', 'circle', 'arrow-circle', or undefined
      lineStyle: options.connectorDefaults?.lineStyle || 'solid',    // 'solid' or 'dashed'
      animationStyle: options.connectorDefaults?.animationStyle || undefined  // 'circle' or undefined
    };

    // Dimming alpha values for non-highlighted elements
    this.dimmingAlpha = {
      backgroundColor: options.dimmingAlpha?.backgroundColor ?? 0.2,  // 20% opacity for backgrounds
      borderColor: options.dimmingAlpha?.borderColor ?? 0.2,          // 20% opacity for borders
      color: options.dimmingAlpha?.color ?? 0.3,                      // 30% opacity for text (more readable)
      svg: options.dimmingAlpha?.svg ?? 0.25                          // 25% opacity for SVG elements
    };

    // Event listeners for custom events
    this.eventListeners = {
      navigationChange: [],
      navKeys: [],
      highlightChange: [],
      connectorClick: [],
      viewReset: [],
      autoPlayChange: [],
      centerOnElement: [],
      sceneUpdate: []
    };

    // Autoplay state
    this.isAutoPlaying = false;
    this.autoPlayTimer = null;
    this.autoPlayInterval = 5000; // 5 seconds
    this.navElements = null;

    // Navigation source tracking for events
    this._navigationSource = null;

    // Bind methods to preserve 'this' context
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onFocus = this.onFocus.bind(this);
    this.onBlur = this.onBlur.bind(this);

    this.init();
  }

  // ─── ViewState bridge: boolean flags → centralized phase ─────────────────────
  // All existing code continues to read/write isDragging, isAnimating, and
  // currentNavIndex as before.  These getters/setters delegate to the ViewState
  // state machine so phase transitions are tracked in a single place.

  get isDragging() {
    return this._viewState.phase === Phase.DRAGGING;
  }

  set isDragging(v) {
    if (v) {
      this._viewState.transition(Phase.DRAGGING);
    } else if (this._viewState.phase === Phase.DRAGGING) {
      this._viewState.transition(Phase.IDLE);
    }
  }

  get isAnimating() {
    return this._viewState.phase === Phase.ANIMATING;
  }

  set isAnimating(v) {
    if (v) {
      this._viewState.transition(Phase.ANIMATING);
    } else if (this._viewState.phase === Phase.ANIMATING) {
      this._viewState.transition(Phase.IDLE);
    }
  }

  get currentNavIndex() {
    return this._viewState.navIndex;
  }

  set currentNavIndex(v) {
    this._viewState.updateNavIndex(v);
  }

  /** Expose the ViewState for external subscribers / plugins. */
  get viewState() {
    return this._viewState;
  }

  /**
   * Cancel any in-progress navigation / translation animations.
   * Centralizes the cancel-rAF + null-id pattern that was duplicated in
   * onMouseDown, onWheel, smoothAnimateTo, and smoothAnimateToWithPan.
   */
  cancelPendingAnimations() {
    if (this.navigationAnimationId) {
      cancelAnimationFrame(this.navigationAnimationId);
      this.navigationAnimationId = null;
    }
    if (this.translationAnimationId) {
      cancelAnimationFrame(this.translationAnimationId);
      this.translationAnimationId = null;
    }
  }

  /**
   * Parse dimension value (supports auto, percentage, or pixel values)
   * @param {string} value - The dimension value to parse (e.g., "100%", "auto", "200")
   * @param {HTMLElement} parent - The parent element for percentage calculations
   * @param {string} axis - The axis for percentage calculation ('width' or 'height')
   * @param {number|null} fallbackValue - Fallback value if parsing fails (default: null for auto, 100 for percentages)
   * @returns {number|null} - Parsed dimension in pixels, or null if should be measured from content
   */
  parseDimension(value, parent, axis, fallbackValue = null) {
    if (!value || value === 'auto') {
      return fallbackValue;
    }
    if (typeof value === 'string' && value.includes('%')) {
      // Percentage: calculate based on parent's computed size
      const percentage = parseFloat(value) / 100;
      const computedStyle = window.getComputedStyle(parent);
      const parentSize = parseFloat(axis === 'width' ? computedStyle.width : computedStyle.height);
      if (parentSize > 0) {
        return Math.floor(parentSize * percentage);
      }
      return fallbackValue !== null ? fallbackValue : 100; // Fallback if parent has no size
    }
    return parseInt(value);
  }

  /**
   * Sanitize translation object to ensure all values are valid numbers
   * @param {Object} translation - Translation object with x, y, z properties
   * @returns {Object} - Sanitized translation with guaranteed valid numbers
   */
  sanitizeTranslation(translation) {
    return {
      x: (typeof translation.x === 'number' && !isNaN(translation.x)) ? translation.x : 0,
      y: (typeof translation.y === 'number' && !isNaN(translation.y)) ? translation.y : 0,
      z: (typeof translation.z === 'number' && !isNaN(translation.z)) ? translation.z : 0
    };
  }

  init() {
    // Make container focusable
    if (!this.container.hasAttribute('tabindex')) {
      this.container.setAttribute('tabindex', '0');
    }

    // Setup navigation glass effects
    this.setupNavigationEffects();

    // Create compact controls if enabled
    if (this.showCompactControls) {
      this.createCompactControls();
    }

    // Add event listeners
    this.addEventListeners();

    // Wait for DOM to be fully loaded, then start three-phase initialization
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initializeThreePhase();
      });
    } else {
      // DOM already loaded
      this.initializeThreePhase();
    }
  }

  configureCuboids() {
    // Guard: Only create shadows once (on first call)
    const isFirstCall = !this.shadowsCreated;

    // Find all cuboids with dimensions
    const cuboids = this.container.querySelectorAll('.cuboid[data-width], .cuboid[data-depth]');

    // FIRST PASS: Set dimensions to trigger 2D layout
    // Temporarily hide all 3D faces so they don't affect layout measurements
    cuboids.forEach(cuboid => {
      const widthAttr = cuboid.getAttribute('data-width');
      const depthAttr = cuboid.getAttribute('data-depth');
      
      const parent = cuboid.parentElement;
      // Treat missing data-width/data-depth and 'auto' equally - both will be measured
      // Use 20px as temporary value for measurement phase
      // Note: height is not needed in this first pass - it's only used later in the 3D transform phase
      const width = this.parseDimension(widthAttr, parent, 'width', 20);
      const depth = this.parseDimension(depthAttr, parent, 'height', 20);

      cuboid.style.width = `${width}px`;
      cuboid.style.height = `${depth}px`;

      // Store any existing inline transform and remove it temporarily
      // We'll reapply it during the 3D transformation phase
      const existingTransform = cuboid.style.transform;
      if (existingTransform) {
        cuboid.setAttribute('data-original-transform', existingTransform);
        cuboid.style.transform = '';
      }

      // Temporarily collapse all faces to 0x0 for accurate 2D layout measurement
      // These will be properly sized in the 3D transformation phase
      const faces = cuboid.querySelectorAll(':scope > .front, :scope > .back, :scope > .left, :scope > .right, :scope > .top, :scope > .bottom');
      faces.forEach(face => {
        // Add .face class to all face elements for simplified CSS
        face.classList.add('face');

        face.style.width = '0px';
        face.style.height = '0px';
      });
    });

    // Wait for browser to complete layout, then measure positions
    requestAnimationFrame(() => {
      // SECOND PASS: Capture initial 2D positions AFTER layout is complete but BEFORE 3D transforms
      const perspective = this.container.querySelector('.isometric-perspective');

      cuboids.forEach(cuboid => {
        // Capture the cuboid's initial 2D position using offsetLeft/offsetTop
        // These give us the position WITHOUT transforms applied
        cuboid.setAttribute('data-initial-x', cuboid.offsetLeft);
        cuboid.setAttribute('data-initial-y', cuboid.offsetTop);
      });

      // Create shadows for scenes (not cuboids) ONLY on first call
      if (isFirstCall) {
        const scenes = this.container.querySelectorAll('.scene[data-z-axis]');

        // Force a layout reflow to ensure all 2D positioning is complete
        const perspective = this.container.querySelector('.isometric-perspective');
        void perspective.offsetHeight; // Force reflow

        scenes.forEach((scene, index) => {
          const zAxisOffset = parseInt(scene.getAttribute('data-z-axis')) || 0;

          if (zAxisOffset > 0) {
            // Determine the shadow container (parent scene or perspective)
            const parentScene = scene.parentElement?.closest('.scene');
            const shadowContainer = parentScene || perspective;

            // Get evaluated positions AFTER 2D layout (flex, grid, etc.)
            const sceneRect = scene.getBoundingClientRect();
            const containerRect = shadowContainer.getBoundingClientRect();

            // Calculate position relative to shadow container
            const sceneX = sceneRect.left - containerRect.left;
            const sceneY = sceneRect.top - containerRect.top;
            const sceneWidth = sceneRect.width;
            const sceneHeight = sceneRect.height;

            // Store initial 2D position and dimensions
            scene.setAttribute('data-initial-x', sceneX);
            scene.setAttribute('data-initial-y', sceneY);
            scene.setAttribute('data-initial-width', sceneWidth);
            scene.setAttribute('data-initial-height', sceneHeight);

            // Calculate scene bounding box from contained cuboids
            const sceneCuboids = scene.querySelectorAll(':scope > .cuboid[data-width]');
            if (sceneCuboids.length > 0) {
              // Use the scene's position and first cuboid's dimensions for shadow
              const firstCuboid = sceneCuboids[0];
              const width = parseInt(firstCuboid.getAttribute('data-width')) || 100;
              const depth = parseInt(firstCuboid.getAttribute('data-depth')) || 100;
              this.createShadowDiv(scene, width, depth, zAxisOffset);
            } else {
              // Scene has no cuboids - use the scene's own measured dimensions
              // For nested scenes, dimensions and positions are relative to parent
              this.createShadowDiv(scene, sceneWidth, sceneHeight, zAxisOffset);
            }
          }
        });
        this.shadowsCreated = true;
      }

      // Phase 3: Apply 3D transforms to cuboids
      this.applyCuboidTransforms(cuboids);

      // Validate 3D transform chain is not broken
      this.validate3DTransformChain();
    });
  }

  measureAutoHeightCuboidsIn2D() {
    // Find all cuboids with missing data-width/data-height/data-depth, "auto" values, or percentage values
    const allCuboids = this.container.querySelectorAll('.cuboid');
    const cuboidsToMeasure = Array.from(allCuboids).filter(cuboid => {
      const widthAttr = cuboid.getAttribute('data-width');
      const heightAttr = cuboid.getAttribute('data-height');
      const depthAttr = cuboid.getAttribute('data-depth');
      const needsProcessing = (attr) => !attr || attr === 'auto' || (typeof attr === 'string' && attr.includes('%'));
      return needsProcessing(widthAttr) || needsProcessing(heightAttr) || needsProcessing(depthAttr);
    });

    // Ensure perspective is flat (no 3D transforms yet)
    const perspective = this.container.querySelector('.isometric-perspective');
    const originalPerspectiveTransform = perspective ? perspective.style.transform : '';
    if (perspective) {
      perspective.style.transform = 'none';
    }

    cuboidsToMeasure.forEach(cuboid => {
      const widthAttr = cuboid.getAttribute('data-width');
      const depthAttr = cuboid.getAttribute('data-depth');
      const heightAttr = cuboid.getAttribute('data-height');

      const parent = cuboid.parentElement;

      // Determine if we need to measure each dimension
      const needsWidthMeasurement = !widthAttr || widthAttr === 'auto';
      const needsDepthMeasurement = !depthAttr || depthAttr === 'auto';
      const needsHeightMeasurement = !heightAttr || heightAttr === 'auto';

      // Use temporary values for measurement (will be updated with actual measurements)
      // For auto values, parseDimension returns null; for percentages, it calculates the size
      let width = this.parseDimension(widthAttr, parent, 'width', null) || 100;
      let depth = this.parseDimension(depthAttr, parent, 'height', null) || 100;

      // Get face elements
      const frontFace = cuboid.querySelector(':scope > .front');
      const backFace = cuboid.querySelector(':scope > .back');
      const leftFace = cuboid.querySelector(':scope > .left');
      const rightFace = cuboid.querySelector(':scope > .right');
      const topFace = cuboid.querySelector(':scope > .top');
      const bottomFace = cuboid.querySelector(':scope > .bottom');

      // Store calculated percentage values as numeric attributes
      if (widthAttr && widthAttr.includes('%')) {
        cuboid.setAttribute('data-width', width.toString());
      }
      if (depthAttr && depthAttr.includes('%')) {
        cuboid.setAttribute('data-depth', depth.toString());
      }

      // Measure width if needed
      // Width comes from: front/back width OR top/bottom width
      if (needsWidthMeasurement) {
        let maxWidth = 0;

        // Measure front/back faces width
        [frontFace, backFace, topFace, bottomFace].forEach(face => {
          if (face) {
            face.style.width = 'auto';
            face.style.height = '100px'; // Temporary height
            face.style.opacity = '1';
            face.style.position = 'absolute';
            face.style.transform = 'none';
            face.style.display = 'flex';
            face.style.visibility = 'hidden';
            face.style.boxSizing = 'border-box';

            void face.offsetWidth;
            const measuredWidth = face.offsetWidth;
            maxWidth = Math.max(maxWidth, measuredWidth);

            face.style.width = '';
            face.style.height = '';
            face.style.opacity = '';
            face.style.display = '';
            face.style.visibility = '';
            face.style.boxSizing = '';
          }
        });

        // Add buffer to prevent overlap (accounts for padding, borders, rounding and rendering differences)
        // Use a larger buffer to accommodate flex layouts and padding
        width = maxWidth > 0 ? Math.ceil(maxWidth * 1.05) + 4 : 100;
        cuboid.setAttribute('data-width', width.toString());
      }

      // Measure height (or use percentage if specified)
      // Height comes from: front/back/left/right height
      if (heightAttr && heightAttr.includes('%')) {
        // Height percentage: use parent's height
        const evaluatedHeight = parseDimension(heightAttr, parent, 'height') || 100;
        cuboid.setAttribute('data-height', evaluatedHeight.toString());
      } else if (needsHeightMeasurement) {
        // Measure height from content
        let maxHeight = 0;

        // Measure front and back faces height
        [frontFace, backFace].forEach(face => {
          if (face) {
            face.style.width = `${width}px`;
            face.style.height = 'auto';
            face.style.opacity = '1';
            face.style.position = 'absolute';
            face.style.transform = 'none';
            face.style.display = 'flex';
            face.style.visibility = 'hidden';
            face.style.boxSizing = 'border-box';

            void face.offsetHeight;
            const measuredHeight = face.offsetHeight;
            maxHeight = Math.max(maxHeight, measuredHeight);

            face.style.width = '';
            face.style.height = '';
            face.style.opacity = '';
            face.style.display = '';
            face.style.visibility = '';
            face.style.boxSizing = '';
          }
        });

        // Measure left and right faces height
        [leftFace, rightFace].forEach(face => {
          if (face) {
            face.style.width = `${depth}px`;
            face.style.height = 'auto';
            face.style.opacity = '1';
            face.style.position = 'absolute';
            face.style.transform = 'none';
            face.style.display = 'flex';
            face.style.visibility = 'hidden';
            face.style.boxSizing = 'border-box';

            void face.offsetHeight;
            const measuredHeight = face.offsetHeight;
            maxHeight = Math.max(maxHeight, measuredHeight);

            face.style.width = '';
            face.style.height = '';
            face.style.opacity = '';
            face.style.display = '';
            face.style.visibility = '';
            face.style.boxSizing = '';
          }
        });

        // Add buffer to prevent overlap
        const evaluatedHeight = maxHeight > 0 ? Math.ceil(maxHeight * 1.05) + 4 : 100;
        cuboid.setAttribute('data-height', evaluatedHeight.toString());
      }

      // Measure depth if needed
      // Depth comes from: left/right width OR top/bottom height
      if (needsDepthMeasurement) {
        let maxDepth = 0;

        // Measure left/right faces width (represents depth)
        [leftFace, rightFace].forEach(face => {
          if (face) {
            face.style.width = 'auto';
            face.style.height = '100px'; // Temporary height
            face.style.opacity = '1';
            face.style.position = 'absolute';
            face.style.transform = 'none';
            face.style.display = 'flex';
            face.style.visibility = 'hidden';
            face.style.boxSizing = 'border-box';

            void face.offsetWidth;
            const measuredDepth = face.offsetWidth;
            maxDepth = Math.max(maxDepth, measuredDepth);

            face.style.width = '';
            face.style.height = '';
            face.style.opacity = '';
            face.style.display = '';
            face.style.visibility = '';
            face.style.boxSizing = '';
          }
        });

        // Also measure top/bottom faces height (represents depth)
        [topFace, bottomFace].forEach(face => {
          if (face) {
            face.style.width = `${width}px`;
            face.style.height = 'auto';
            face.style.opacity = '1';
            face.style.position = 'absolute';
            face.style.transform = 'none';
            face.style.display = 'flex';
            face.style.visibility = 'hidden';
            face.style.boxSizing = 'border-box';

            void face.offsetHeight;
            const measuredDepth = face.offsetHeight;
            maxDepth = Math.max(maxDepth, measuredDepth);

            face.style.width = '';
            face.style.height = '';
            face.style.opacity = '';
            face.style.display = '';
            face.style.visibility = '';
            face.style.boxSizing = '';
          }
        });

        // Add buffer to prevent overlap
        depth = maxDepth > 0 ? Math.ceil(maxDepth * 1.05) + 4 : 100;
        cuboid.setAttribute('data-depth', depth.toString());
      }

      // Clean up styles
      [frontFace, backFace, leftFace, rightFace, topFace, bottomFace].forEach(face => {
        if (face) {
          face.style.position = '';
          face.style.transform = '';
        }
      });
    });

    // Restore perspective transform
    if (perspective) {
      perspective.style.transform = originalPerspectiveTransform;
    }
  }

  applyCuboidTransforms(cuboids) {
    cuboids.forEach(cuboid => {
      const width = parseInt(cuboid.getAttribute('data-width')) || 100;
      const heightAttr = cuboid.getAttribute('data-height');
      // At this point, auto-height measurement should have already run,
      // so data-height should be a number. If it's still missing/auto, use 100 as fallback.
      const height = parseInt(heightAttr) || 100;
      const depth = parseInt(cuboid.getAttribute('data-depth')) || 100;

      cuboid.style.width = `${width}px`;
      cuboid.style.height = `${depth}px`;

      // Configure each face - corrected dimensions and restore visibility
      // Use :scope to only select direct child faces, not nested faces
      const faces = cuboid.querySelectorAll(':scope > .front, :scope > .back, :scope > .left, :scope > .right, :scope > .top, :scope > .bottom');
      faces.forEach(face => {
        const classList = face.classList;

        if (classList.contains('front') || classList.contains('back')) {
          face.style.width = `${width}px`;
          face.style.height = `${height}px`;
        } else if (classList.contains('left') || classList.contains('right')) {
          face.style.width = `${depth}px`;
          face.style.height = `${height}px`;
        } else if (classList.contains('top') || classList.contains('bottom')) {
          face.style.width = `${width}px`;
          face.style.height = `${depth}px`;
        }

        // Restore opacity after measurement phase
        face.style.opacity = '';
      });

      // Update transforms based on dimensions
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const halfDepth = depth / 2;
      // Get Z-axis offset from data attribute or use default
      const zAxisOffset = parseInt(cuboid.getAttribute('data-z-axis')) || 0;

      // Update cuboid positioning - preserve existing translateX/translateY and add translateZ
      const existingTransform = cuboid.style.transform || '';
      const translateXMatch = existingTransform.match(/translateX\(([-\d.]+)px\)/);
      const translateYMatch = existingTransform.match(/translateY\(([-\d.]+)px\)/);

      const existingX = translateXMatch ? parseFloat(translateXMatch[1]) : 0;
      const existingY = translateYMatch ? parseFloat(translateYMatch[1]) : 0;

      // Build transform that preserves X/Y and adds Z positioning
      cuboid.style.transform = `translateX(${existingX}px) translateY(${existingY}px) translateZ(${zAxisOffset + halfHeight}px)`;

      // Get face elements (no longer using .face class)
      const front = cuboid.querySelector(':scope > .front');
      const back = cuboid.querySelector(':scope > .back');
      const left = cuboid.querySelector(':scope > .left');
      const right = cuboid.querySelector(':scope > .right');
      const top = cuboid.querySelector(':scope > .top');
      const bottom = cuboid.querySelector(':scope > .bottom');




      const padding = 10;


      if (front) front.style.transform = `translate(-50%,-50%) rotateY(0deg) rotateX(-90deg)  translateZ(${halfDepth}px)`;
      if (back) back.style.transform = `translate(-50%,-50%) rotateY(180deg) rotateX(90deg) translateZ(${halfDepth}px)`;
      if (left) left.style.transform = `translate(-50%,-50%) rotateY(-90deg) rotateZ(90deg) translateZ(${halfWidth}px)`;
      if (right) right.style.transform = `translate(-50%,-50%) rotateY(90deg) rotateZ(-90deg) translateZ(${halfWidth}px)`;
      if (top) top.style.transform = `translate(-50%,-50%) rotateX(0deg) translateZ(${halfHeight}px)`;
      if (bottom) bottom.style.transform = `translate(-50%,-50%) rotateX(-180deg) translateZ(${halfHeight}px)`;

    });

    // Find all flat scenes (without faces) within this container and apply z-axis positioning
    const flatScenes = this.container.querySelectorAll('.scene:not([data-width])');
    const defaultSceneEpsilonZ = 0.5;

    // FIRST PASS: Set preserve-3d on parent scenes that contain child scenes
    // This must be done BEFORE applying transforms to ensure 3D context is established
    flatScenes.forEach(flatScene => {
      const childScenes = flatScene.querySelectorAll(':scope > .scene');
      if (childScenes.length > 0) {
        flatScene.style.transformStyle = 'preserve-3d';
      }
    });

    // SECOND PASS: Apply Z transforms to scenes with z-axis attribute
    flatScenes.forEach(flatScene => {
      const rawZAxis = flatScene.getAttribute('data-z-axis');
      const parsedZAxis = parseFloat(rawZAxis);
      const hasExplicitZAxis = Number.isFinite(parsedZAxis);
      const authorInlineTranslate = flatScene.dataset.sceneTranslateManaged !== 'true'
        && flatScene.getAttribute('style')?.includes('--scene-translate-z');
      let zAxisOffset = hasExplicitZAxis ? parsedZAxis : 0;

      if (zAxisOffset === 0 && !authorInlineTranslate) {
        zAxisOffset = defaultSceneEpsilonZ;
        flatScene.dataset.sceneTranslateEpsilon = 'true';
      } else if (flatScene.dataset.sceneTranslateEpsilon === 'true' && zAxisOffset !== 0) {
        delete flatScene.dataset.sceneTranslateEpsilon;
      }

      // Remove legacy inline translateZ we previously injected (preserves author transforms)
      const inlineTransform = flatScene.style.transform?.trim();
      if (inlineTransform) {
        const normalizedTransform = inlineTransform.replace(/\s+/g, ' ');
        if (/^translateZ\([^)]+\)(?: scale\(var\(--scene-hover-scale, 1\)\))?$/.test(normalizedTransform)) {
          flatScene.style.removeProperty('transform');
        }
      }

      // Store translateZ via CSS custom property so hover effects can reuse it
      flatScene.style.setProperty('--scene-translate-z', `${zAxisOffset}px`);
      flatScene.dataset.sceneTranslateManaged = 'true';

      if (hasExplicitZAxis && parsedZAxis !== 0) {
        // Ensure 3D context and stacking order for elevated scenes
        flatScene.style.transformStyle = 'preserve-3d';
        flatScene.style.zIndex = Math.floor(parsedZAxis);
        flatScene.dataset.sceneAutoZIndex = 'true';
      } else if (flatScene.dataset.sceneAutoZIndex === 'true' && (!hasExplicitZAxis || parsedZAxis === 0)) {
        // Reset auto-applied z-index when returning to 0 elevation
        flatScene.style.removeProperty('z-index');
        delete flatScene.dataset.sceneAutoZIndex;
      }
    });
  }

  validate3DTransformChain() {
    // Find all elements with data-z-axis or navigation class that should be positioned in 3D
    const elements3D = this.container.querySelectorAll('[data-z-axis], .nav-clickable');
    const perspective = this.container.querySelector('.isometric-perspective');

    elements3D.forEach(element => {
      const zAxis = parseInt(element.getAttribute('data-z-axis')) || 0;

      // Validate all elements with navigation class, even if z-axis is 0
      const hasNavClass = element.classList.contains('nav-clickable');

      // Skip only if no nav class and z-axis is 0
      if (!hasNavClass && zAxis === 0) return;

      // Walk up the DOM tree from element to perspective
      let current = element.parentElement;
      const brokenElements = [];

      while (current && current !== perspective && current !== this.container) {
        const computedStyle = window.getComputedStyle(current);
        const transformStyle = computedStyle.transformStyle;

        // Check if this element breaks the 3D chain
        if (transformStyle !== 'preserve-3d') {
          brokenElements.push({
            element: current,
            id: current.id || current.className || current.tagName,
            transformStyle: transformStyle
          });
        }

        current = current.parentElement;
      }

      // If we found elements breaking the chain, automatically fix them
      if (brokenElements.length > 0) {
        console.warn(`⚠️ 3D Transform Chain Auto-Fix for element "${element.id || element.className}":`);
        console.warn(`   Element has data-z-axis="${zAxis}" but ancestors were flattening 3D transforms.`);
        console.warn(`   Automatically applying transform-style: preserve-3d to fix the chain:`);

        brokenElements.forEach(broken => {
          console.warn(`   ✓ Fixed: ${broken.id} (was: ${broken.transformStyle}, now: preserve-3d)`);

          // Automatically fix by applying preserve-3d
          broken.element.style.transformStyle = 'preserve-3d';

          // Mark that this was auto-fixed (for debugging/documentation purposes)
          broken.element.setAttribute('data-3d-chain-auto-fixed', 'true');
        });

        console.warn(`   💡 Consider adding "transform-style: preserve-3d" to CSS for these elements.`);
      }
    });
  }

  createShadowDiv(scene, width, depth) {
    // Get z-axis offset for shadow calculations
    const zAxisOffset = parseInt(scene.getAttribute('data-z-axis')) || 0;

    // Don't create shadow if zAxisOffset is 0
    if (zAxisOffset === 0) {
      return;
    }

    // Generate a unique identifier for this scene's shadow
    // Replace decimal point with dash to make valid CSS selector
    const sceneId = scene.id || `scene-${Math.random().toString().replace(/\./g, '-')}`;
    if (!scene.id) {
      scene.id = sceneId; // Assign an ID if the scene doesn't have one
    }

    // Check if shadow already exists to avoid duplicates
    // Search for any shadow with matching data-shadow-for attribute in the parent
    const existingShadow = Array.from(scene.parentNode.children).find(
      child => child.classList.contains('scene-shadow') &&
        child.getAttribute('data-shadow-for') === sceneId
    );
    if (existingShadow) {
      existingShadow.remove();
    }

    // Create shadow div positioned at negative coordinates
    const shadowDiv = document.createElement('div');
    shadowDiv.className = 'scene-shadow';
    shadowDiv.setAttribute('data-shadow-for', sceneId);

    // Copy all relevant positioning and styling from the original scene
    const sceneStyle = window.getComputedStyle(scene);

    // Get scene's actual dimensions from stored attributes (measured in 2D)
    const sceneWidth = parseFloat(scene.getAttribute('data-initial-width')) || width;
    const sceneHeight = parseFloat(scene.getAttribute('data-initial-height')) || depth;

    // Debug mode: Add visible border and background
    if (this.debugShadows) {
      shadowDiv.classList.add('debug-shadow');
    }

    // Set dimensions to EXACT SAME as the scene element
    shadowDiv.style.width = `${sceneWidth}px`;
    shadowDiv.style.height = `${sceneHeight}px`;

    // Copy positioning properties but override for centering
    shadowDiv.style.position = 'absolute';

    // Copy grid properties if they exist to maintain layout positioning
    shadowDiv.style.gridArea = sceneStyle.gridArea || 'auto';
    shadowDiv.style.gridColumn = sceneStyle.gridColumn || 'auto';
    shadowDiv.style.gridRow = sceneStyle.gridRow || 'auto';

    // THE SHADOW POSITIONING HACK:
    // Shadow is inside .isometric-perspective, positioned using the PRE-TRANSFORM coordinates
    // Use the stored data-initial-x/y values that were captured before 3D transforms

    const perspective = this.container.querySelector('.isometric-perspective');

    // Get scene's initial 2D position (before transforms) from stored attributes
    const sceneX = parseFloat(scene.getAttribute('data-initial-x')) || 0;
    const sceneY = parseFloat(scene.getAttribute('data-initial-y')) || 0;

    // Shadow position: Bottom-right of shadow aligns with top-left of scene
    // So shadow.left + shadow.width = scene.left
    // Therefore: shadow.left = scene.left - shadow.width
    const shadowX = sceneX - sceneWidth;
    const shadowY = sceneY - sceneHeight;

    // Use left/top for positioning within the perspective
    shadowDiv.style.left = `${shadowX}px`;
    shadowDiv.style.top = `${shadowY}px`;
    shadowDiv.style.transform = 'none';
    shadowDiv.style.transformOrigin = '0 0';

    // Calculate shadow properties based on zAxisOffset (height above ground)
    let shadowBlur, shadowOpacity;
    const shadowSpread = -5; // Negative spread to keep shadow within boundaries

    if (zAxisOffset <= 3) {
      shadowBlur = 3;
      shadowOpacity = 0.5;
    } else {
      // Higher elevation = more blur and less opacity (shadow gets softer and lighter)
      shadowBlur = Math.min(35, zAxisOffset);
      shadowOpacity = Math.max(0.3, Math.min(zAxisOffset / 4, 50) / 100);
    }

    // Create the box-shadow with offset to the right and down
    // Box-shadow offset uses the scene dimensions so shadow appears directly below
    shadowDiv.style.boxShadow = `${sceneWidth}px ${sceneHeight}px ${shadowBlur}px ${shadowSpread}px rgba(0, 0, 0, ${shadowOpacity})`;

    // Determine where to append the shadow:
    // - For nested scenes (child of another .scene), append to parent scene
    // - For top-level scenes, append to perspective container
    const parentScene = scene.parentElement?.closest('.scene');
    const shadowContainer = parentScene || perspective;

    // Insert shadow into the appropriate container
    shadowContainer.appendChild(shadowDiv);
  }

  setupNavigationEffects() {
    // Validate that data-key values are unique across elements
    const keyElements = this.container.querySelectorAll('[data-key]');
    const seenKeys = new Map(); // key → element
    keyElements.forEach(el => {
      const key = (el.getAttribute('data-key') || '').split(',')[0].trim();
      if (key && seenKeys.has(key)) {
        const prev = seenKeys.get(key);
        const desc = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : '');
        throw new Error(`Duplicate data-key="${key}" found on <${desc(prev)}> and <${desc(el)}>. Each data-key must be unique.`);
      }
      if (key) seenKeys.set(key, el);
    });

    // Find all navigable elements: those with explicit nav attributes OR a data-key
    this.navElements = this.container.querySelectorAll('[data-nav-xyz], [data-nav-zoom], [data-nav-pan], [data-key]');

    // Only create navigation bar if there are navigation elements
    if (this.navElements.length > 0) {
      this.createNavigationBarHTML();
      this.createNavigationBar(this.navElements);
    }

    this.navElements.forEach((element, index) => {
      // Add navigation clickable class for glass effect
      element.classList.add('nav-clickable');

      // Add click event listener for navigation
      element.addEventListener('click', (e) => {
        // Suppress click events that immediately follow a drag
        if (this.dragEndTime && (performance.now() - this.dragEndTime) < 200) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const xyz = element.getAttribute('data-nav-xyz');
        const zoom = element.getAttribute('data-nav-zoom');
        const pan = element.getAttribute('data-nav-pan');

        if (!this._navigationSource) this._navigationSource = 'click';

        // Navigate to position with the element for auto-highlight
        // Elements without explicit nav attrs will keep current rotation/zoom and auto-center
        this.navigateToPosition(xyz, zoom, element, pan);
      });
    });

  }

  createNavigationBarHTML() {
    // Check if nav-bar already exists
    const existingNavBar = this.container.querySelector('.nav-bar');
    if (existingNavBar) {
      if (!this.navPointsContainerId) {
        const existingContainer = existingNavBar.querySelector('.nav-points-container');
        if (existingContainer) {
          if (!existingContainer.id) {
            this.navPointsContainerId = `${this.containerId}-nav-points`;
            existingContainer.id = this.navPointsContainerId;
          } else {
            this.navPointsContainerId = existingContainer.id;
          }
        }
      }
      return;
    }

    // Create the navigation bar HTML structure
    const navBar = document.createElement('div');
    navBar.className = 'nav-bar';

    const navPointsContainer = document.createElement('div');
    navPointsContainer.className = 'nav-points-container';
    this.navPointsContainerId = `${this.containerId}-nav-points`;
    navPointsContainer.id = this.navPointsContainerId;

    navBar.appendChild(navPointsContainer);
    this.container.appendChild(navBar);
  }

  createNavigationBar(navElements) {
    const navPointsSelector = this.navPointsContainerId
      ? `#${this.navPointsContainerId}`
      : '.nav-points-container';
    const navPointsContainer = this.container.querySelector(navPointsSelector);
    if (!navPointsContainer) return;

    // Clear existing points
    navPointsContainer.innerHTML = '';

    // Create default starting position circle first
    const defaultPoint = document.createElement('div');
    defaultPoint.className = 'nav-point active';
    defaultPoint.setAttribute('data-nav-index', -1);

    defaultPoint.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Focus container so keyboard controls work
      this.container.focus();

      // Update autoplay index so it continues from this position
      this.currentNavIndex = -1;

      // Mark as navigation button click and update URL with just nav index
      this.isNavButtonClick = true;
      const prefix = this.urlPrefix.replace('_', '');
      const baseUrl = window.location.pathname;
      window.history.replaceState({}, '', `${baseUrl}?${prefix}-nav=0`);

      if (!this._navigationSource) this._navigationSource = 'nav-bar';
      this.resetToDefault();

      // Reset flag
      this.isNavButtonClick = false;
    });

    // Add keyboard handler for default point
    defaultPoint.addEventListener('keydown', (e) => {
      if (e.key === ' ') { e.preventDefault(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        defaultPoint.click();
      }
    });

    navPointsContainer.appendChild(defaultPoint);

    // Build a map of unique navigation items by data-key (if available)
    // This prevents duplicate navigation points for elements with the same data-key
    const uniqueNavItems = new Map();
    const navItemsArray = [];

    navElements.forEach((element, index) => {
      const xyz = element.getAttribute('data-nav-xyz');
      const zoom = element.getAttribute('data-nav-zoom');
      const pan = element.getAttribute('data-nav-pan');

      const section = (element.getAttribute('data-key') || '').split(',')[0].trim() || element.id || '';

      // Use data-key (first key) for deduplication, fallback to index if no section
      const uniqueKey = section || `__index_${index}`;

      // Only add if not already in map (keeps first occurrence)
      if (!uniqueNavItems.has(uniqueKey)) {
        uniqueNavItems.set(uniqueKey, {
          element,
          index,
          section,
          xyz,
          zoom,
          pan
        });
        navItemsArray.push({
          uniqueKey,
          element,
          index,
          section,
          xyz,
          zoom,
          pan
        });
      }
    });

    // Sort navigation items by section name (alphanumerically)
    // Items without section (using __index_ prefix) will be sorted by their index
    navItemsArray.sort((a, b) => {
      // If both have sections, sort alphabetically
      if (a.section && b.section) {
        return a.section.localeCompare(b.section);
      }
      // If only one has a section, prioritize it
      if (a.section) return -1;
      if (b.section) return 1;
      // If neither has a section, sort by original index
      return a.index - b.index;
    });

    // Rebuild this.navElements in sorted order so all index-based lookups
    // (autoplay, URL loading, highlight-only, etc.) match the nav-bar sequence
    this.navElements = navItemsArray.map(item => item.element);

    // Create navigation points for the unique, sorted items
    navItemsArray.forEach((item, sortedIndex) => {
      const navPoint = document.createElement('div');
      navPoint.className = 'nav-point';
      navPoint.setAttribute('data-nav-index', sortedIndex);
      // Add data-key to nav-points-container for validation
      if (item.element.hasAttribute('data-key')) {
        navPoint.setAttribute('activate', item.element.getAttribute('data-key'));
      }
      // Store section (first key) for reference
      if (item.element.hasAttribute('data-key')) {
        navPoint.setAttribute('section', (item.element.getAttribute('data-key') || '').split(',')[0].trim());
      }

      // Add click handler
      navPoint.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Focus container so keyboard controls work
        this.container.focus();

        // Update autoplay index so it continues from this position
        this.currentNavIndex = sortedIndex;

        if (!this._navigationSource) this._navigationSource = 'nav-bar';

        // Mark as navigation button click
        this.isNavButtonClick = true;

        // Navigate to position with the element for auto-highlight
        this.navigateToPosition(item.xyz, item.zoom, item.element, item.pan);
      });

      // Add keyboard handler for Enter
      navPoint.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          navPoint.click();
        }
      });

      navPointsContainer.appendChild(navPoint);
    });

    // Add keyboard navigation for tab key
    this.setupTabNavigation();
  }

  setupTabNavigation() {
    const navPoints = this.container.querySelectorAll('.nav-point');

    navPoints.forEach((point, index) => {
      // Prevent Space keyup from generating a synthetic click on the nav-point;
      // Space is handled globally by onKeyDown → resetToDefault().
      point.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
        }
      });

      point.addEventListener('keydown', (e) => {
        // Space always resets to default — prevent default so no click fires
        if (e.key === ' ') {
          e.preventDefault();
          // Don't stopPropagation — let it bubble to container's onKeyDown
          return;
        }

        let targetIndex = index;

        if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
          e.preventDefault();
          targetIndex = index > 0 ? index - 1 : -1;
        } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
          e.preventDefault();
          targetIndex = index < navPoints.length - 1 ? index + 1 : -1;
        }

        if (targetIndex === -1) {
          // Past first/last → reset to default (blur nav points, focus container)
          this.container.focus();
        } else if (targetIndex !== index) {
          navPoints[targetIndex].focus();
        }
      });
    });
  }

  resetToDefault(options = {}) {
    // Sanitize translation before animating
    const sanitizedTranslation = this.sanitizeTranslation(this.initialTranslation);
    
    // Animate smoothly to initial/home position
    this.smoothAnimateToWithPan(
      this.initialRotation,
      this.initialZoom,
      sanitizedTranslation
    );

    // Scroll to the container (top of the presentation) unless suppressed
    if (!options.skipScroll) {
      this.scrollToContainer();
    }

    // Clear URL completely (remove both query params and hash)
    const baseUrl = window.location.pathname;
    window.history.replaceState({}, '', baseUrl);

    // Mark as click navigation to prevent URL updates during animation
    this.isClickNavigation = true;
    clearTimeout(this.urlUpdateTimeout);

    // Update navigation bar to show default position as active
    this.setActiveNavPoint(-1);

    // Clear all highlights when resetting to default position
    this.clearHighlights();

    // Restart all animations for default view
    setTimeout(() => {
      this.startAllAnimations();
    }, 100);

    // Clear navigation source after all synchronous emits are done
    this._navigationSource = null;
  }

  setActiveNavPoint(activeIndex, skipUrlUpdate = false) {
    const navPoints = this.container.querySelectorAll('.nav-point');
    navPoints.forEach((point, index) => {
      const pointIndex = parseInt(point.getAttribute('data-nav-index'));
      if (pointIndex === activeIndex) {
        point.classList.add('active');
      } else {
        point.classList.remove('active');
      }
    });

    // Update URL with navigation index (skip when loading from URL to preserve query params)
    if (!skipUrlUpdate) {
      this.updateUrlWithNavIndex(activeIndex);
    }

    // Update nav-selected class on navigable elements
    this.updateNavSelectedElements(activeIndex);
  }

  /**
   * Update URL with navigation index and section anchor
   * Format: #section?prefix-nav=1 or ?prefix-nav=2
   * Omits ?prefix-nav=0 for the default/first item
   * Hash (#) comes before query string (?) when both are present
   * Clears manual adjustment parameters (xyz, zoom, pan) when navigating to a new point
   */
  updateUrlWithNavIndex(navIndex) {
    if (typeof window === 'undefined' || !window.history) return;

    const prefix = this.urlPrefix.replace('_', '');

    // Get section ID from the navigation element
    let sectionId = null;
    if (this.navElements && this.navElements[navIndex]) {
      const navElement = this.navElements[navIndex];

      // Check element itself for data-key (first key = scroll target)
      sectionId = (navElement.getAttribute('data-key') || '').split(',')[0].trim() || null;

      // If not found, check parent scene or cuboid
      if (!sectionId) {
        const parentScene = navElement.closest('.scene');
        const parentCuboid = navElement.closest('.cuboid');

        if (parentScene && parentScene.hasAttribute('data-key')) {
          sectionId = (parentScene.getAttribute('data-key') || '').split(',')[0].trim();
        } else if (parentCuboid && parentCuboid.hasAttribute('data-key')) {
          sectionId = (parentCuboid.getAttribute('data-key') || '').split(',')[0].trim();
        }
      }
    }

    // Build URL manually to ensure correct format (hash before query string)
    const baseUrl = window.location.origin + window.location.pathname;
    let newUrl = baseUrl;

    // Add hash if section found
    if (sectionId) {
      newUrl += '#' + sectionId;
    }

    // Add query parameters if needed (navIndex >= 0)
    // Convert 0-based internal index to 1-based URL index for users
    if (navIndex >= 0) {
      newUrl += '?' + `${prefix}-nav=${navIndex + 1}`;
    }

    // Update URL without reloading
    window.history.replaceState({}, '', newUrl);
  }

  updateNavSelectedElements(activeIndex) {
    // Get all navigable elements (cuboids, scenes, and faces with nav attributes)
    const navigableElements = this.container.querySelectorAll('.nav-clickable');

    // Remove nav-selected from all nav-clickable elements
    navigableElements.forEach(el => {
      el.classList.remove('nav-selected');
    });

    // Use the sorted navElements array for index lookup (matches nav-bar display order)
    const sortedNav = this.navElements;

    // If activeIndex is valid, add nav-selected to the appropriate element
    if (activeIndex >= 0 && sortedNav && activeIndex < sortedNav.length) {
      const activeElement = sortedNav[activeIndex];
      let targetElement = activeElement;

      // If navSelectedTarget is not 'clicked', try to find the target face
      if (this.navSelectedTarget !== 'clicked') {
        // Check if activeElement is a face (direction class)
        const directionClasses = ['top', 'bottom', 'front', 'back', 'left', 'right'];
        const isFaceElement = directionClasses.some(dir => activeElement.classList.contains(dir));

        // Find the parent cuboid or scene
        let parentCuboid = null;

        if (activeElement.classList.contains('cuboid')) {
          parentCuboid = activeElement;
        } else if (activeElement.classList.contains('scene')) {
          // If it's a scene, look for cuboids inside it
          parentCuboid = activeElement.querySelector('.cuboid');
        } else {
          // Otherwise, find the closest cuboid
          parentCuboid = activeElement.closest('.cuboid');
        }

        if (parentCuboid) {
          // Look for direct child face with the target direction class
          const targetFace = parentCuboid.querySelector(`:scope > .${this.navSelectedTarget}`);
          if (targetFace) {
            targetElement = targetFace;
          }
        }
      }

      // IMPORTANT: Only add nav-selected to elements that belong to the same scene as activeElement
      // This prevents issues when multiple elements share the same data-key across different scenes
      const activeElementScene = activeElement.classList.contains('scene')
        ? activeElement
        : activeElement.closest('.scene');
      const targetElementScene = targetElement.classList.contains('scene')
        ? targetElement
        : targetElement.closest('.scene');

      // Only add nav-selected if both elements are in the same scene
      if (activeElementScene !== targetElementScene) {
        targetElement = activeElement;
      }

      // Ensure the highlighted element has nav-clickable; fallback to the active element if needed
      let highlightElement = targetElement;
      if (!highlightElement.classList.contains('nav-clickable')) {
        const closestClickable = highlightElement.closest('.nav-clickable');
        if (closestClickable) {
          highlightElement = closestClickable;
        } else {
          const descendantClickable = highlightElement.querySelector?.('.nav-clickable');
          if (descendantClickable) {
            highlightElement = descendantClickable;
          }
        }
      }

      if (highlightElement && highlightElement.classList.contains('nav-clickable')) {
        highlightElement.classList.add('nav-selected');
      }

      // Emit navigation change event (with the originally clicked element)
      this.emit('navigationChange', {
        index: activeIndex,
        element: activeElement,
        navSelectedElement: targetElement,
        id: activeElement.id || null,
        key: (activeElement.getAttribute('data-key') || '').split(',')[0].trim() || activeElement.id || null,
        source: this._navigationSource || 'unknown'
      });
    } else {
      // Emit navigation change for deselection (index -1)
      this.emit('navigationChange', {
        index: -1,
        element: null,
        navSelectedElement: null,
        id: null,
        key: null,
        source: this._navigationSource || 'unknown'
      });
    }
  }

  /**
   * Toggle autoplay mode - cycles through navigation points automatically
   */
  toggleAutoPlay(highlightOnly) {
    if (this.isAutoPlaying) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay(highlightOnly);
    }
  }

  /**
   * Start autoplay - cycles through navigation points
   */
  startAutoPlay(highlightOnly) {
    if (!this.navElements || this.navElements.length === 0) {
      return; // No navigation points to autoplay
    }

    this.isAutoPlaying = true;
    this.emit('autoPlayChange', { playing: true });

    // Start the autoplay cycle
    this.advanceToNextNavPoint(highlightOnly);
  }

  /**
   * Stop autoplay
   */
  stopAutoPlay() {
    this.isAutoPlaying = false;
    this.emit('autoPlayChange', { playing: false });
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  /**
   * Advance to the next navigation point in autoplay mode
   */
  advanceToNextNavPoint(highlightOnly) {
    if (!this.navElements || this.navElements.length === 0) {
      return;
    }

    // Calculate next index
    // After last nav point, go to overview (index -1), then restart from 0
    if (this.currentNavIndex === this.navElements.length - 1) {
      // We're at the last nav point, go to overview
      this.currentNavIndex = -1;
    } else if (this.currentNavIndex === -1) {
      // We're at overview, restart from first nav point
      this.currentNavIndex = 0;
    } else {
      // Regular advancement
      this.currentNavIndex = this.currentNavIndex + 1;
    }

    if (this.currentNavIndex === -1) {
      // Navigate to overview (reset view or just clear highlights)
      this._navigationSource = 'autoplay';
      if (highlightOnly) {
        // Highlight-only mode: just clear highlights, don't change view
        this.navigateHighlightOnly(-1);
      } else {
        // Full mode: reset view
        this.resetView();
      }
    } else {
      // Get the navigation element and trigger navigation
      const navElement = this.navElements[this.currentNavIndex];
      if (navElement) {
        this._navigationSource = 'autoplay';
        if (highlightOnly) {
          // Highlight-only mode: update highlights without changing view
          this.navigateHighlightOnly(this.currentNavIndex);
        } else {
          // Full mode: navigate to position with view change
          const xyz = navElement.getAttribute('data-nav-xyz');
          const zoom = navElement.getAttribute('data-nav-zoom');
          const pan = navElement.getAttribute('data-nav-pan');

          // Navigate to position
          this.navigateToPosition(xyz, zoom, navElement, pan);
        }
      }
    }

    // Schedule next advancement
    this.autoPlayTimer = setTimeout(() => {
      this.advanceToNextNavPoint(highlightOnly);
    }, this.autoPlayInterval);
  }

  // Event system methods
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  off(eventName, callback) {
    if (!this.eventListeners[eventName]) return;
    this.eventListeners[eventName] = this.eventListeners[eventName].filter(cb => cb !== callback);
  }

  emit(eventName, data) {
    if (!this.eventListeners[eventName]) return;
    this.eventListeners[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventName} event listener:`, error);
      }
    });
  }

  /**
   * Get deduplicated navigation keys.
   * Collects data-key values from scenes, cuboids, and their descendants
   * (excluding navigation-specific elements with data-nav-xyz/zoom/pan),
   * plus connector group keys. Returns a flat, unique string array.
   * @returns {string[]}
   */
  getNavKeys() {
    const seen = new Set();

    // Collect data-key from all elements
    const perspective = this.container.querySelector('.isometric-perspective');
    if (perspective) {
      perspective.querySelectorAll('[data-key]').forEach(el => {
        const attr = el.getAttribute('data-key') || '';
        attr.split(',').map(k => k.trim()).filter(Boolean).forEach(k => seen.add(k));
      });
    }

    // Collect keys from connector groups
    if (this.connectors) {
      this.connectors.forEach(connector => {
        let groups = connector.groups || connector.keys || (connector.key ? [connector.key] : []);
        if (typeof groups === 'string') {
          groups = groups.split(',').map(k => k.trim());
        }
        groups.filter(Boolean).forEach(k => seen.add(k));
      });
    }

    return [...seen];
  }

  // Navigate to element by ID or data-key attribute
  navigateByKey(key) {
    const navigableElements = this.container.querySelectorAll('.nav-clickable');

    // Try to find element by ID first
    let targetElement = this.container.querySelector(`#${key}`);

    // If not found by ID, try data-key attribute (check first key in comma-separated values)
    if (!targetElement || !targetElement.classList.contains('nav-clickable')) {
      targetElement = this.container.querySelector(`[data-key="${key}"]`) ||
        this.container.querySelector(`[data-key^="${key},"]`);
    }

    // If still not found, try to find a child with nav-clickable class
    if (targetElement && !targetElement.classList.contains('nav-clickable')) {
      const childElement = targetElement.querySelector('.nav-clickable');
      if (childElement) {
        targetElement = childElement;
      }
    }

    if (targetElement && targetElement.classList.contains('nav-clickable')) {
      // Get navigation data from element
      const xyz = targetElement.getAttribute('data-nav-xyz');
      const zoom = targetElement.getAttribute('data-nav-zoom');
      const pan = targetElement.getAttribute('data-nav-pan');

      // Find index for updating nav bar (use sorted navElements for correct display order)
      const index = this.navElements ? Array.from(this.navElements).indexOf(targetElement) : -1;
      if (index !== -1) {
        this.setActiveNavPoint(index);
      }

      // Navigate to the position with the element for auto-highlight
      this.navigateToPosition(xyz, zoom, targetElement, pan);
      return true;
    }

    console.warn(`Navigation target not found for key: ${key}`);
    return false;
  }

  addEventListeners() {
    // Get the isometric-perspective element for drag restriction
    const perspective = this.container.querySelector('.isometric-perspective');

    // Mouse events - only on perspective element and its children
    if (perspective) {
      perspective.addEventListener('mousedown', this.onMouseDown);
    }
    this.container.addEventListener('mouseup', this.onMouseUp);

    // Store mousemove handler for dynamic attachment
    this.mouseMoveHandler = this.onMouseMove.bind(this);

    // Mouse wheel on the container: rotate / zoom / pan (does NOT scroll the page)
    this.container.addEventListener('wheel', this.onWheel, { passive: false });

    // Touch events for mobile - only on perspective
    if (perspective) {
      perspective.addEventListener('touchstart', this.onTouchStart, { passive: false });
      perspective.addEventListener('touchmove', this.onTouchMove, { passive: false });
      perspective.addEventListener('touchend', this.onTouchEnd, { passive: false });
    }

    // Keyboard events - only when focused!
    this.container.addEventListener('keydown', this.onKeyDown);
    this.container.addEventListener('focus', this.onFocus);
    this.container.addEventListener('blur', this.onBlur);

    // Prevent context menu on right click
    this.container.addEventListener('contextmenu', e => e.preventDefault());

    // Click events - focus container and handle non-navigation clicks
    this.container.addEventListener('click', (e) => {
      // Don't focus if clicking on compact controls or navigation elements
      if (!e.target.closest('.compact-controls') && !e.target.closest('.nav-clickable')) {
        this.container.focus();
      }

      // Check if clicked element or its parent scene has data-focus="center"
      const clickedElement = e.target;
      let focusElement = null;

      // Check if the clicked element itself has data-focus="center"
      if (clickedElement.getAttribute('data-focus') === 'center') {
        focusElement = clickedElement;
      } else {
        // Check if it's a face inside a scene with data-focus="center"
        const parentScene = clickedElement.closest('.scene');
        if (parentScene && parentScene.getAttribute('data-focus') === 'center') {
          focusElement = parentScene;
        }
      }

      // Center on the element (or group of elements with matching keys) if it has the focus attribute
      if (focusElement) {
        const focusKeyAttr = focusElement.getAttribute('data-key');
        const focusKeys = focusKeyAttr ? focusKeyAttr.split(',').map(k => k.trim()) : null;
        this.centerOnElement(focusElement, focusKeys);
      }

      // The navigation clicks are now handled directly by setupNavigationEffects
      // This handler is only for focusing the container and handling focus centering
    });

    // Window resize listener for label repositioning
    this.resizeHandler = () => {
      setTimeout(() => this.updateLabelPositions(), 100);
    };
    window.addEventListener('resize', this.resizeHandler);

    // Listen for URL changes (browser back/forward and hash changes)
    this.popstateHandler = () => {
      this.loadFromUrl();
    };
    this.hashchangeHandler = () => {
      this.loadFromUrl();
    };

    window.addEventListener('popstate', this.popstateHandler);
    window.addEventListener('hashchange', this.hashchangeHandler);
  }

  createCompactControls() {
    // Create compact controls element
    const compactControls = document.createElement('div');
    compactControls.className = 'compact-controls';

    // Create control items with specific IDs for this instance - modern spherical controller
    compactControls.innerHTML = `
      <div class="modifier-info" id="${this.containerId}-modifier-info"></div>
      <div class="control-sphere">
        <div class="sphere-container">
          <div class="direction-indicator up" id="${this.containerId}-indicator-up"></div>
          <div class="direction-indicator down" id="${this.containerId}-indicator-down"></div>
          <div class="direction-indicator left" id="${this.containerId}-indicator-left"></div>
          <div class="direction-indicator right" id="${this.containerId}-indicator-right"></div>
          <div class="center-dot" id="${this.containerId}-center-dot"></div>
        </div>
        <button class="help-button">?</button>
      </div>
      <div class="keyboard-help">
        <h3>Controls</h3>
        <div class="key-mapping">
          <span>🖱️ <strong>Left drag</strong></span>
          <span>X/Z-Axis rotation</span>
        </div>
        <div class="key-mapping">
          <span>🖱️ <strong>Middle drag</strong></span>
          <span>Pan view</span>
        </div>
        <div class="key-mapping">
          <span>🖱️ <strong>Right drag</strong></span>
          <span>Y-Axis rotation<br>+ zoom</span>
        </div>
        <div class="key-mapping">
          <span>🖱️ <strong>Wheel</strong></span>
          <span>X-Axis rotation</span>
        </div>
        <div class="key-mapping">
          <span>🖱️ <strong>Shift+Wheel</strong></span>
          <span>Zoom in/out</span>
        </div>
        <div class="key-mapping">
          <span>🖱️ <strong>Shift+drag</strong></span>
          <span>Y-Axis rotation<br>+ zoom</span>
        </div>
        <div class="key-mapping">
          <span>🖱️ <strong>Alt+Wheel</strong></span>
          <span>Pan up/down</span>
        </div>
        <div class="key-mapping">
          <span>🖱️ <strong>Alt+drag</strong></span>
          <span>Pan view</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">←</span> <span class="key">→</span></span>
          <span>Z-Axis rotation</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">↑</span> <span class="key">↓</span></span>
          <span>X-Axis rotation</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Shift</span>+<span class="key">←</span> <span class="key">→</span></span>
          <span>Y-Axis rotation</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Shift</span>+<span class="key">↑</span> <span class="key">↓</span></span>
          <span>Zoom in/out</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Alt</span>+<span class="key">←</span> <span class="key">→</span> <span class="key">↑</span> <span class="key">↓</span></span>
          <span>Pan view</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Space</span></span>
          <span>Reset to initial view</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Tab</span></span>
          <span>Navigate to next point</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Shift</span>+<span class="key">Tab</span></span>
          <span>Navigate to previous point</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Alt</span>+<span class="key">Tab</span></span>
          <span>Cycle highlights only<br>(keep view position)</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">Alt</span>+<span class="key">Shift</span>+<span class="key">Tab</span></span>
          <span>Cycle highlights backwards<br>(keep view position)</span>
        </div>
        <div class="key-mapping">
          <span><span class="key">P</span></span>
          <span>Auto-play navigation points (toggle)</span>
        </div>
      </div>
    `;

    // Append to the container
    this.container.appendChild(compactControls);

    // Add event listener for help button
    const helpButton = compactControls.querySelector('.help-button');
    const keyboardHelp = compactControls.querySelector('.keyboard-help');

    if (helpButton && keyboardHelp) {
      helpButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        keyboardHelp.classList.toggle('show');
      });

      // Also add pointer events to ensure button is clickable
      helpButton.style.pointerEvents = 'auto';
    } else {
      console.error('❌ Failed to find help button or keyboard help panel in:', this.containerId);
    }

    // Spherical controller: direction click handlers
    const directionMap = [
      { id: 'up',    axis: 'x', delta: -15 },
      { id: 'down',  axis: 'x', delta: +15 },
      { id: 'left',  axis: 'z', delta: -15 },
      { id: 'right', axis: 'z', delta: +15 }
    ];

    directionMap.forEach(({ id, axis, delta }) => {
      const el = compactControls.querySelector(`#${this.containerId}-indicator-${id}`);
      if (!el) return;
      el.style.cursor = 'pointer';
      el.style.pointerEvents = 'auto';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('pressed');
        setTimeout(() => el.classList.remove('pressed'), 200);
        const limits = this.rotationLimits[axis];
        const clamped = Math.max(limits.min, Math.min(limits.max, this.currentRotation[axis] + delta));
        this.smoothAnimateTo({ ...this.currentRotation, [axis]: clamped }, this.currentZoom, 500);
      });
    });

    // Center dot - reset to (0,0,0)
    const centerDot = compactControls.querySelector(`#${this.containerId}-center-dot`);
    if (centerDot) {
      centerDot.style.cursor = 'pointer';
      centerDot.style.pointerEvents = 'auto';
      centerDot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.animateTranslation(0, 0, 0);
        this.smoothAnimateTo({ x: 0, y: 0, z: 0 }, this.currentZoom, 500);
      });
    }

    // Setup modifier key info display
    this.setupModifierKeyInfo();
  }

  setupModifierKeyInfo() {
    const modifierInfo = this.container.querySelector(`#${this.containerId}-modifier-info`);
    if (!modifierInfo) return;

    // Show keyboard hint when hovering but not focused
    const showKeyboardHint = () => {
      if (document.activeElement !== this.container) {
        modifierInfo.innerHTML = 'Click to enable keyboard controls ⌨️';
        modifierInfo.classList.add('keyboard-hint');
        modifierInfo.classList.add('active');
      }
    };

    const hideKeyboardHint = () => {
      if (modifierInfo.classList.contains('keyboard-hint')) {
        modifierInfo.classList.remove('keyboard-hint');
        modifierInfo.classList.remove('active');
        modifierInfo.innerHTML = '';
      }
    };

    // Track modifier key state
    const updateModifierInfo = (e) => {
      // Don't update if showing keyboard hint
      if (modifierInfo.classList.contains('keyboard-hint')) return;

      const modifiers = [];

      if (e.shiftKey) {
        modifiers.push({
          key: 'Shift',
          action: 'Y-Axis rotation <span class="key">←</span><span class="key">→</span> / Zoom <span class="key">↑</span><span class="key">↓</span>'
        });
      }

      if (e.altKey) {
        modifiers.push({
          key: 'Alt',
          action: 'Pan view'
        });
      }

      if (modifiers.length > 0) {
        const infoText = modifiers.map(m => `<strong>${m.key}:</strong> ${m.action}`).join(' | ');
        modifierInfo.innerHTML = infoText;
        modifierInfo.classList.add('active');
      } else {
        modifierInfo.innerHTML = '';
        modifierInfo.classList.remove('active');
      }
    };

    // Show/hide keyboard hint on hover
    const compactControls = this.container.querySelector('.compact-controls');
    if (compactControls) {
      compactControls.addEventListener('mouseenter', showKeyboardHint);
      compactControls.addEventListener('mouseleave', hideKeyboardHint);
    }

    // Listen to keydown/keyup on the container
    this.container.addEventListener('keydown', updateModifierInfo);
    this.container.addEventListener('keyup', updateModifierInfo);

    // Also listen globally to catch modifiers pressed outside
    document.addEventListener('keydown', (e) => {
      if (document.activeElement === this.container || this.container.contains(document.activeElement)) {
        updateModifierInfo(e);
      }
    });

    document.addEventListener('keyup', (e) => {
      if (document.activeElement === this.container || this.container.contains(document.activeElement)) {
        updateModifierInfo(e);
      }
    });

    // Hide keyboard hint and clear on focus
    this.container.addEventListener('focus', () => {
      hideKeyboardHint();
    });

    // Clear on blur
    this.container.addEventListener('blur', () => {
      modifierInfo.innerHTML = '';
      modifierInfo.classList.remove('active');
      modifierInfo.classList.remove('keyboard-hint');
    });
  }

  removeEventListeners() {
    const perspective = this.container.querySelector('.isometric-perspective');

    if (perspective) {
      perspective.removeEventListener('mousedown', this.onMouseDown);
      perspective.removeEventListener('touchstart', this.onTouchStart);
      perspective.removeEventListener('touchmove', this.onTouchMove);
      perspective.removeEventListener('touchend', this.onTouchEnd);
    }

    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);

    this.container.removeEventListener('keydown', this.onKeyDown);
    this.container.removeEventListener('focus', this.onFocus);
    this.container.removeEventListener('blur', this.onBlur);

    this.container.removeEventListener('contextmenu', e => e.preventDefault());

    // Remove window event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
    }
    if (this.hashchangeHandler) {
      window.removeEventListener('hashchange', this.hashchangeHandler);
    }

    // Stop autoplay if active
    this.stopAutoPlay();

    // Cancel any pending animation frames
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.keyboardAnimationFrameId) {
      cancelAnimationFrame(this.keyboardAnimationFrameId);
      this.keyboardAnimationFrameId = null;
    }
  }

  onFocus() {
    const viewport = this.container.closest('.isometric-viewport');
    if (viewport) {
      viewport.style.borderColor = '#0078d4';
    }
  }

  onBlur() {
    const viewport = this.container.closest('.isometric-viewport');
    if (viewport) {
      viewport.style.borderColor = '';
    }

    // Cancel any pending keyboard animation frames when focus is lost
    if (this.keyboardAnimationFrameId) {
      cancelAnimationFrame(this.keyboardAnimationFrameId);
      this.keyboardAnimationFrameId = null;
    }
  }

  updateScene() {
    const scene = this.container.querySelector('.isometric-perspective');
    if (!scene) return;

    // Batch DOM updates to prevent flicker
    const transform = `translate(-50%, -50%) translate3d(${this.currentTranslation.x}px, ${this.currentTranslation.y}px, ${this.currentTranslation.z}px) scale(${this.currentZoom}) rotateX(${this.currentRotation.x}deg) rotateY(${this.currentRotation.y}deg) rotateZ(${this.currentRotation.z}deg)`;

    // Use will-change CSS property for better performance during dragging
    if (this.isDragging && scene.style.willChange !== 'transform') {
      scene.style.willChange = 'transform';
    } else if (!this.isDragging && scene.style.willChange === 'transform') {
      scene.style.willChange = 'auto';
    }

    // Update transform only if it has changed
    if (scene.style.transform !== transform) {
      scene.style.transform = transform;
    }

    // Set positioning properties only if not already set
    if (scene.style.left !== '50%') scene.style.left = '50%';
    if (scene.style.top !== '50%') scene.style.top = '50%';
    if (scene.style.position !== 'absolute') scene.style.position = 'absolute';

    // Emit scene update event
    this.emit('sceneUpdate', {
      rotation: { ...this.currentRotation },
      zoom: this.currentZoom,
      translation: { ...this.currentTranslation },
      container: {
        width: this.container.offsetWidth,
        height: this.container.offsetHeight
      },
      perspective: scene ? {
        width: scene.offsetWidth,
        height: scene.offsetHeight
      } : null
    });

    // Update display values
    this.updateDisplayValues();

    // Update label positions only if not animating and not dragging (to avoid flicker)
    if (!this.isAnimating && !this.isDragging) {
      clearTimeout(this.labelUpdateTimeout);
      this.labelUpdateTimeout = setTimeout(() => this.updateLabelPositions(), 50); // Small delay to ensure transforms are applied
    }

    // Queue URL update to avoid too frequent updates (but skip if navigating via click)
    if (!this.isClickNavigation) {
      clearTimeout(this.urlUpdateTimeout);
      this.urlUpdateTimeout = setTimeout(() => this.updateUrlWithRotation(), 3000);
    }
  }

  updateDisplayValues() {
    // Update arrow indicators based on current rotation position
    const upIndicator = this.container.querySelector(`#${this.containerId}-indicator-up`);
    const downIndicator = this.container.querySelector(`#${this.containerId}-indicator-down`);
    const leftIndicator = this.container.querySelector(`#${this.containerId}-indicator-left`);
    const rightIndicator = this.container.querySelector(`#${this.containerId}-indicator-right`);

    if (upIndicator && downIndicator && leftIndicator && rightIndicator) {
      // Calculate normalized positions (-1 to 1) from center
      const xNorm = (this.currentRotation.x) / Math.max(Math.abs(this.rotationLimits.x.min), Math.abs(this.rotationLimits.x.max));
      const zNorm = (this.currentRotation.z) / Math.max(Math.abs(this.rotationLimits.z.min), Math.abs(this.rotationLimits.z.max));

      // Reset all indicators
      [upIndicator, downIndicator, leftIndicator, rightIndicator].forEach(indicator => {
        indicator.classList.remove('active', 'partial');
      });

      // X-axis indicators (up/down arrows for pitch)
      if (Math.abs(xNorm) > 0.1) { // Only show if significantly off center
        if (xNorm > 0) {
          downIndicator.classList.add(Math.abs(xNorm) > 0.5 ? 'active' : 'partial');
        } else {
          upIndicator.classList.add(Math.abs(xNorm) > 0.5 ? 'active' : 'partial');
        }
      }

      // Z-axis indicators (left/right arrows for yaw)
      if (Math.abs(zNorm) > 0.1) { // Only show if significantly off center
        if (zNorm > 0) {
          rightIndicator.classList.add(Math.abs(zNorm) > 0.5 ? 'active' : 'partial');
        } else {
          leftIndicator.classList.add(Math.abs(zNorm) > 0.5 ? 'active' : 'partial');
        }
      }
    }
  }

  updateLabelPositions() {
    // Update label positions based on cube and rectangle positions within this container
    const labels = this.container.querySelectorAll('.label[data-cube]');

    labels.forEach((label) => {
      const cubeId = label.getAttribute('data-cube');
      const position = label.getAttribute('data-position') || 'right'; // default to right

      // Try to find element by ID (could be cube, rectangle, or any element)
      let targetElement = document.getElementById(cubeId);

      // If not found by ID, try to find within this container
      if (!targetElement) {
        targetElement = this.container.querySelector(`#${cubeId}, .cube#${cubeId}, .rectangle#${cubeId}, [id="${cubeId}"]`);
      }

      if (targetElement) {
        const containerRect = this.container.getBoundingClientRect();
        const elementRect = targetElement.getBoundingClientRect();

        // Make sure label is visible first by setting a temporary position
        label.style.visibility = 'visible';
        label.style.display = 'block';

        // Get label dimensions after making it visible
        const labelRect = label.getBoundingClientRect();

        let newLeft, newTop;
        const offset = 10; // Small gap between element and label

        // Calculate position relative to container (not global viewport)
        const elementLeftRelative = elementRect.left - containerRect.left;
        const elementTopRelative = elementRect.top - containerRect.top;

        switch (position) {
          case 'left':
            // Position label to the left of element with gap
            newLeft = elementLeftRelative - labelRect.width - offset;
            newTop = elementTopRelative + (elementRect.height / 2) - (labelRect.height / 2);
            break;

          case 'right':
            // Position label to the right of element with gap
            newLeft = elementLeftRelative + elementRect.width + offset;
            newTop = elementTopRelative + (elementRect.height / 2) - (labelRect.height / 2);
            break;

          case 'top':
            // Position label above element with gap
            newLeft = elementLeftRelative + (elementRect.width / 2) - (labelRect.width / 2);
            newTop = elementTopRelative - labelRect.height - offset;
            break;

          case 'bottom':
            // Position label below element with gap
            newLeft = elementLeftRelative + (elementRect.width / 2) - (labelRect.width / 2);
            newTop = elementTopRelative + elementRect.height + offset;
            break;

          default:
            // Default to right positioning
            newLeft = elementLeftRelative + elementRect.width + offset;
            newTop = elementTopRelative + (elementRect.height / 2) - (labelRect.height / 2);
        }

        label.style.left = `${newLeft}px`;
        label.style.top = `${newTop}px`;
      }
    });
  }

  handleNavigationClick(element) {
    // Look for navigation data on the clicked element or its parents
    let targetElement = element;
    let navData = null;
    let autoHighlightKeys = null;

    // Search up the DOM tree for navigation data
    while (targetElement && targetElement !== this.container) {
      const xyz = targetElement.getAttribute('data-nav-xyz');
      const zoom = targetElement.getAttribute('data-nav-zoom');
      const pan = targetElement.getAttribute('data-nav-pan');
      const autoHighlight = targetElement.getAttribute('data-key');

      if (xyz || zoom || pan) {
        navData = { xyz, zoom, pan, element: targetElement };
        autoHighlightKeys = autoHighlight;
        break;
      }

      targetElement = targetElement.parentElement;
    }

    if (navData) {
      this.navigateToPosition(navData.xyz, navData.zoom, navData.element, navData.pan);
    }
    // Removed default reset behavior - only navigate if navigation data is found
  }

  /**
   * Navigate to a navigation point's highlights without changing the view position
   * This updates the active nav point and applies highlights but keeps xyz, zoom, and pan unchanged
   * @param {number} navIndex - The index of the navigation point to highlight (-1 for default/overview)
   */
  navigateHighlightOnly(navIndex) {
    // Update the current navigation index
    this.currentNavIndex = navIndex;

    // Update active nav point in the UI
    this.setActiveNavPoint(navIndex);

    // Handle default position (index -1) - clear all highlights
    if (navIndex === -1) {
      const allHighlighted = this.container.querySelectorAll('.highlighted');
      allHighlighted.forEach(el => el.classList.remove('highlighted'));

      // Redraw debug rectangles to show no selection
      if (this.showDebug) {
        this.drawDebugActivateRects();
      }
      return;
    }

    // Get the navigation element
    const navElement = this.navElements[navIndex];
    if (!navElement) {
      console.warn(`Navigation element not found for index: ${navIndex}`);
      return;
    }

    // Handle auto-highlight if the element has data-key
    let autoHighlightKeys = navElement.getAttribute('data-key');
    let sourceScene = navElement.closest('.scene');

    // If not found on the element itself, check parent scene
    if (!autoHighlightKeys && sourceScene) {
      autoHighlightKeys = sourceScene.getAttribute('data-key');
    }

    if (autoHighlightKeys) {
      const keys = autoHighlightKeys.split(',').map(k => k.trim());
      this.highlightByKey(keys);

      // Also ensure the source scene/cuboid itself is highlighted, but only if it has no highlighted faces
      if (sourceScene) {
        const hasHighlightedFaces = sourceScene.querySelectorAll('.front.highlighted, .back.highlighted, .left.highlighted, .right.highlighted, .top.highlighted, .bottom.highlighted').length > 0;
        if (!hasHighlightedFaces) {
          sourceScene.classList.add('highlighted');
        }
      }
    } else {
      // If no data-key, clear all highlights
      const allHighlighted = this.container.querySelectorAll('.highlighted');
      allHighlighted.forEach(el => el.classList.remove('highlighted'));
    }

    // Redraw debug rectangles to show the selection
    if (this.showDebug) {
      this.drawDebugActivateRects();
    }

    // Clear navigation source after all synchronous emits are done
    this._navigationSource = null;
  }

  navigateToPosition(xyzString, zoomString, sourceElement = null, panString = null, onComplete = null, skipUrlUpdate = false) {
    const targetRotation = { ...this.currentRotation };
    let targetZoom = this.currentZoom;

    // If sourceElement is provided (click navigation), default to 0,0,0 unless pan is specified or "current"
    // If no sourceElement (manual navigation), maintain current position
    let targetTranslation = sourceElement ? { x: 0, y: 0, z: 0 } : { ...this.currentTranslation };

    // Parse xyz string (e.g., "35.0.15" or "current" to keep current rotation, or "center" for auto-calculated centering)
    if (xyzString && xyzString !== 'current' && xyzString !== 'center') {
      const parts = xyzString.split('.');
      // Map each part, ensuring we always have 3 values (fill missing with 0)
      const [x = 0, y = 0, z = 0] = parts.map(v => {
        const parsed = parseFloat(v);
        return isNaN(parsed) ? 0 : parsed;
      });
      targetRotation.x = x;
      targetRotation.y = y;
      targetRotation.z = z;
    }
    // If xyzString is "current", "center", or not provided, targetRotation already has current values
    // If xyzString is "current" or not provided, targetRotation already has current values

    // Parse zoom string (e.g., "2.3" or "current" to keep current zoom)
    if (zoomString && zoomString !== 'current') {
      targetZoom = parseFloat(zoomString) || this.defaultZoom;
    }
    // If zoomString is "current" or not provided, targetZoom already has current value

    // Parse pan string (e.g., "100,-50", "current", or "default") - overrides auto-centering
    if (panString === 'current') {
      // Explicitly keep current translation
      targetTranslation = { ...this.currentTranslation };
    } else if (panString === 'default') {
      // Use the default/initial pan position
      targetTranslation = { ...this.defaultTranslation };
    } else if (panString && panString !== 'current' && panString !== 'default') {
      // Explicit numeric pan values (dot-separated: x.y)
      const parts = panString.split('.');
      const [x = 0, y = 0] = parts.map(v => {
        const parsed = parseFloat(v);
        return isNaN(parsed) ? 0 : parsed;
      });
      targetTranslation.x = x;
      targetTranslation.y = y;
      // Keep z from existing translation
      targetTranslation.z = targetTranslation.z || 0;
    } else if (sourceElement) {
      // Auto-calculate pan (and optionally zoom) when pan is not explicitly defined
      let elementToCenter = sourceElement;

      // If it's a face (not a scene itself), find the parent scene
      if (sourceElement.classList.contains('face')) {
        const parentScene = sourceElement.closest('.scene');
        if (parentScene) {
          elementToCenter = parentScene;
        }
      }

      // Extract highlight keys for group bounding-box centering/fitting
      let centeringKeys = null;
      const keyAttr = sourceElement.getAttribute('data-key') ||
        (sourceElement.closest('.scene')?.getAttribute('data-key'));
      if (keyAttr) {
        centeringKeys = keyAttr.split(',').map(k => k.trim());
      }

      if (!zoomString && centeringKeys) {
        // Auto-fit: no explicit zoom — rotate to default, zoom+pan to fit group at ~80%
        targetRotation.x = this.defaultRotation.x;
        targetRotation.y = this.defaultRotation.y;
        targetRotation.z = this.defaultRotation.z;

        const fitResult = this.calculateFitZoomAndPan(elementToCenter, targetRotation, centeringKeys);
        if (fitResult) {
          targetZoom = fitResult.zoom;
          targetTranslation = fitResult.translation;
          console.log(`[navigateToPosition] auto-fit key=[${centeringKeys}] -> zoom=${targetZoom.toFixed(3)} pan=(${targetTranslation.x.toFixed(1)},${targetTranslation.y.toFixed(1)}) rotation=(${targetRotation.x},${targetRotation.y},${targetRotation.z})`);
        } else {
          // Fallback: pan-only centering at current zoom
          targetTranslation = this.calculateCenterPan(elementToCenter, targetRotation, targetZoom, centeringKeys);
          console.log(`[navigateToPosition] auto-fit FALLBACK key=[${centeringKeys}] -> pan-only=(${targetTranslation.x.toFixed(1)},${targetTranslation.y.toFixed(1)})`);
        }
      } else {
        // Explicit zoom provided (or no keys) — pan-only centering
        targetTranslation = this.calculateCenterPan(elementToCenter, targetRotation, targetZoom, centeringKeys);
      }
    }

    // Check if source element has data-key for hash-based navigation (first key = scroll target)
    let targetHash = null;
    if (sourceElement) {
      targetHash = (sourceElement.getAttribute('data-key') || '').split(',')[0].trim() || null;
      // If not on element itself, check parent scene
      if (!targetHash) {
        const parentScene = sourceElement.closest('.scene');
        if (parentScene) {
          targetHash = (parentScene.getAttribute('data-key') || '').split(',')[0].trim() || null;
        }
      }
    }

    // Update URL based on navigation type
    if (!skipUrlUpdate) {
      if (this.isNavButtonClick) {
        // For nav button clicks: ONLY add nav index, nothing else
        const prefix = this.urlPrefix.replace('_', '');
        const navIndex = this.currentNavIndex;

        if (navIndex !== null && navIndex !== undefined) {
          // Convert to 1-based index for URL
          const urlIndex = navIndex + 1;
          const baseUrl = window.location.pathname;
          window.history.replaceState({}, '', `${baseUrl}?${prefix}-nav=${urlIndex}`);
        }

        // Cancel any pending query param updates
        clearTimeout(this.urlUpdateTimeout);
        this.isClickNavigation = true;
        this.isNavButtonClick = false; // Reset flag

        // Reset manual pan flag when navigating via nav button
        this.hasManualPanAdjustment = false;
      } else if (targetHash) {
        // For other navigation (e.g., clicking faces): use hash/section
        const baseUrl = window.location.pathname;
        window.history.replaceState({}, '', `${baseUrl}#${targetHash}`);
        // Cancel any pending query param updates and mark as click navigation
        clearTimeout(this.urlUpdateTimeout);
        this.isClickNavigation = true;
        // Reset manual pan flag
        this.hasManualPanAdjustment = false;
      }
    }

    // Update navigation bar to match the target position
    // Pass sourceElement so we know which specific element was clicked
    this.syncNavigationBar(xyzString, zoomString, panString, sourceElement);

    // Handle auto-highlight if source element is provided
    if (sourceElement) {
      // Check face first, then parent scene for activate groups
      let autoHighlightKeys = sourceElement.getAttribute('data-key');
      let sourceScene = sourceElement.closest('.scene');

      // If not found on the element itself, check parent scene
      if (!autoHighlightKeys && sourceScene) {
        autoHighlightKeys = sourceScene.getAttribute('data-key');
      }

      if (autoHighlightKeys) {
        const keys = autoHighlightKeys.split(',').map(k => k.trim());
        this.highlightByKey(keys);

        // Also ensure the source scene/cuboid itself is highlighted, but only if it has no highlighted faces
        if (sourceScene) {
          const hasHighlightedFaces = sourceScene.querySelectorAll('.front.highlighted, .back.highlighted, .left.highlighted, .right.highlighted, .top.highlighted, .bottom.highlighted').length > 0;
          if (!hasHighlightedFaces) {
            sourceScene.classList.add('highlighted');
          }
        }
      } else {
        // No highlight-keys found, clear all highlights
        this.clearHighlights();
      }
    } else {
      // No source element provided, clear highlights
      this.clearHighlights();
    }

    // IMPORTANT: Highlight all elements with the same data-key AFTER all other highlight
    // This ensures section-based highlights aren't cleared by highlightByKey()
    if (targetHash && sourceElement) {
      // Clear previous section-based highlights before adding new ones
      const allPreviousHighlights = this.container.querySelectorAll('.highlight');
      allPreviousHighlights.forEach(el => el.classList.remove('highlight'));

      // Query for data-key attributes (match first key in comma-separated values)
      const elementsWithSameId = this.container.querySelectorAll(
        `[data-key="${targetHash}"], [data-key^="${targetHash},"]`
      );
      const scenesWithHighlightedFaces = new Set();

      // First pass: highlight elements and track scenes with highlighted faces
      elementsWithSameId.forEach(el => {
        if (el.classList.contains('scene')) {
          // Scene will be highlighted in second pass if it has no highlighted faces
        } else {
          // If it's a face or other element, add highlight to it
          el.classList.add('highlight');

          // Track parent scene to prevent double highlight
          const parentScene = el.closest('.scene');
          if (parentScene) {
            scenesWithHighlightedFaces.add(parentScene);
          }
        }
      });

      // Second pass: highlight scenes only if they don't have highlighted faces
      elementsWithSameId.forEach(el => {
        if (el.classList.contains('scene') && !scenesWithHighlightedFaces.has(el)) {
          el.classList.add('highlight');
        }
      });
    }

    // Sanitize translation before animating
    targetTranslation = this.sanitizeTranslation(targetTranslation);

    // Detect whether this is a "large" transition that needs two-phase animation
    // to avoid erratic intermediate frames from independent zoom/pan/rotation interpolation
    const zoomRatio = Math.max(this.currentZoom, targetZoom) / Math.min(this.currentZoom, targetZoom);
    const rotationDelta = Math.max(
      Math.abs(this.currentRotation.x - targetRotation.x),
      Math.abs(this.currentRotation.y - targetRotation.y),
      Math.abs(this.currentRotation.z - targetRotation.z)
    );
    const panDelta = Math.sqrt(
      Math.pow(this.currentTranslation.x - targetTranslation.x, 2) +
      Math.pow(this.currentTranslation.y - targetTranslation.y, 2)
    );

    // Check if source element opts out of two-phase via data-nav-transition="direct"
    const forceDirectTransition = sourceElement &&
      sourceElement.getAttribute('data-nav-transition') === 'direct';

    // Scale the pan threshold by the max zoom to avoid spurious two-phase at high zoom
    // (at zoom 2 everything is 2× farther apart, so pan changes are naturally larger)
    const effectiveMaxZoom = Math.max(this.currentZoom, targetZoom, 1);
    const scaledPanThreshold = 200 * effectiveMaxZoom;

    const isLargeTransition = !forceDirectTransition && (
      zoomRatio > 1.3 || rotationDelta > 30 || panDelta > scaledPanThreshold
    );

    if (isLargeTransition) {
      // Two-phase animation: current → neutral → target
      // Phase 1 zooms out to a safe neutral level and centers on the TARGET element;
      // Phase 2 zooms to the final level — element stays centered because pan/zoom are proportional.
      const neutralZoom = Math.max(
        this.defaultZoom * 0.9,
        Math.min(this.currentZoom, targetZoom)
      );
      // Compute neutral pan that centers the TARGET element at the neutral zoom.
      // Since centering pan is proportional to zoom (pan = zoom * C, where C is the
      // element's pre-scale offset from center), we scale the target pan by the zoom ratio.
      // This ensures phase 2 starts centered on the target, so zoom and pan stay
      // coupled throughout the animation (no off-center intermediate frames).
      const zoomScale = targetZoom > 0 ? neutralZoom / targetZoom : 1;
      const neutralTranslation = {
        x: targetTranslation.x * zoomScale,
        y: targetTranslation.y * zoomScale,
        z: 0
      };
      // Keep current rotation in phase 1 — it transitions smoothly across both phases
      const neutralRotation = { ...this.currentRotation };

      console.log(`[navigateToPosition] TWO-PHASE: zoomRatio=${zoomRatio.toFixed(2)} rotDelta=${rotationDelta.toFixed(1)}° panDelta=${panDelta.toFixed(0)}px | phase1→zoom=${neutralZoom.toFixed(2)} pan=(${neutralTranslation.x.toFixed(1)},${neutralTranslation.y.toFixed(1)}) | phase2→zoom=${targetZoom.toFixed(2)} pan=(${targetTranslation.x.toFixed(1)},${targetTranslation.y.toFixed(1)})`);

      this.smoothAnimateToWithPan(neutralRotation, neutralZoom, neutralTranslation, 600, () => {
        // Phase 2: neutral → target
        this.smoothAnimateToWithPan(targetRotation, targetZoom, targetTranslation, 600, onComplete);
      });
    } else {
      // Single-phase direct animation (small transition — current behavior)
      console.log(`[navigateToPosition] DIRECT: zoomRatio=${zoomRatio.toFixed(2)} rotDelta=${rotationDelta.toFixed(1)}° panDelta=${panDelta.toFixed(0)}px`);
      this.smoothAnimateToWithPan(targetRotation, targetZoom, targetTranslation, 1200, onComplete);
    }

    // Clear navigation source after all synchronous emits are done
    this._navigationSource = null;
  }

  syncNavigationBar(xyzString, zoomString, panString, sourceElement = null) {
    // Find the navigation element that matches this position
    // Use the sorted navElements array so indices match the nav-bar display order
    let matchingIndex = -1;

    // If sourceElement is provided, find its index in the sorted navElements array
    if (sourceElement && this.navElements) {
      for (let i = 0; i < this.navElements.length; i++) {
        if (this.navElements[i] === sourceElement) {
          matchingIndex = i;
          break;
        }
      }
    }

    // If we didn't find sourceElement, match by attributes or default
    if (matchingIndex === -1 && !sourceElement) {
      if (!xyzString && !zoomString && !panString) {
        matchingIndex = -1; // Default position
      } else if (this.navElements) {
        for (let i = 0; i < this.navElements.length; i++) {
          const element = this.navElements[i];
          const elementXyz = element.getAttribute('data-nav-xyz');
          const elementZoom = element.getAttribute('data-nav-zoom');
          const elementPan = element.getAttribute('data-nav-pan');

          const xyzMatch = !xyzString || elementXyz === xyzString;
          const zoomMatch = !zoomString || elementZoom === zoomString;
          const panMatch = !panString || elementPan === panString;

          if (xyzMatch && zoomMatch && panMatch) {
            matchingIndex = i;
          }
        }
      }
    }

    // Update the active navigation point
    this.setActiveNavPoint(matchingIndex);
  }

  /**
   * Animate rotation and zoom (backward-compatible shorthand — delegates to smoothAnimateToWithPan).
   */
  smoothAnimateTo(targetRotation, targetZoom, duration = 1200) {
    this.smoothAnimateToWithPan(targetRotation, targetZoom, null, duration);
  }

  smoothAnimateToWithPan(targetRotation, targetZoom, targetTranslation = null, duration = 1200, onComplete = null) {
    this.cancelPendingAnimations();
    this.isAnimating = true; // Set animation flag to prevent premature label updates

    const startTime = performance.now();
    const startRotation = { ...this.currentRotation };
    const startZoom = this.currentZoom;
    const startTranslation = { ...this.currentTranslation };
    const hasPan = targetTranslation !== null;
    if (!hasPan) targetTranslation = { ...this.currentTranslation };

    // Clamp target rotation to limits before animating
    const clampedTarget = {
      x: Math.max(this.rotationLimits.x.min, Math.min(this.rotationLimits.x.max, targetRotation.x)),
      y: Math.max(this.rotationLimits.y.min, Math.min(this.rotationLimits.y.max, targetRotation.y)),
      z: Math.max(this.rotationLimits.z.min, Math.min(this.rotationLimits.z.max, targetRotation.z))
    };

    const clampedZoom = Math.max(0.2, Math.min(3.0, targetZoom));

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easeInOutQuad for smoother, more gentle animation
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Interpolate rotation values
      this.currentRotation.x = startRotation.x + (clampedTarget.x - startRotation.x) * eased;
      this.currentRotation.y = startRotation.y + (clampedTarget.y - startRotation.y) * eased;
      this.currentRotation.z = startRotation.z + (clampedTarget.z - startRotation.z) * eased;

      // Interpolate zoom
      this.currentZoom = startZoom + (clampedZoom - startZoom) * eased;

      // Interpolate translation/pan when a target was provided
      if (hasPan) {
        this.currentTranslation.x = startTranslation.x + (targetTranslation.x - startTranslation.x) * eased;
        this.currentTranslation.y = startTranslation.y + (targetTranslation.y - startTranslation.y) * eased;
        this.currentTranslation.z = startTranslation.z + (targetTranslation.z - startTranslation.z) * eased;
      }

      // Update the scene
      this.updateScene();

      // Continue animation if not complete
      if (progress < 1) {
        this.navigationAnimationId = requestAnimationFrame(animate);
      } else {
        this.navigationAnimationId = null;
        // Ensure final values are exactly the target
        this.currentRotation = { ...clampedTarget };
        this.currentZoom = clampedZoom;
        if (hasPan) {
          this.currentTranslation = { ...targetTranslation };
          this.clampTranslation();
        }
        this.updateScene();

        // Animation finished - now update labels
        this.isAnimating = false;
        setTimeout(() => this.updateLabelPositions(), 100);

        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  normalizeAngle(angle) {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return Math.round(angle);
  }

  updateUrlWithRotation() {
    if (typeof window === 'undefined' || !window.history) return;

    const url = new URL(window.location);
    const prefix = this.urlPrefix.replace('_', '');

    // Use the tracked currentNavIndex from the instance (not from URL)
    // This ensures nav index stays in sync when clicking nav buttons
    const currentNavIndex = this.currentNavIndex !== null && this.currentNavIndex !== undefined
      ? this.currentNavIndex
      : -1;

    // Get section hash (remove the ? and everything after it if present)
    const hashPart = url.hash.split('?')[0].slice(1);
    const sectionHash = hashPart || null;

    // Check if current values differ from navigation point's values
    let navPointRotation = this.defaultRotation;
    let navPointZoom = this.defaultZoom;
    let navPointPan = { x: 0, y: 0 };

    // Get the target values from the current navigation element
    if (this.navElements && this.navElements[currentNavIndex]) {
      const navElement = this.navElements[currentNavIndex];
      const xyz = navElement.getAttribute('data-nav-xyz');
      const zoom = navElement.getAttribute('data-nav-zoom');
      const pan = navElement.getAttribute('data-nav-pan');

      if (xyz && xyz !== 'current' && xyz !== 'default') {
        const [x, y, z] = xyz.split('.').map(v => parseFloat(v) || 0);
        navPointRotation = { x, y, z };
      }
      if (zoom && zoom !== 'current' && zoom !== 'default') {
        navPointZoom = parseFloat(zoom) || this.defaultZoom;
      }
      if (pan && pan !== 'current' && pan !== 'default') {
        const [px, py] = pan.split('.').map(v => parseFloat(v) || 0);
        navPointPan = { x: px, y: py };
      }
    }

    // Check if rotation differs from nav point
    const hasRotationDelta = (
      Math.abs(this.currentRotation.x - navPointRotation.x) > 1 ||
      Math.abs(this.currentRotation.y - navPointRotation.y) > 1 ||
      Math.abs(this.currentRotation.z - navPointRotation.z) > 1
    );

    // Check if zoom differs from nav point
    const hasZoomDelta = Math.abs(this.currentZoom - navPointZoom) > 0.05;

    // Check if pan differs from nav point
    const hasPanDelta = (
      Math.abs(this.currentTranslation.x - navPointPan.x) > 5 ||
      Math.abs(this.currentTranslation.y - navPointPan.y) > 5
    );

    // Build query parameters for deltas
    const params = [];

    // Add nav index if >= 0 (convert 0-based to 1-based for URL)
    if (currentNavIndex >= 0) {
      params.push(`${prefix}-nav=${currentNavIndex + 1}`);
    }

    // Add rotation delta if present
    if (hasRotationDelta) {
      const x = Math.round(this.currentRotation.x);
      const y = Math.round(this.currentRotation.y);
      const z = Math.round(this.currentRotation.z);

      const formatAngle = (angle) => {
        if (angle < 0) {
          const abs = Math.abs(angle);
          return abs < 10 ? `-0${abs}` : angle.toString();
        } else if (angle < 10) {
          return `0${angle}`;
        } else {
          return angle.toString();
        }
      };

      const rotationValue = `${formatAngle(x)}.${formatAngle(y)}.${formatAngle(z)}`;
      params.push(`${prefix}-xyz=${rotationValue}`);
    }

    // Add zoom delta if present
    if (hasZoomDelta) {
      params.push(`${prefix}-zoom=${this.currentZoom.toFixed(1)}`);
    }

    // Add pan delta ONLY if it was manually adjusted by the user
    // (auto-calculated pan positions should not be included in URL)
    if (hasPanDelta && this.hasManualPanAdjustment) {
      const panX = Math.round(this.currentTranslation.x);
      const panY = Math.round(this.currentTranslation.y);
      params.push(`${prefix}-pan=${panX}.${panY}`);
    }

    // Build URL with hash before query string
    const baseUrl = window.location.origin + window.location.pathname;
    let newUrl = baseUrl;

    // Add hash if present
    if (sectionHash) {
      newUrl += '#' + sectionHash;
    }

    // Add query string if we have parameters
    if (params.length > 0) {
      newUrl += '?' + params.join('&');
    }

    window.history.replaceState({}, '', newUrl);
  }

  rotateScene(deltaX, deltaY, deltaZ) {
    this.currentRotation.x = this.currentRotation.x + deltaX;
    this.currentRotation.y = this.currentRotation.y + deltaY;
    this.currentRotation.z = this.currentRotation.z + deltaZ;
    this.clampRotation();
    this.updateScene();
  }

  clampRotation() {
    // Clamp rotation values within configured limits for this instance
    this.currentRotation.x = Math.max(
      this.rotationLimits.x.min,
      Math.min(this.rotationLimits.x.max, this.currentRotation.x)
    );

    this.currentRotation.y = Math.max(
      this.rotationLimits.y.min,
      Math.min(this.rotationLimits.y.max, this.currentRotation.y)
    );

    this.currentRotation.z = Math.max(
      this.rotationLimits.z.min,
      Math.min(this.rotationLimits.z.max, this.currentRotation.z)
    );
  }

  enableTransition() {
    const perspective = this.container.querySelector('.isometric-perspective');
    if (perspective) {
      perspective.classList.add('smooth-transition');
    }
  }

  disableTransition() {
    const perspective = this.container.querySelector('.isometric-perspective');
    if (perspective) {
      perspective.classList.remove('smooth-transition');
    }
  }

  zoomScene(factor) {
    this.currentZoom = Math.max(0.2, Math.min(3.0, this.currentZoom * factor));
    this.updateScene();
  }

  /**
   * Clamp pan values to prevent runaway translations.
   * Limits are relative to the container size — you can pan up to 2× the container dimension in any direction.
   */
  clampTranslation() {
    const maxPan = Math.max(this.container.offsetWidth, this.container.offsetHeight) * 2;
    this.currentTranslation.x = Math.max(-maxPan, Math.min(maxPan, this.currentTranslation.x));
    this.currentTranslation.y = Math.max(-maxPan, Math.min(maxPan, this.currentTranslation.y));
  }

  panScene(deltaX, deltaY) {
    // Pan the scene by adjusting translation (in screen pixels).
    // translate3d(pan) is applied before scale(zoom) in the CSS transform chain,
    // so pan values are in screen pixels and are NOT affected by zoom.
    this.currentTranslation.x += deltaX;
    this.currentTranslation.y += deltaY;
    this.clampTranslation();
    // Mark that user has manually adjusted pan
    this.hasManualPanAdjustment = true;
    this.updateScene();
  }

  resetView(options = {}) {
    this.emit('viewReset', { rotation: { ...this.initialRotation }, zoom: this.initialZoom, source: this._navigationSource || 'unknown' });

    // Animate smoothly to initial/home rotation, zoom, and pan
    const sanitizedTranslation = this.sanitizeTranslation(this.initialTranslation);
    this.smoothAnimateToWithPan(
      this.initialRotation,
      this.initialZoom,
      sanitizedTranslation
    );

    // Scroll to the container (top of the presentation) unless suppressed
    if (!options.skipScroll) {
      this.scrollToContainer();
    }

    // Update navigation bar to show default position as active
    this.setActiveNavPoint(-1);

    // Clear all highlights when resetting to default position
    this.clearHighlights();

    // Reset manual pan flag since we're going back to default
    this.hasManualPanAdjustment = false;

    // Clear navigation source after all synchronous emits are done
    this._navigationSource = null;
  }

  /**
   * Smoothly scroll the page so that the isometric container (or its sticky wrapper/header)
   * is visible at the top of the viewport. Used when resetting to the initial/home position.
   */
  scrollToContainer() {
    // Find the most relevant scroll target:
    // 1. A parent .sticky-section-wrapper (if using scroll-sync layout)
    // 2. A parent .isometric-wrapper (if header + viewport are grouped)
    // 3. An ancestor .isometric-header sibling (legacy: header as sibling of container)
    // 4. The container itself
    const stickyWrapper = this.container.closest('.sticky-section-wrapper');
    const isoWrapper = this.container.closest('.isometric-wrapper');
    const legacyHeader = this.container.previousElementSibling?.classList?.contains('isometric-header')
      ? this.container.previousElementSibling
      : null;
    const scrollTarget = stickyWrapper || isoWrapper || legacyHeader || this.container;

    // Only scroll if the target is not already near the top of the viewport
    const rect = scrollTarget.getBoundingClientRect();
    if (Math.abs(rect.top) > 50) {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  calculateCenterPan(element, targetRotation, targetZoom, keys = null) {
    // Calculate the pan values needed to center an element (or group of elements) with specific rotation and zoom
    // When keys are provided, centers on the combined bounding box of ALL matching elements

    if (!element) return { x: 0, y: 0, z: 0 };

    const scene = this.container.querySelector('.isometric-perspective');
    if (!scene) return { x: 0, y: 0, z: 0 };

    // Get container center
    const containerRect = this.container.getBoundingClientRect();
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;

    // Create a temporary clone of the perspective to measure element position
    // without affecting the actual DOM
    const tempPerspective = scene.cloneNode(true);
    tempPerspective.style.position = 'absolute';
    tempPerspective.style.visibility = 'hidden';
    tempPerspective.style.pointerEvents = 'none';
    tempPerspective.style.transform = `translate(-50%, -50%) translate3d(0px, 0px, 0px) scale(${targetZoom}) rotateX(${targetRotation.x}deg) rotateY(${targetRotation.y}deg) rotateZ(${targetRotation.z}deg)`;
    tempPerspective.style.left = '50%';
    tempPerspective.style.top = '50%';
    // CRITICAL: Disable CSS transitions so getBoundingClientRect() returns the
    // target transform state immediately instead of the start of a transition.
    // The live scene may have .smooth-transition which the clone inherits.
    tempPerspective.style.transition = 'none';

    this.container.appendChild(tempPerspective);

    // Force layout recalculation
    tempPerspective.getBoundingClientRect();

    let panX = 0;
    let panY = 0;

    if (keys && keys.length > 0) {
      // GROUP CENTERING: Find ALL elements matching the keys and compute combined bounding box
      const matchingElements = this.findMatchingElementsInTree(tempPerspective, keys);

      if (matchingElements.length > 0) {
        let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;

        matchingElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 || rect.height > 0) {
            minLeft = Math.min(minLeft, rect.left);
            minTop = Math.min(minTop, rect.top);
            maxRight = Math.max(maxRight, rect.right);
            maxBottom = Math.max(maxBottom, rect.bottom);
          }
        });

        if (minLeft !== Infinity) {
          const groupCenterX = (minLeft + maxRight) / 2;
          const groupCenterY = (minTop + maxBottom) / 2;

          const containerCenterXAbs = containerRect.left + containerCenterX;
          const containerCenterYAbs = containerRect.top + containerCenterY;

          // Pan is in screen pixels: in the CSS transform chain
          // translate3d(pan) scale(zoom), translate is applied independently of scale
          panX = containerCenterXAbs - groupCenterX;
          panY = containerCenterYAbs - groupCenterY;
        }
      }
    } else {
      // SINGLE ELEMENT CENTERING: Original behavior
      // Find the corresponding element in the clone
      let tempElement = null;
      if (element.id) {
        tempElement = tempPerspective.querySelector(`#${element.id}`);
      }

      // Fallback: use data-key attribute if no ID
      if (!tempElement && element.getAttribute('data-key')) {
        const section = (element.getAttribute('data-key') || '').split(',')[0].trim();
        tempElement = tempPerspective.querySelector(`[data-key="${section}"]`) ||
          tempPerspective.querySelector(`[data-key^="${section},"]`);
      }

      // Fallback: use same position in DOM tree if no ID or data-key
      if (!tempElement) {
        const getElementIndex = (el) => Array.from(el.parentNode.children).indexOf(el);
        const path = [];
        let current = element;
        while (current && current !== scene) {
          path.unshift(getElementIndex(current));
          current = current.parentNode;
        }

        tempElement = tempPerspective;
        for (const index of path) {
          if (tempElement.children[index]) {
            tempElement = tempElement.children[index];
          } else {
            break;
          }
        }
      }

      if (tempElement) {
        const elementRect = tempElement.getBoundingClientRect();
        const elementCenterX = elementRect.left + (elementRect.width / 2);
        const elementCenterY = elementRect.top + (elementRect.height / 2);

        const containerCenterXAbs = containerRect.left + containerCenterX;
        const containerCenterYAbs = containerRect.top + containerCenterY;

        // Pan is in screen pixels (translate3d before scale in CSS transform chain)
        panX = containerCenterXAbs - elementCenterX;
        panY = containerCenterYAbs - elementCenterY;
      }
    }

    // Remove temporary clone
    this.container.removeChild(tempPerspective);

    return { x: panX, y: panY, z: 0 };
  }

  _measureGroupBBox(clonedPerspective, keys, excludeConnectors = false) {
    // Measure the combined bounding box of all elements matching keys in a cloned perspective tree
    if (!keys || keys.length === 0) return null;

    let matchingElements = this.findMatchingElementsInTree(clonedPerspective, keys);
    if (excludeConnectors) {
      // For fit calculations, exclude elements that only match via data-connector-keys
      // (connectors span to distant elements and distort the target size)
      matchingElements = matchingElements.filter(el =>
        el.hasAttribute('data-key') || el.hasAttribute('data-related-keys')
      );
    }
    if (matchingElements.length === 0) return null;

    let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
    matchingElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        minLeft = Math.min(minLeft, rect.left);
        minTop = Math.min(minTop, rect.top);
        maxRight = Math.max(maxRight, rect.right);
        maxBottom = Math.max(maxBottom, rect.bottom);
      }
    });

    if (minLeft === Infinity) return null;

    return {
      width: maxRight - minLeft,
      height: maxBottom - minTop,
      centerX: (minLeft + maxRight) / 2,
      centerY: (minTop + maxBottom) / 2
    };
  }

  calculateFitZoomAndPan(element, targetRotation, keys, fitRatio = 0.8) {
    // Calculate zoom + pan so the highlight group fills ~fitRatio of the container viewport.
    // Uses iterative probing on a hidden clone, converging both zoom AND pan together
    // to compensate for CSS perspective distortion (perspective: 1200px on container).
    if (!element) return null;

    const scene = this.container.querySelector('.isometric-perspective');
    if (!scene) return null;

    const containerRect = this.container.getBoundingClientRect();
    const containerW = containerRect.width;
    const containerH = containerRect.height;
    const containerCenterXAbs = containerRect.left + containerW / 2;
    const containerCenterYAbs = containerRect.top + containerH / 2;

    const availW = containerW * fitRatio;
    const availH = containerH * fitRatio;

    console.group(`[fitZoomPan] keys=[${keys}] fitRatio=${fitRatio}`);
    console.log(`  container: ${containerW.toFixed(0)}x${containerH.toFixed(0)}  center=(${containerCenterXAbs.toFixed(1)}, ${containerCenterYAbs.toFixed(1)})`);
    console.log(`  available (${(fitRatio*100).toFixed(0)}%%): ${availW.toFixed(0)}x${availH.toFixed(0)}`);
    console.log(`  rotation: x=${targetRotation.x} y=${targetRotation.y} z=${targetRotation.z}`);
    console.log(`  element: <${element.tagName.toLowerCase()}> id=${element.id || '(none)'} class="${element.className || ''}"`);

    // Create single hidden clone — reused across all probes
    const tempPerspective = scene.cloneNode(true);
    tempPerspective.style.position = 'absolute';
    tempPerspective.style.visibility = 'hidden';
    tempPerspective.style.pointerEvents = 'none';
    tempPerspective.style.left = '50%';
    tempPerspective.style.top = '50%';
    // CRITICAL: Disable CSS transitions so getBoundingClientRect() returns the
    // target transform state immediately instead of the start of a transition.
    // The live scene may have .smooth-transition which the clone inherits.
    tempPerspective.style.transition = 'none';
    this.container.appendChild(tempPerspective);

    // Log matched elements (excluding connectors) for diagnostic clarity
    const _debugMatched = this.findMatchingElementsInTree(tempPerspective, keys)
      .filter(el => el.hasAttribute('data-key') || el.hasAttribute('data-related-keys'));
    console.log(`  matched elements (excl connectors): ${_debugMatched.length}`);
    _debugMatched.forEach(el => {
      const r = el.getBoundingClientRect();
      console.log(`    <${el.tagName.toLowerCase()}> key="${el.getAttribute('data-key') || ''}" related="${el.getAttribute('data-related-keys') || ''}" class="${el.className}" rect=${r.width.toFixed(0)}x${r.height.toFixed(0)} @(${r.left.toFixed(0)},${r.top.toFixed(0)})`);
    });

    let probeZoom = this.defaultZoom;
    let probePanX = 0;
    let probePanY = 0;
    const ITERATIONS = 3;

    for (let i = 0; i < ITERATIONS; i++) {
      // Apply current zoom AND pan — converges both simultaneously
      tempPerspective.style.transform = `translate(-50%, -50%) translate3d(${probePanX}px, ${probePanY}px, 0px) scale(${probeZoom}) rotateX(${targetRotation.x}deg) rotateY(${targetRotation.y}deg) rotateZ(${targetRotation.z}deg)`;
      tempPerspective.getBoundingClientRect(); // force layout

      const bbox = this._measureGroupBBox(tempPerspective, keys, true);
      if (!bbox) {
        console.warn(`  iter ${i}: no matching elements with size > 0`);
        this.container.removeChild(tempPerspective);
        console.groupEnd();
        return null;
      }

      // Adjust zoom based on how the group fills the available area
      const scaleX = bbox.width > 0 ? availW / bbox.width : 1;
      const scaleY = bbox.height > 0 ? availH / bbox.height : 1;
      const scaleFactor = Math.min(scaleX, scaleY);
      const prevZoom = probeZoom;
      // Cap auto-fit zoom at 2.0 (not the manual max of 3.0) to keep pan values manageable
      probeZoom = Math.max(0.3, Math.min(2.0, probeZoom * scaleFactor));

      // Adjust pan — accumulate offset corrections to converge on center
      const panDX = containerCenterXAbs - bbox.centerX;
      const panDY = containerCenterYAbs - bbox.centerY;
      probePanX += panDX;
      probePanY += panDY;

      console.log(`  iter ${i}: bbox=${bbox.width.toFixed(1)}x${bbox.height.toFixed(1)} center=(${bbox.centerX.toFixed(1)},${bbox.centerY.toFixed(1)}) | scaleX=${scaleX.toFixed(3)} scaleY=${scaleY.toFixed(3)} factor=${scaleFactor.toFixed(3)} | zoom ${prevZoom.toFixed(3)}->${probeZoom.toFixed(3)} | panDelta=(${panDX.toFixed(1)},${panDY.toFixed(1)}) pan=(${probePanX.toFixed(1)},${probePanY.toFixed(1)})`);
    }

    this.container.removeChild(tempPerspective);

    console.log(`  RESULT: zoom=${probeZoom.toFixed(3)} pan=(${probePanX.toFixed(1)}, ${probePanY.toFixed(1)})`);
    console.groupEnd();

    return { zoom: probeZoom, translation: { x: probePanX, y: probePanY, z: 0 } };
  }

  centerOnElement(element, keys = null) {
    // Get the element's geometric center (or group bounding-box center) relative to the isometric container
    const scene = this.container.querySelector('.isometric-perspective');
    if (!scene || !element) return;

    this.emit('centerOnElement', { element, id: element.id || null });

    // Get container center - this is where we want the element to appear
    const containerRect = this.container.getBoundingClientRect();
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;

    let elementCenterX, elementCenterY;

    if (keys && keys.length > 0) {
      // Group centering: compute combined bounding box of all matching elements
      const matchingElements = this.findMatchingElementsInTree(scene, keys);
      let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;

      matchingElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          minLeft = Math.min(minLeft, rect.left);
          minTop = Math.min(minTop, rect.top);
          maxRight = Math.max(maxRight, rect.right);
          maxBottom = Math.max(maxBottom, rect.bottom);
        }
      });

      if (minLeft !== Infinity) {
        elementCenterX = ((minLeft + maxRight) / 2) - containerRect.left;
        elementCenterY = ((minTop + maxBottom) / 2) - containerRect.top;
      } else {
        // Fallback to single element
        const elementRect = element.getBoundingClientRect();
        elementCenterX = elementRect.left - containerRect.left + (elementRect.width / 2);
        elementCenterY = elementRect.top - containerRect.top + (elementRect.height / 2);
      }
    } else {
      // Single element centering (original behavior)
      const elementRect = element.getBoundingClientRect();
      elementCenterX = elementRect.left - containerRect.left + (elementRect.width / 2);
      elementCenterY = elementRect.top - containerRect.top + (elementRect.height / 2);
    }

    // Calculate how much we need to translate to center the element
    // Pan is in screen pixels (translate3d before scale in CSS transform chain)
    const neededTranslateX = containerCenterX - elementCenterX;
    const neededTranslateY = containerCenterY - elementCenterY;

    // Add this translation to our current translation (don't replace it)
    const targetTranslateX = this.currentTranslation.x + neededTranslateX;
    const targetTranslateY = this.currentTranslation.y + neededTranslateY;

    // Animate to the new position
    this.animateTranslation(targetTranslateX, targetTranslateY, this.currentTranslation.z);
  }

  /**
   * Find all elements within a DOM tree that match any of the given keys.
   * Checks data-key, data-related-keys, and data-connector-keys attributes.
   * Works on both the live DOM and cloned trees.
   * @param {HTMLElement} root - Root element to search within
   * @param {Array<string>} keys - Array of keys to match
   * @returns {Array<HTMLElement>} - Array of matching elements
   */
  findMatchingElementsInTree(root, keys) {
    const matching = [];
    const candidates = root.querySelectorAll('[data-key], [data-related-keys], [data-connector-keys]');
    candidates.forEach(el => {
      if (this.elementMatchesCriteria(el, keys)) {
        matching.push(el);
      }
    });
    return matching;
  }

  project3DTo2D(x, y, z) {
    // Apply the current rotation transformations to get the projected position
    const rad = Math.PI / 180;
    const rx = this.currentRotation.x * rad;
    const ry = this.currentRotation.y * rad;
    const rz = this.currentRotation.z * rad;

    // Apply rotation matrices in the same order as CSS: rotateX, rotateY, rotateZ
    // Rotate around X axis
    let x1 = x;
    let y1 = y * Math.cos(rx) - z * Math.sin(rx);
    let z1 = y * Math.sin(rx) + z * Math.cos(rx);

    // Rotate around Y axis
    let x2 = x1 * Math.cos(ry) + z1 * Math.sin(ry);
    let y2 = y1;
    let z2 = -x1 * Math.sin(ry) + z1 * Math.cos(ry);

    // Rotate around Z axis
    let x3 = x2 * Math.cos(rz) - y2 * Math.sin(rz);
    let y3 = x2 * Math.sin(rz) + y2 * Math.cos(rz);

    // For isometric projection, we use the X and Y coordinates directly
    // The Z coordinate affects the apparent position but in our isometric view,
    // we mainly care about the X,Y projection
    return {
      x: x3,
      y: y3
    };
  }

  animateTranslation(targetX, targetY, targetZ) {
    // Sanitize input translation values
    const sanitizedTarget = this.sanitizeTranslation({ x: targetX, y: targetY, z: targetZ });
    targetX = sanitizedTarget.x;
    targetY = sanitizedTarget.y;
    targetZ = sanitizedTarget.z;

    // Cancel any existing translation animation
    if (this.translationAnimationId) {
      cancelAnimationFrame(this.translationAnimationId);
      this.translationAnimationId = null;
    }

    const startX = this.currentTranslation.x;
    const startY = this.currentTranslation.y;
    const startZ = this.currentTranslation.z;

    const duration = 500; // 500ms animation
    const startTime = performance.now();

    // Set animation flag to prevent label updates during animation
    this.isAnimating = true;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easeInOutCubic for smooth animation
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.currentTranslation.x = startX + (targetX - startX) * easeProgress;
      this.currentTranslation.y = startY + (targetY - startY) * easeProgress;
      this.currentTranslation.z = startZ + (targetZ - startZ) * easeProgress;

      this.updateScene();

      if (progress < 1) {
        this.translationAnimationId = requestAnimationFrame(animate);
      } else {
        // Animation complete - reset flag and update labels
        this.translationAnimationId = null;
        this.isAnimating = false;
        setTimeout(() => this.updateLabelPositions(), 50);
      }
    };

    this.translationAnimationId = requestAnimationFrame(animate);
  }

  // Mouse event handlers
  onMouseDown(e) {
    this.isDragging = true;
    this.hasDragged = false; // Track if mouse actually moved during drag
    this.isClickNavigation = false; // Reset flag when manually dragging
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.dragButton = e.button; // 0 = left, 1 = middle, 2 = right

    // Pause autoplay when user manually interacts
    if (this.isAutoPlaying) {
      this.stopAutoPlay();
    }

    // Cancel any in-progress animations so drag and animation don't fight
    this.cancelPendingAnimations();

    // Cancel any pending label updates to prevent flicker during drag
    clearTimeout(this.labelUpdateTimeout);

    // Disable transition for immediate mouse response
    this.disableTransition();

    // Add mousemove listener only when dragging starts
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.onMouseUp);

    // Change cursor to indicate dragging mode on the perspective element
    const perspective = this.container.querySelector('.isometric-perspective');
    if (perspective) {
      if (e.button === 0) { // Left mouse button - rotation
        perspective.style.cursor = 'grabbing';
      } else if (e.button === 1) { // Middle mouse button - panning
        perspective.style.cursor = 'move';
        e.preventDefault(); // Prevent default middle-click behavior
      } else if (e.button === 2) { // Right mouse button - zoom/Y rotation
        perspective.style.cursor = 'move';
      }
    }

    // Focus this container
    this.container.focus();

    // Prevent default to avoid context menu on right click
    if (e.button === 2) {
      e.preventDefault();
    }
  }

  onMouseMove(e) {
    if (!this.isDragging) {
      return;
    }

    // Throttle mouse move events to reduce excessive updates
    const now = performance.now();
    if (now - this.lastUpdateTime < this.mouseMoveThrottle) {
      return;
    }
    this.lastUpdateTime = now;

    const deltaX = e.clientX - this.lastMouseX;
    const deltaY = e.clientY - this.lastMouseY;

    // Mark that a real drag occurred (mouse moved)
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      this.hasDragged = true;
    }

    // Use requestAnimationFrame for smooth updates and prevent flicker
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(() => {
        // Check for keyboard modifiers (Shift/Alt) to change behavior
        const hasShiftKey = e.shiftKey;
        const hasAltKey = e.altKey;

        if (this.dragButton === 0) { // Left mouse button
          if (hasAltKey) {
            // Alt + Mouse: Pan (like Alt + Arrow keys)
            this.panScene(deltaX, deltaY);
          } else if (hasShiftKey) {
            // Shift + Mouse: Y rotation (horizontal) and Zoom (vertical)
            this.rotateScene(0, deltaX * this.mouseSensitivity.y, 0);

            // Zoom with vertical mouse movement INVERTED (up = zoom out, down = zoom in)
            const zoomFactor = 1 + (-deltaY * 0.01);
            this.zoomScene(zoomFactor);
          } else {
            // No modifier: Default X and Z rotation
            this.rotateScene(
              -deltaY * this.mouseSensitivity.x,  // Vertical mouse = X rotation
              0,
              -deltaX * this.mouseSensitivity.z   // Horizontal mouse = Z rotation (reversed for intuitive direction)
            );
          }
        } else if (this.dragButton === 1) { // Middle mouse button - Panning
          this.panScene(deltaX, deltaY);
        } else if (this.dragButton === 2) { // Right mouse button - Y rotation and zoom
          this.rotateScene(
            0,
            -deltaX * this.mouseSensitivity.y,  // Horizontal mouse = Y rotation (reversed for intuitive direction)
            0
          );

          // Zoom with vertical mouse movement
          const zoomFactor = 1 + (deltaY * 0.01);
          this.zoomScene(zoomFactor);
        }

        // Clear the animation frame ID
        this.animationFrameId = null;
      });
    }

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  onMouseUp(e) {
    // Record drag-end timestamp so click handlers can suppress click-after-drag
    if (this.hasDragged) {
      this.dragEndTime = performance.now();
    }
    this.isDragging = false;
    this.dragButton = null;

    // Cancel any pending animation frame to prevent flicker
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Restore default cursor on perspective element
    const perspective = this.container.querySelector('.isometric-perspective');
    if (perspective) {
      perspective.style.cursor = 'grab';
    }

    // Update labels now that dragging has stopped
    setTimeout(() => this.updateLabelPositions(), 100);

    // Remove mousemove listener when dragging stops
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  // Touch event handlers for mobile support
  onTouchStart(e) {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
      this.dragButton = 0; // Treat single touch as left mouse button
      this.container.focus();
    }
    e.preventDefault();
  }

  onTouchMove(e) {
    if (!this.isDragging || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - this.lastMouseX;
    const deltaY = e.touches[0].clientY - this.lastMouseY;

    this.rotateScene(
      -deltaY * this.mouseSensitivity.x,
      0,
      deltaX * this.mouseSensitivity.z
    );

    this.lastMouseX = e.touches[0].clientX;
    this.lastMouseY = e.touches[0].clientY;
    e.preventDefault();
  }

  onTouchEnd(e) {
    this.isDragging = false;
    this.dragButton = null;
    e.preventDefault();
  }

  onWheel(e) {
    // Check if the mouse is over the help panel - if so, allow natural scrolling
    const helpPanel = e.target.closest('.keyboard-help');
    if (helpPanel && helpPanel.classList.contains('show')) {
      // Allow natural scrolling within help panel
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Reset click navigation flag when manually navigating via mouse wheel
    this.isClickNavigation = false;

    // Cancel any in-progress animations so wheel and animation don't fight
    this.cancelPendingAnimations();

    // Pause autoplay when user manually interacts with mouse wheel
    if (this.isAutoPlaying) {
      this.stopAutoPlay();
    }

    // Check for Alt modifier for panning (matching keyboard behavior)
    const isPanModifier = e.altKey;
    const isShiftModifier = e.shiftKey;

    const step = 5; // Rotation step (matching keyboard)
    const panStep = 20; // Pan step in pixels (matching keyboard)
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

    if (isPanModifier) {
      // Alt + Wheel: Pan up/down (matching Alt + Arrow Up/Down)
      const panAmount = e.deltaY > 0 ? panStep : -panStep;
      this.panScene(0, panAmount);
    } else if (isShiftModifier) {
      // Shift + Wheel: Zoom (matching Shift + Arrow Up/Down)
      this.zoomScene(zoomFactor);
    } else {
      // No modifier: X-axis rotation (matching Arrow Up/Down)
      const rotationAmount = e.deltaY > 0 ? step : -step;
      this.rotateScene(rotationAmount, 0, 0);
    }
  }

  onKeyDown(e) {
    // Only respond if this container (or a child like a nav-point) has focus
    if (!this.container.contains(document.activeElement)) {
      return;
    }

    const containerFocused = document.activeElement === this.container;

    // Space always resets to default (index -1), regardless of which child has focus
    if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (this.isAutoPlaying) this.stopAutoPlay();
      this._navigationSource = 'keyboard';
      this.resetToDefault();
      return;
    }

    // Handle 'p' key for autoplay toggle
    // P = regular autoplay, Shift+P = highlight-only autoplay
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      e.stopPropagation();
      this.toggleAutoPlay(e.shiftKey);
      return;
    }

    // Handle Tab navigation through navigation points
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();

      this.stopAutoPlay();

      const navPoints = this.container.querySelectorAll('.nav-point');
      if (navPoints.length > 0) {
        // Find currently active nav point index, or -1 if none (default/reset state)
        let activeIndex = -1;
        const activePoint = this.container.querySelector('.nav-point.active');
        if (activePoint) {
          activeIndex = Array.from(navPoints).indexOf(activePoint);
        }

        // Calculate next index in the nav points array
        // Wrapping goes to -1 (reset/default) instead of looping around
        let nextArrayIndex;

        if (e.altKey && e.shiftKey) {
          // Alt+Shift+Tab: go backwards (highlight-only mode - don't change view)
          this._navigationSource = 'alt-shift-tab';
          if (activeIndex <= 0) {
            // At first item or already at -1 → reset to default
            this.resetToDefault();
          } else {
            nextArrayIndex = activeIndex - 1;
            const nextNavIndex = parseInt(navPoints[nextArrayIndex].getAttribute('data-nav-index'));
            this.navigateHighlightOnly(nextNavIndex);
          }
        } else if (e.altKey) {
          // Alt+Tab: go forwards (highlight-only mode - don't change view)
          this._navigationSource = 'alt-tab';
          if (activeIndex >= navPoints.length - 1) {
            // At last item → reset to default
            this.resetToDefault();
          } else {
            nextArrayIndex = activeIndex + 1;
            const nextNavIndex = parseInt(navPoints[nextArrayIndex].getAttribute('data-nav-index'));
            this.navigateHighlightOnly(nextNavIndex);
          }
        } else if (e.shiftKey) {
          // Shift+Tab: go backwards (full navigation with view change)
          this._navigationSource = 'shift-tab';
          if (activeIndex <= 0) {
            // At first item or already at -1 → reset to default
            this.resetToDefault();
          } else {
            nextArrayIndex = activeIndex - 1;
            navPoints[nextArrayIndex].click();
          }
        } else {
          // Tab: go forwards (full navigation with view change)
          this._navigationSource = 'tab';
          if (activeIndex >= navPoints.length - 1) {
            // At last item → reset to default
            this.resetToDefault();
          } else {
            nextArrayIndex = activeIndex + 1;
            navPoints[nextArrayIndex].click();
          }
        }
      }
      return;
    }

    // Remaining keys (arrows, zoom, r) require the container itself to have focus
    if (!containerFocused) return;

    // Prevent default behavior for arrow keys and other navigation keys immediately
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '=', '-', 'r', 'R'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();

      // Pause autoplay when user manually interacts with keyboard controls
      if (this.isAutoPlaying) {
        this.stopAutoPlay();
      }
    }

    // Throttle keyboard input to prevent too rapid firing
    const now = performance.now();
    if (now - this.lastKeyTime < 100) {
      return;
    }
    this.lastKeyTime = now;

    const step = 5;
    const panStep = 20; // Pan step in pixels
    const zoomStep = e.shiftKey ? 1.1 : 1.1;

    // Enable smooth transition for keyboard navigation
    this.enableTransition();

    // Reset click navigation flag when manually navigating via keyboard
    this.isClickNavigation = false;

    // Check for Alt modifier for panning
    const isPanModifier = e.altKey;

    // Helper function to add visual feedback to direction indicators
    const flashIndicator = (direction) => {
      const indicator = this.container.querySelector(`#${this.containerId}-indicator-${direction}`);
      if (indicator) {
        indicator.classList.add('pressed');
        setTimeout(() => indicator.classList.remove('pressed'), 200);
      }
    };

    switch (e.key) {
      case 'ArrowUp':
        flashIndicator('up');
        if (isPanModifier) {
          // Alt + Arrow Up: Pan up
          this.panScene(0, -panStep);
        } else if (e.shiftKey) {
          this.zoomScene(zoomStep);
        } else {
          this.rotateScene(-step, 0, 0);
        }
        break;
      case 'ArrowDown':
        flashIndicator('down');
        if (isPanModifier) {
          // Alt + Arrow Down: Pan down
          this.panScene(0, panStep);
        } else if (e.shiftKey) {
          this.zoomScene(1 / zoomStep);
        } else {
          this.rotateScene(step, 0, 0);
        }
        break;
      case 'ArrowLeft':
        flashIndicator('left');
        if (isPanModifier) {
          // Alt + Arrow Left: Pan left
          this.panScene(-panStep, 0);
        } else if (e.shiftKey) {
          this.rotateScene(0, -step, 0);
        } else {
          this.rotateScene(0, 0, -step);
        }
        break;
      case 'ArrowRight':
        flashIndicator('right');
        if (isPanModifier) {
          // Alt + Arrow Right: Pan right
          this.panScene(panStep, 0);
        } else if (e.shiftKey) {
          this.rotateScene(0, step, 0);
        } else {
          this.rotateScene(0, 0, step);
        }
        break;
      case '+':
      case '=':
        this.zoomScene(zoomStep);
        break;
      case '-':
        this.zoomScene(1 / zoomStep);
        break;
      case 'r':
      case 'R':
        this._navigationSource = 'keyboard';
        this.resetToDefault();
        break;
    }
  }

  loadFromUrl() {
    if (typeof window === 'undefined') return;

    const prefix = this.urlPrefix.replace('_', '');

    // STEP 1: Read the complete URL and parse all parameters
    const fullHash = window.location.hash.slice(1); // Remove leading '#'
    let sectionHash = null;
    let queryString = window.location.search.slice(1); // Remove leading '?'

    // Handle both formats: #section?params or ?params#section
    if (fullHash.includes('?')) {
      const parts = fullHash.split('?');
      sectionHash = parts[0];
      queryString = parts[1];
    } else if (queryString && fullHash) {
      sectionHash = fullHash;
    } else if (fullHash) {
      sectionHash = fullHash;
    }

    // Parse all URL parameters upfront
    const params = new URLSearchParams(queryString);
    const navParam = params.get(`${prefix}-nav`);
    const xyzParam = params.get(`${prefix}-xyz`);
    const zoomParam = params.get(`${prefix}-zoom`);
    const panParam = params.get(`${prefix}-pan`);

    // Convert 1-based URL index to 0-based internal index
    const navIndex = navParam !== null ? parseInt(navParam, 10) - 1 : 0;

    // Store the target URL to restore after navigation
    const targetUrl = window.location.href;

    // Prevent ANY URL updates during the entire load process
    this.isClickNavigation = true;

    // Find the navigation element to use
    let navElement = null;
    let finalNavIndex = 0;

    if (!isNaN(navIndex) && this.navElements && this.navElements[navIndex]) {
      navElement = this.navElements[navIndex];
      finalNavIndex = navIndex;
    } else if (this.navElements && this.navElements.length > 0) {
      // Try to find by section hash
      if (sectionHash) {
        const matchingNav = this.navElements.find(nav => {
          const section = (nav.getAttribute('data-key') || '').split(',')[0].trim();
          if (section === sectionHash) return true;

          const parentScene = nav.closest('.scene');
          const parentCuboid = nav.closest('.cuboid');

          if (parentScene && (parentScene.getAttribute('data-key') || '').split(',')[0].trim() === sectionHash) return true;
          if (parentCuboid && (parentCuboid.getAttribute('data-key') || '').split(',')[0].trim() === sectionHash) return true;

          return false;
        });

        if (matchingNav) {
          navElement = matchingNav;
          finalNavIndex = Array.from(this.navElements).indexOf(matchingNav);
        }
      }

      // Fallback to first element
      if (!navElement) {
        navElement = this.navElements[0];
        finalNavIndex = 0;
      }
    }

    if (!navElement) return;

    // STEP 2: Navigate to base position (navigation index) without URL updates
    const baseXyz = navElement.getAttribute('data-nav-xyz');
    const baseZoom = navElement.getAttribute('data-nav-zoom');
    const basePan = navElement.getAttribute('data-nav-pan');

    this._navigationSource = 'url';
    this.navigateToPosition(baseXyz, baseZoom, navElement, basePan, () => {
      // STEP 3: Apply manual adjustments (if any) with smooth animation
      const targetRotation = { ...this.currentRotation };
      let targetZoom = this.currentZoom;
      const targetTranslation = { ...this.currentTranslation };
      let hasAdjustments = false;

      // Parse manual adjustments from URL
      if (xyzParam) {
        const [x, y, z] = xyzParam.split('.').map(v => parseFloat(v) || 0);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          targetRotation.x = x;
          targetRotation.y = y;
          targetRotation.z = z;
          hasAdjustments = true;
        }
      }

      if (zoomParam) {
        const zoom = parseFloat(zoomParam);
        if (!isNaN(zoom)) {
          targetZoom = zoom;
          hasAdjustments = true;
        }
      }

      if (panParam) {
        const [x, y] = panParam.split('.').map(v => parseFloat(v) || 0);
        if (!isNaN(x) && !isNaN(y)) {
          targetTranslation.x = x;
          targetTranslation.y = y;
          hasAdjustments = true;
          // Mark that pan was manually adjusted (loaded from URL)
          this.hasManualPanAdjustment = true;
        }
      }

      if (hasAdjustments) {
        // Animate smoothly from base position to adjusted position
        this.smoothAnimateToWithPan(targetRotation, targetZoom, targetTranslation, 1200, () => {
          // STEP 4: Restore the target URL without triggering page reload
          // This ensures the URL matches exactly what was requested
          if (window.location.href !== targetUrl) {
            window.history.replaceState({}, '', targetUrl);
          }

          // Reset flag after a delay to allow future manual navigation to update URL normally
          setTimeout(() => {
            this.isClickNavigation = false;
          }, 100);
        });
      } else {
        // No adjustments, just restore URL and reset flag
        if (window.location.href !== targetUrl) {
          window.history.replaceState({}, '', targetUrl);
        }

        setTimeout(() => {
          this.isClickNavigation = false;
        }, 100);
      }
    }, true);

    // Update navigation bar (skip URL update)
    this.setActiveNavPoint(finalNavIndex, true);
  }

  // Public methods for external control
  setRotation(x, y, z) {
    this.currentRotation = { x, y, z };
    this.clampRotation();
    this.updateScene();
  }

  setZoom(zoom) {
    this.currentZoom = Math.max(0.2, Math.min(3.0, zoom));
    this.updateScene();
  }

  getState() {
    return {
      rotation: { ...this.currentRotation },
      zoom: this.currentZoom
    };
  }

  // Three-phase initialization for SVG overlay (called automatically in init)
  initializeThreePhase() {
    // Guard against duplicate initialization
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    const perspective = this.container.querySelector('.isometric-perspective');

    // Create SVG overlay if connectors are defined
    if (perspective && this.connectors && this.connectors.length > 0) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('scene-overlay');
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '2';
      svg.style.transform = 'translateZ(0.5px)'; // Bring SVG slightly forward to ensure visibility

      // Add click handler for connector selection (same behavior as data-key)
      svg.addEventListener('click', (e) => {
        const target = e.target;
        const connectorKeys = target.getAttribute('data-connector-keys');
        if (connectorKeys) {
          e.stopPropagation();
          const keys = connectorKeys.split(',').map(k => k.trim());
          this.emit('connectorClick', { keys, element: target });
          // Toggle behavior: if same keys are already active, clear highlights
          if (this.currentHighlightKeys &&
              keys.length === this.currentHighlightKeys.length &&
              keys.every(k => this.currentHighlightKeys.includes(k))) {
            this.clearHighlights();
          } else {
            this.highlightByKey(keys);
          }
          // Center viewport on the group of elements matching the connector keys
          const connectorPath = target.classList.contains('connector-path')
            ? target
            : svg.querySelector(`.connector-path[data-connector-keys="${connectorKeys}"]`);
          if (connectorPath) {
            this.centerOnElement(connectorPath, keys);
          }
        }
      });

      perspective.insertBefore(svg, perspective.firstChild);
    }

    // Find cuboids and scenes that need initialization
    const cuboids = this.container.querySelectorAll('.cuboid[data-height]');
    const scenes = this.container.querySelectorAll('.scene[data-z-axis]');

    // Store original cuboid data attributes
    this.sceneOriginalData = new Map();

    // Store cuboid data
    cuboids.forEach(cuboid => {
      const original = {
        height: cuboid.dataset.height || null,
        zAxis: cuboid.dataset.zAxis || '0'
      };
      this.sceneOriginalData.set(cuboid, original);

      // For cuboids with data-height="auto" or without data-height, keep/set as 'auto'
      // These will be measured during configureCuboids()
      if (!original.height || original.height === 'auto') {
        cuboid.dataset.height = 'auto'; // Let faces render at natural size for measurement
      } else {
        cuboid.dataset.height = '0'; // Temporarily flatten for initial layout
      }
      cuboid.dataset.zAxis = '0';
    });

    // Store scene data (only for z-axis, scenes no longer have width/height/depth)
    scenes.forEach(scene => {
      const original = {
        height: null, // Scenes don't have height anymore
        zAxis: scene.dataset.zAxis || '0'
      };
      this.sceneOriginalData.set(scene, original);
      scene.dataset.zAxis = '0';
    });

    // Check for URL parameters (highest priority)
    const url = new URL(window.location);
    const rotationParam = url.searchParams.get(`${this.urlPrefix.replace('_', '')}xyz`);
    const zoomParam = url.searchParams.get(`${this.urlPrefix.replace('_', '')}zoom`);
    const panParam = url.searchParams.get(`${this.urlPrefix.replace('_', '')}pan`);

    let finalRotation, finalZoom, finalTranslation;

    // Priority: URL parameters > initial (home) values
    if (rotationParam) {
      const [x, y, z] = rotationParam.split('.').map(v => parseFloat(v) || 0);
      finalRotation = { x, y, z };
    } else {
      finalRotation = { ...this.initialRotation };
    }

    if (zoomParam) {
      finalZoom = parseFloat(zoomParam);
    } else {
      finalZoom = this.initialZoom;
    }

    if (panParam) {
      const [x, y] = panParam.split('.').map(v => parseFloat(v) || 0);
      finalTranslation = this.sanitizeTranslation({ x, y, z: 0 });
    } else {
      finalTranslation = this.sanitizeTranslation({ ...this.initialTranslation });
    }

    // Apply completely flat state - ignore all stored values
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.currentZoom = 1.0;
    this.currentTranslation = { x: 0, y: 0, z: 0 };

    // IMPORTANT: Measure auto-height cuboids BEFORE any 3D transformations
    // This ensures we measure in pure 2D mode with flat perspective
    this.measureAutoHeightCuboidsIn2D();

    // Apply final rotation, zoom, and pan BEFORE configureCuboids
    // so shadows are created with the correct rotation from the start
    this.currentRotation = { ...finalRotation };
    this.currentZoom = finalZoom;
    this.currentTranslation = { ...finalTranslation };

    // Clamp rotation to ensure it's within limits
    this.clampRotation();

    // Restore scene data (only z-axis) BEFORE first configureCuboids call
    // so shadow creation can read the correct z-axis values
    scenes.forEach(scene => {
      const original = this.sceneOriginalData.get(scene);
      if (original) {
        scene.dataset.zAxis = original.zAxis;
      }
    });

    this.configureCuboids();

    // Capture initial 2D positions BEFORE any 3D transforms are applied
    // This is the ONLY time we should capture positions from the DOM
    this.captureInitialConnectorPositions();

    // Now draw the SVG using the captured initial positions
    this.captureCoordinatesAndDrawSvg();

    // Phase 2: Capture coordinates and draw SVG, then restore scene data (z-axis only, after DOM updates)
    setTimeout(() => {

      // Just update the scene to apply the transforms
      this.updateScene();

      // Make the perspective visible after 3D transforms are applied
      setTimeout(() => {
        const perspective = this.container.querySelector('.isometric-perspective');
        if (perspective) {
          perspective.classList.add('ready');
        }

        // Start all animations for default view
        this.startAllAnimations();

        // Emit navigation keys after initialization
        this.emit('navKeys', { keys: this.getNavKeys() });

        // Load navigation state from URL if present
        this.loadFromUrl();
      }, 50); // Small delay to ensure updateScene has completed

    }, 300);
  }

  // Capture initial 2D positions before any 3D transforms are applied
  // This should ONLY be called once during initialization in flat 2D mode
  captureInitialConnectorPositions() {
    const perspective = this.container.querySelector('.isometric-perspective');
    if (!perspective) return;

    if (!this.connectors || this.connectors.length === 0) return;

    const connectors = this.connectors;

    // Store initial positions AND configuration for all connector endpoints
    this.initialConnectorPositions = new Map();
    const perspectiveRect = perspective.getBoundingClientRect();

    connectors.forEach((connector, index) => {
      // Parse connector IDs and positions
      let fromId, toId, fromPoint, toPoint;

      if (connector.ids) {
        const [from, to] = connector.ids.split(',').map(s => s.trim());
        fromId = from;
        toId = to;
      } else {
        fromId = connector.from;
        toId = connector.to;
      }

      if (connector.positions) {
        const [from, to] = connector.positions.split(',').map(s => s.trim());
        fromPoint = from;
        toPoint = to;
      } else {
        fromPoint = connector.fromPoint;
        toPoint = connector.toPoint;
      }

      const fromElement = document.getElementById(fromId);
      const toElement = document.getElementById(toId);

      if (!fromElement || !toElement) return;

      // Capture initial 2D positions
      const fromCorners = this.getTransformedCorners(fromElement, perspectiveRect);
      const toCorners = this.getTransformedCorners(toElement, perspectiveRect);

      const startPoint = this.getConnectionPoint(fromCorners, fromPoint || 'center');
      const endPoint = this.getConnectionPoint(toCorners, toPoint || 'center');

      // Store positions AND original configuration (including groups and animationStyle)
      const connectorKey = `${index}-${fromId}-${toId}`;

      // Extract groups/keys
      let keys = connector.groups || connector.keys || (connector.key ? [connector.key] : []);
      if (typeof keys === 'string') {
        keys = keys.split(',').map(k => k.trim());
      }

      // Extract animation style
      const animationStyle = connector.animationStyle || connector.lineAnimated ||
        (connector.animated ? 'circle' : this.connectorDefaults?.animationStyle);

      this.initialConnectorPositions.set(connectorKey, {
        startPoint: { x: startPoint.x, y: startPoint.y },
        endPoint: { x: endPoint.x, y: endPoint.y },
        fromPoint,
        toPoint,
        groups: keys,  // Store the original groups
        animationStyle: animationStyle  // Store the original animation style
      });
    });
  }

  // Helper function to get transformed corners using getBoundingClientRect
  getTransformedCorners(element, perspectiveRect) {
    // Get the element's bounding box after all transforms are applied
    const rect = element.getBoundingClientRect();

    // Calculate relative to perspective container
    const offsetX = rect.left - perspectiveRect.left;
    const offsetY = rect.top - perspectiveRect.top;

    // Return the four corners relative to the perspective container
    return {
      tl: { x: offsetX, y: offsetY },
      tr: { x: offsetX + rect.width, y: offsetY },
      br: { x: offsetX + rect.width, y: offsetY + rect.height },
      bl: { x: offsetX, y: offsetY + rect.height }
    };
  }

  // Phase 2: Capture coordinates and draw SVG connectors
  captureCoordinatesAndDrawSvg() {
    const perspective = this.container.querySelector('.isometric-perspective');
    const svg = perspective.querySelector('.scene-overlay');

    if (!svg) return;

    // Clear existing SVG content
    svg.innerHTML = '';

    // Get the perspective container's position for reference
    const perspectiveRect = perspective.getBoundingClientRect();

    // Parse connector metadata
    if (!this.connectors || this.connectors.length === 0) {
      return;
    }

    const connectors = this.connectors;

    // Scan connectors to determine which marker types are actually needed per color
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const needsArrow = new Set();      // colors that need regular arrow marker
    const needsArrowSmall = new Set(); // colors that need small arrow marker

    connectors.forEach(c => {
      const color = c.color || '#4CAF50';
      let startLine, endLine;
      if (c.endStyles) {
        const [s, e] = c.endStyles.split(',').map(v => v.trim());
        startLine = s || undefined;
        endLine = e || undefined;
      } else {
        startLine = c.startLine || this.connectorDefaults.startLine;
        endLine = c.endLine || this.connectorDefaults.endLine;
      }
      [startLine, endLine].forEach(style => {
        if (style === 'arrow' || style === 'arrow-circle') needsArrow.add(color);
        if (style === 'arrowSmall') needsArrowSmall.add(color);
      });
    });

    // Add gray marker for non-highlighted connectors (dimming) — only for types actually used
    if (needsArrow.size > 0) needsArrow.add('#80808000');
    if (needsArrowSmall.size > 0) needsArrowSmall.add('#80808000');

    // Create regular arrow markers only for colors that need them
    needsArrow.forEach(color => {
      const markerId = `arrowhead-${color.replace('#', '')}`;
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', markerId);
      marker.setAttribute('markerWidth', '13');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '13');
      marker.setAttribute('refY', '5');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('markerUnits', 'strokeWidth');

      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M0,0 L0,10 L13,5 z');
      arrowPath.setAttribute('fill', color);
      marker.appendChild(arrowPath);
      defs.appendChild(marker);
    });

    // Create small arrow markers only for colors that need them
    needsArrowSmall.forEach(color => {
      const markerIdSmall = `arrowhead-small-${color.replace('#', '')}`;
      const markerSmall = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      markerSmall.setAttribute('id', markerIdSmall);
      markerSmall.setAttribute('markerWidth', '3');
      markerSmall.setAttribute('markerHeight', '5');
      markerSmall.setAttribute('refX', '3');
      markerSmall.setAttribute('refY', '2.5');
      markerSmall.setAttribute('orient', 'auto');
      markerSmall.setAttribute('markerUnits', 'strokeWidth');

      const arrowPathSmall = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPathSmall.setAttribute('d', 'M0,0 L0,5 L3,2.5 z');
      arrowPathSmall.setAttribute('fill', color);
      markerSmall.appendChild(arrowPathSmall);
      defs.appendChild(markerSmall);
    });

    svg.appendChild(defs);

    // Draw each connector
    connectors.forEach((connector, index) => {
      // Support simplified syntax: ids="from,to" or legacy from/to properties
      let fromId, toId, fromPoint, toPoint, edgeAt;

      if (connector.ids) {
        const [from, to] = connector.ids.split(',').map(s => s.trim());
        fromId = from;
        toId = to;
      } else {
        fromId = connector.from;
        toId = connector.to;
      }

      if (connector.positions) {
        const [from, to] = connector.positions.split(',').map(s => s.trim());
        fromPoint = from;
        toPoint = to;
      } else {
        fromPoint = connector.fromPoint;
        toPoint = connector.toPoint;
      }

      if (connector.vertices) {
        edgeAt = connector.vertices;
      } else {
        edgeAt = connector.edgeAt;
      }

      // Use stored initial 2D positions instead of recalculating from transformed state
      const connectorKey = `${index}-${fromId}-${toId}`;
      const cachedPositions = this.initialConnectorPositions?.get(connectorKey);

      let startPoint, endPoint;

      if (cachedPositions) {
        // Use the stored initial 2D positions
        startPoint = cachedPositions.startPoint;
        endPoint = cachedPositions.endPoint;
        fromPoint = cachedPositions.fromPoint;
        toPoint = cachedPositions.toPoint;
      } else {
        // Fallback: calculate from current state (shouldn't happen after initialization)
        const fromElement = document.getElementById(fromId);
        const toElement = document.getElementById(toId);

        if (!fromElement || !toElement) {
          console.warn(`  ⚠ Connector ${index}: Could not find elements ${fromId} -> ${toId}`);
          return;
        }

        const fromCorners = this.getTransformedCorners(fromElement, perspectiveRect);
        const toCorners = this.getTransformedCorners(toElement, perspectiveRect);

        if (!fromCorners || !toCorners) {
          console.warn(`  ⚠ Connector ${index}: Could not get corners`);
          return;
        }

        // Check for fromCenter and toCenter options
        const fromCenter = connector.fromCenter || fromPoint === 'center';
        const toCenter = connector.toCenter || toPoint === 'center';

        startPoint = this.getConnectionPoint(
          fromCorners,
          fromPoint,
          fromCenter,
          fromCenter ? fromPoint : null
        );

        endPoint = this.getConnectionPoint(
          toCorners,
          toPoint,
          toCenter,
          toCenter ? toPoint : null
        );
      }

      // Determine routing direction based on connection points
      // left/right → horizontal first, top/bottom → vertical first, center → depends on opposite end
      const startOrientation = this.getPointOrientation(fromPoint, toPoint, startPoint, endPoint);
      const endOrientation = this.getPointOrientation(toPoint, fromPoint, endPoint, startPoint);

      // Draw connector line with rounded corners
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const color = connector.color || '#4CAF50';
      const baseCornerRadius = 10;

      // Support compact syntax: endStyles="start,end" or individual startLine/endLine
      let startLine, endLine;

      if (connector.endStyles) {
        const [start, end] = connector.endStyles.split(',').map(s => s.trim());
        startLine = start || undefined;
        endLine = end || undefined;
      } else {
        // Legacy: showArrow, showStartCircle, showEndCircle
        // Current: startLine, endLine
        startLine = connector.startLine ||
          (connector.showStartCircle ? 'circle' :
            (connector.showArrow === false ? undefined : this.connectorDefaults.startLine));

        endLine = connector.endLine ||
          (connector.showEndCircle ? 'circle' :
            (connector.showArrow === false ? undefined : this.connectorDefaults.endLine));
      }

      const lineStyle = connector.lineStyle || this.connectorDefaults.lineStyle;
      const animationStyle = connector.animationStyle || connector.lineAnimated ||
        (connector.animated ? 'circle' : this.connectorDefaults.animationStyle);

      // Calculate direction and distance
      const deltaY = endPoint.y - startPoint.y;
      const deltaX = endPoint.x - startPoint.x;

      // Determine the direction for corner calculation
      const xDir = Math.sign(deltaX) || 1; // Left-to-right (1) or right-to-left (-1)
      const yDir = Math.sign(deltaY) || 1; // Top-to-bottom (1) or bottom-to-top (-1)

      // Helper function to calculate safe corner radius based on segment lengths
      const getSafeRadius = (segment1Length, segment2Length) => {
        // Use minimum of: base radius, half of first segment, half of second segment
        // This prevents corners from exceeding available space
        return Math.min(
          baseCornerRadius,
          Math.abs(segment1Length) / 2,
          Math.abs(segment2Length) / 2
        );
      };

      let pathData;

      // Helper function to get the directional sign for a position
      // Returns -1 for left/up, +1 for right/down
      const getPositionSign = (position) => {
        if (position === 'left' || position === 'top') return -1;
        if (position === 'right' || position === 'bottom') return 1;
        return 1; // default for center
      };

      // Helper function to determine the axis orientation from position string
      // Returns 'x' for left/right, 'y' for top/bottom, 'both' for center
      const getPositionAxis = (position) => {
        if (position === 'left' || position === 'right') return 'x';
        if (position === 'top' || position === 'bottom') return 'y';
        return 'both'; // center or corners
      };

      // Parse edgeAt/vertices parameter if provided: "startOffset,endOffset" in pixels
      // The offset values are ABSOLUTE (always positive), and the sign is automatically
      // applied based on the connection point direction:
      // - "left" → negative X (going left)
      // - "right" → positive X (going right)
      // - "top" → negative Y (going up)
      // - "bottom" → positive Y (going down)
      // e.g., positions="left,bottom" vertices="40,30":
      //   - From "left": 40px becomes -40 (going left)
      //   - To "bottom": 30px becomes +30 (going down)
      // Default: If no vertices provided, use 10 for L-shaped path
      let edgeStart = null;
      let edgeEnd = null;

      if (edgeAt) {
        const edges = edgeAt.split(',');
        const rawEdgeStart = edges[0] ? parseFloat(edges[0]) : null;
        const rawEdgeEnd = edges[1] ? parseFloat(edges[1]) : null;

        // Apply directional sign based on the position
        if (rawEdgeStart !== null) {
          const startSign = getPositionSign(fromPoint);
          edgeStart = Math.abs(rawEdgeStart) * startSign;
        }

        if (rawEdgeEnd !== null) {
          const endSign = getPositionSign(toPoint);
          edgeEnd = Math.abs(rawEdgeEnd) * endSign;
        } else {
          // Default: Use 10px offset for L-shaped path when no vertices specified
          const endSign = getPositionSign(toPoint);
          edgeEnd = 10 * endSign;
        }

      } else {
        // Default: Use 10px offset for L-shaped path when no vertices specified
        const startSign = getPositionSign(fromPoint);
        edgeStart = 10 * startSign;
      }

      // Check if a straight line is possible
      if (Math.abs(deltaY) < 1) {
        // Case: Straight horizontal line (same Y)
        pathData = `M ${startPoint.x},${startPoint.y} L ${endPoint.x},${endPoint.y}`;
      } else if (Math.abs(deltaX) < 1) {
        // Case: Straight vertical line (same X)
        pathData = `M ${startPoint.x},${startPoint.y} L ${endPoint.x},${endPoint.y}`;
      } else if (edgeStart !== null && edgeEnd !== null) {
        // Case: Z-shaped path with two vertices
        // Creates a 4-segment path: Start → Corner1 → Corner2 → Corner3 → End
        // - First vertex: distance from start point (creates Corner1)
        // - Second vertex: distance from end point (creates Corner3)
        // - Corner2 is the intersection point where the two segments meet

        // Calculate Corner1 (end of first segment from start)
        let corner1X, corner1Y;
        if (startOrientation === 'horizontal') {
          corner1X = startPoint.x + edgeStart;
          corner1Y = startPoint.y;
        } else {
          corner1X = startPoint.x;
          corner1Y = startPoint.y + edgeStart;
        }

        // Calculate Corner3 (start of last segment to end)
        let corner3X, corner3Y;
        if (endOrientation === 'horizontal') {
          corner3X = endPoint.x + edgeEnd;
          corner3Y = endPoint.y;
        } else {
          corner3X = endPoint.x;
          corner3Y = endPoint.y + edgeEnd;
        }

        // Calculate Corner2 (intersection/bridge point)
        let corner2X, corner2Y;
        if (startOrientation === 'horizontal' && endOrientation === 'vertical') {
          // Horizontal start → Vertical end
          corner2X = corner1X; // Keep X from corner1 (end of horizontal segment)
          corner2Y = corner3Y; // Match Y from corner3 (level with third segment)
        } else if (startOrientation === 'vertical' && endOrientation === 'horizontal') {
          // Vertical start → Horizontal end
          corner2X = corner3X; // Match X from corner3 (level with third segment)
          corner2Y = corner1Y; // Keep Y from corner1 (end of vertical segment)
        } else if (startOrientation === 'horizontal' && endOrientation === 'horizontal') {
          // Both horizontal
          corner2X = corner1X; // Keep X from corner1
          corner2Y = corner3Y; // Match Y from corner3
        } else {
          // Both vertical
          corner2X = corner3X; // Match X from corner3
          corner2Y = corner1Y; // Keep Y from corner1
        }

        // Calculate segment lengths for accurate corner radii
        const segmentLength1 = Math.sqrt(
          Math.pow(corner1X - startPoint.x, 2) + Math.pow(corner1Y - startPoint.y, 2)
        );
        const segmentLength2 = Math.sqrt(
          Math.pow(corner2X - corner1X, 2) + Math.pow(corner2Y - corner1Y, 2)
        );
        const segmentLength3 = Math.sqrt(
          Math.pow(corner3X - corner2X, 2) + Math.pow(corner3Y - corner2Y, 2)
        );
        const segmentLength4 = Math.sqrt(
          Math.pow(endPoint.x - corner3X, 2) + Math.pow(endPoint.y - corner3Y, 2)
        );

        // Calculate safe radii for each corner
        const radius1 = getSafeRadius(segmentLength1, segmentLength2);
        const radius2 = getSafeRadius(segmentLength2, segmentLength3);
        const radius3 = getSafeRadius(segmentLength3, segmentLength4);

        // Calculate unit directions for each segment
        const dir1X = segmentLength1 > 0 ? (corner1X - startPoint.x) / segmentLength1 : 0;
        const dir1Y = segmentLength1 > 0 ? (corner1Y - startPoint.y) / segmentLength1 : 0;

        const dir2X = segmentLength2 > 0 ? (corner2X - corner1X) / segmentLength2 : 0;
        const dir2Y = segmentLength2 > 0 ? (corner2Y - corner1Y) / segmentLength2 : 0;

        const dir3X = segmentLength3 > 0 ? (corner3X - corner2X) / segmentLength3 : 0;
        const dir3Y = segmentLength3 > 0 ? (corner3Y - corner2Y) / segmentLength3 : 0;

        const dir4X = segmentLength4 > 0 ? (endPoint.x - corner3X) / segmentLength4 : 0;
        const dir4Y = segmentLength4 > 0 ? (endPoint.y - corner3Y) / segmentLength4 : 0;

        // Build Z-shaped path with accurate corner positions
        pathData = `
          M ${startPoint.x},${startPoint.y}
          L ${corner1X - dir1X * radius1},${corner1Y - dir1Y * radius1}
          Q ${corner1X},${corner1Y} ${corner1X + dir2X * radius1},${corner1Y + dir2Y * radius1}
          L ${corner2X - dir2X * radius2},${corner2Y - dir2Y * radius2}
          Q ${corner2X},${corner2Y} ${corner2X + dir3X * radius2},${corner2Y + dir3Y * radius2}
          L ${corner3X - dir3X * radius3},${corner3Y - dir3Y * radius3}
          Q ${corner3X},${corner3Y} ${corner3X + dir4X * radius3},${corner3Y + dir4Y * radius3}
          L ${endPoint.x},${endPoint.y}
        `.trim();
      } else if (edgeStart !== null && edgeEnd === null) {
        // Case: L-shaped path with single vertex
        // Creates a 2-segment path: Start → Corner → End

        let cornerX, cornerY;

        if (startOrientation === 'horizontal') {
          // Horizontal first, then vertical to end
          cornerX = startPoint.x + edgeStart;
          cornerY = endPoint.y;
        } else {
          // Vertical first, then horizontal to end
          cornerX = endPoint.x;
          cornerY = startPoint.y + edgeStart;
        }

        // Calculate segment lengths for accurate corner radius
        const segmentLength1 = Math.sqrt(
          Math.pow(cornerX - startPoint.x, 2) + Math.pow(cornerY - startPoint.y, 2)
        );
        const segmentLength2 = Math.sqrt(
          Math.pow(endPoint.x - cornerX, 2) + Math.pow(endPoint.y - cornerY, 2)
        );
        const radius = getSafeRadius(segmentLength1, segmentLength2);

        pathData = `
          M ${startPoint.x},${startPoint.y}
          L ${cornerX - xDir * radius},${cornerY - yDir * radius}
          Q ${cornerX},${cornerY} ${cornerX + xDir * radius},${cornerY + yDir * radius}
          L ${endPoint.x},${endPoint.y}
        `.trim();
      } else if (edgeEnd !== null && edgeStart === null) {
        // Case: Single edge at end only (",60")
        // edgeEnd interpretation based on toPoint position axis
        const endAxis = getPositionAxis(toPoint);

        if (startOrientation === 'horizontal') {
          // Start → horizontal → Corner ↓ vertical → corner → horizontal(edgeEnd) → End
          // Interpret edgeEnd based on toPoint axis
          const cornerX = endAxis === 'x' ? endPoint.x - edgeEnd :
            endAxis === 'y' ? endPoint.x - (edgeEnd * xDir) :
              endPoint.x - edgeEnd;

          // Calculate safe radius for both corners
          const horizontalDist = Math.abs(startPoint.x - cornerX);
          const verticalDist = Math.abs(deltaY);
          const horizontalDist2 = Math.abs(endPoint.x - cornerX);
          const cornerRadius = getSafeRadius(horizontalDist, verticalDist);
          const cornerRadius2 = getSafeRadius(verticalDist, horizontalDist2);

          // Direction from start to corner and corner to end
          const toCornerDir = Math.sign(cornerX - startPoint.x) || 1;
          const fromCornerDir = Math.sign(endPoint.x - cornerX) || 1;

          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${cornerX - toCornerDir * cornerRadius},${startPoint.y}
            Q ${cornerX},${startPoint.y} ${cornerX},${startPoint.y + yDir * cornerRadius}
            L ${cornerX},${endPoint.y - yDir * cornerRadius2}
            Q ${cornerX},${endPoint.y} ${cornerX + fromCornerDir * cornerRadius2},${endPoint.y}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        } else {
          // Start ↓ Vertical ↓ Corner → horizontal → End
          // Interpret edgeEnd based on toPoint axis
          const endDirY = Math.sign(deltaY) || 1;

          // Calculate safe radius
          const verticalDist = Math.abs(deltaY);
          const horizontalDist = Math.abs(deltaX);
          const cornerRadius = getSafeRadius(verticalDist, horizontalDist);

          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${startPoint.x},${endPoint.y - endDirY * cornerRadius}
            Q ${startPoint.x},${endPoint.y} ${startPoint.x + xDir * cornerRadius},${endPoint.y}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        }
      } else if (edgeStart !== null && edgeEnd === null) {
        // Case: Single edge at start only ("50,")
        if (startOrientation === 'horizontal') {
          // Start → horizontal(edgeStart px) → Corner ↓ Vertical ↓ Corner → End
          const cornerX = startPoint.x + xDir * edgeStart;

          // Calculate safe radius for both corners
          const horizontalDist = Math.abs(edgeStart);
          const verticalDist = Math.abs(deltaY);
          const horizontalDist2 = Math.abs(endPoint.x - cornerX);
          const cornerRadius = getSafeRadius(horizontalDist, verticalDist);
          const cornerRadius2 = getSafeRadius(verticalDist, horizontalDist2);

          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${cornerX - xDir * cornerRadius},${startPoint.y}
            Q ${cornerX},${startPoint.y} ${cornerX},${startPoint.y + yDir * cornerRadius}
            L ${cornerX},${endPoint.y - yDir * cornerRadius2}
            Q ${cornerX},${endPoint.y} ${cornerX + xDir * cornerRadius2},${endPoint.y}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        } else {
          // Start ↓ vertical(edgeStart px) ↓ Corner → horizontal → corner ↓ End
          const cornerY = startPoint.y + yDir * edgeStart;

          // Calculate safe radius for both corners
          const verticalDist = Math.abs(edgeStart);
          const horizontalDist = Math.abs(deltaX);
          const verticalDist2 = Math.abs(endPoint.y - cornerY);
          const cornerRadius = getSafeRadius(verticalDist, horizontalDist);
          const cornerRadius2 = getSafeRadius(horizontalDist, verticalDist2);

          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${startPoint.x},${cornerY - yDir * cornerRadius}
            Q ${startPoint.x},${cornerY} ${startPoint.x + xDir * cornerRadius},${cornerY}
            L ${endPoint.x - xDir * cornerRadius2},${cornerY}
            Q ${endPoint.x},${cornerY} ${endPoint.x},${cornerY + yDir * cornerRadius2}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        }
      } else {
        // Case: No edgeAt specified - use default based on orientation
        if (startOrientation === 'horizontal') {
          // Default horizontal routing: 25%/75% of horizontal distance
          const corner1X = startPoint.x + deltaX * 0.25;
          const corner2X = startPoint.x + deltaX * 0.75;

          // Calculate safe radius for both corners
          const horizontalDist1 = Math.abs(corner1X - startPoint.x);
          const verticalDist = Math.abs(deltaY);
          const horizontalDist2 = Math.abs(endPoint.x - corner2X);
          const cornerRadius = getSafeRadius(horizontalDist1, verticalDist);
          const cornerRadius2 = getSafeRadius(verticalDist, horizontalDist2);

          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${corner1X - xDir * cornerRadius},${startPoint.y}
            Q ${corner1X},${startPoint.y} ${corner1X},${startPoint.y + yDir * cornerRadius}
            L ${corner2X},${endPoint.y - yDir * cornerRadius2}
            Q ${corner2X},${endPoint.y} ${corner2X + xDir * cornerRadius2},${endPoint.y}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        } else {
          // Default vertical routing: 25%/75% of vertical distance
          const corner1Y = startPoint.y + deltaY * 0.25;
          const corner2Y = startPoint.y + deltaY * 0.75;

          // Calculate safe radius for both corners
          const verticalDist1 = Math.abs(corner1Y - startPoint.y);
          const horizontalDist = Math.abs(deltaX);
          const verticalDist2 = Math.abs(endPoint.y - corner2Y);
          const cornerRadius = getSafeRadius(verticalDist1, horizontalDist);
          const cornerRadius2 = getSafeRadius(horizontalDist, verticalDist2);

          pathData = `
            M ${startPoint.x},${startPoint.y}
            L ${startPoint.x},${corner1Y - yDir * cornerRadius}
            Q ${startPoint.x},${corner1Y} ${startPoint.x + xDir * cornerRadius},${corner1Y}
            L ${endPoint.x - xDir * cornerRadius2},${corner2Y}
            Q ${endPoint.x},${corner2Y} ${endPoint.x},${corner2Y + yDir * cornerRadius2}
            L ${endPoint.x},${endPoint.y}
          `.trim();
        }
      }

      path.setAttribute('d', pathData);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');

      // Apply line style (solid or dashed)
      if (lineStyle === 'dashed') {
        path.setAttribute('stroke-dasharray', '8,4');
      }

      // Store original color as data attribute for later restoration
      path.setAttribute('data-original-color', color);

      // Add data attributes and class for highlight
      path.setAttribute('data-connector-from', fromId);
      path.setAttribute('data-connector-to', toId);

      // Support: 'groups' (new, string or array), 'keys' (legacy), or 'key' (single, legacy)
      let keys = connector.groups || connector.keys || (connector.key ? [connector.key] : []);
      // If groups is a string, split it into an array
      if (typeof keys === 'string') {
        keys = keys.split(',').map(k => k.trim());
      }
      if (keys.length > 0) {
        path.setAttribute('data-connector-keys', keys.join(','));
      }
      path.classList.add('connector-path');
      path.style.pointerEvents = 'stroke';
      path.style.cursor = 'pointer';

      svg.appendChild(path);

      // Add invisible wider hit-area path for easier clicking
      const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitArea.setAttribute('d', pathData);
      hitArea.setAttribute('stroke', 'transparent');
      hitArea.setAttribute('stroke-width', '16');
      hitArea.setAttribute('fill', 'none');
      hitArea.setAttribute('stroke-linecap', 'round');
      hitArea.style.pointerEvents = 'stroke';
      hitArea.style.cursor = 'pointer';
      hitArea.classList.add('connector-hit-area');
      if (keys.length > 0) {
        hitArea.setAttribute('data-connector-keys', keys.join(','));
      }
      svg.appendChild(hitArea);

      // Check if this path should be dimmed based on current highlight state
      // Use the stored configuration from cachedPositions (already retrieved above)
      const hasHighlights = this.currentHighlightKeys && this.currentHighlightKeys.length > 0;
      let shouldDimThisPath = false;

      if (hasHighlights && cachedPositions && cachedPositions.groups && cachedPositions.groups.length > 0) {
        // Check if ANY of the connector's groups match ANY of the REQUESTED highlight keys
        // (not the groups of highlighted elements, which may include additional groups)
        const hasMatchingHighlight = cachedPositions.groups.some(connectorKey =>
          this.currentHighlightKeys.includes(connectorKey.trim())
        );

        shouldDimThisPath = !hasMatchingHighlight;

        // If this path should be dimmed, add the dimmed class (for CSS styling)
        if (shouldDimThisPath) {
          path.classList.add('dimmed');
        }
      }

      // Use stored animation style from initial configuration
      const shouldHaveAnimation = cachedPositions?.animationStyle === 'circle';

      // Helper function to create line endings (arrows, circles)
      const createLineEnding = (lineType, point, isStart) => {
        if (!lineType) return;

        const marker = isStart ? 'start' : 'end';

        switch (lineType) {
          case 'arrow':
            path.setAttribute(`marker-${marker}`, `url(#arrowhead-${color.replace('#', '')})`);
            break;
          case 'arrowSmall':
            // Use small arrow marker (30% smaller than regular arrow)
            path.setAttribute(`marker-${marker}`, `url(#arrowhead-small-${color.replace('#', '')})`);
            break;
          case 'circle': {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);
            circle.setAttribute('r', '6');
            circle.setAttribute('fill', color);
            // Note: opacity controlled by CSS (.connector-marker default = 0.8)
            circle.setAttribute('data-original-color', color);
            circle.classList.add('connector-marker');
            circle.style.pointerEvents = 'auto';
            circle.style.cursor = 'pointer';
            if (keys.length > 0) {
              circle.setAttribute('data-connector-keys', keys.join(','));
            }
            svg.appendChild(circle);
            break;
          }
          case 'arrow-circle': {
            // Add both arrow and circle
            path.setAttribute(`marker-${marker}`, `url(#arrowhead-${color.replace('#', '')})`);
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);
            circle.setAttribute('r', '6');
            circle.setAttribute('fill', color);
            // Note: opacity controlled by CSS (.connector-marker default = 0.8)
            circle.setAttribute('data-original-color', color);
            circle.classList.add('connector-marker');
            circle.style.pointerEvents = 'auto';
            circle.style.cursor = 'pointer';
            if (keys.length > 0) {
              circle.setAttribute('data-connector-keys', keys.join(','));
            }
            svg.appendChild(circle);
            break;
          }
        }
      };

      // Apply start and end line styles (only for non-dimmed connectors)
      if (!shouldDimThisPath) {
        createLineEnding(startLine, startPoint, true);
        createLineEnding(endLine, endPoint, false);
      }

      // Add animated circle if:
      // 1. The stored initial config says it should have animation
      // 2. AND the path is not currently dimmed
      const shouldAddAnimation = shouldHaveAnimation && !shouldDimThisPath;

      if (shouldAddAnimation) {
        const animatedCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        animatedCircle.setAttribute('r', '4');
        animatedCircle.setAttribute('fill', color);
        // Note: opacity controlled by CSS (.connector-animated-marker default = 0.9)
        animatedCircle.setAttribute('data-original-color', color);
        animatedCircle.classList.add('connector-animated-marker');
        animatedCircle.style.pointerEvents = 'auto';
        animatedCircle.style.cursor = 'pointer';

        // Create animateMotion element
        const animateMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
        animateMotion.setAttribute('dur', '3s');
        animateMotion.setAttribute('repeatCount', 'indefinite');

        // Start immediately - will be controlled by highlight system
        // animateMotion.setAttribute('begin', 'indefinite');

        // Create mpath element to reference the path
        const mpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');

        // Give the path a unique ID for the mpath reference
        const pathId = `connector-path-${index}-${Date.now()}`;
        path.setAttribute('id', pathId);
        mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pathId}`);

        animateMotion.appendChild(mpath);
        animatedCircle.appendChild(animateMotion);

        // Store animation reference for later control
        animatedCircle.setAttribute('data-animation-id', `animation-${index}`);
        if (keys.length > 0) {
          animatedCircle.setAttribute('data-connector-keys', keys.join(','));
        }

        svg.appendChild(animatedCircle);
      }

    });
  }

  // Helper to determine routing orientation based on connection point
  getPointOrientation(point, oppositePoint, thisPoint, oppositeCoord) {
    // left/right → horizontal first
    if (point === 'left' || point === 'right') {
      return 'horizontal';
    }

    // top/bottom → vertical first
    if (point === 'top' || point === 'bottom') {
      return 'vertical';
    }

    // center → orient based on opposite end
    if (point === 'center') {
      // If opposite is left/right, we should go horizontal first
      if (oppositePoint === 'left' || oppositePoint === 'right') {
        return 'horizontal';
      }
      // If opposite is top/bottom, we should go vertical first
      if (oppositePoint === 'top' || oppositePoint === 'bottom') {
        return 'vertical';
      }
      // If opposite is also center, decide based on which direction has more distance
      const deltaX = Math.abs(oppositeCoord.x - thisPoint.x);
      const deltaY = Math.abs(oppositeCoord.y - thisPoint.y);
      return deltaX > deltaY ? 'horizontal' : 'vertical';
    }

    // corner points → default to horizontal
    return 'horizontal';
  }

  /**
   * Helper to calculate connection point on a scene
   * @param {Object} corners - The corner coordinates of the element
   * @param {string} point - Connection point ('top', 'bottom', 'left', 'right', 'center', etc.)
   * @param {boolean} fromCenter - If true, start drawing from center with offset in direction
   * @param {string} direction - Direction for center offset ('left', 'right', 'top', 'bottom')
   * @returns {Object} Connection point coordinates {x, y}
   * 
   * New Connector Options:
   * - fromCenter: true/false - Start from center of scene instead of edge
   * - toCenter: true/false - End at center of scene instead of edge  
   * - showArrow: true/false - Show triangle arrow at end (default: true)
   * - showStartCircle: true/false - Show circle at start of line (default: false)
   * - showEndCircle: true/false - Show circle at end of line (default: false)
   * - lineStyle: "solid"/"dashed" - Line style (default: "solid")
   * - animated: true/false - Add moving circle animation along path (default: false)
   *   Note: Animation only runs when the connector is highlighted/in focus
   * 
   * Example connector with new options:
   * {
   *   "from": "cube1", 
   *   "fromPoint": "left", 
   *   "fromCenter": true,
   *   "to": "cube2", 
   *   "toPoint": "right",
   *   "toCenter": true, 
   *   "color": "#FF9800",
   *   "lineStyle": "dashed",
   *   "showArrow": false,
   *   "showStartCircle": true,
   *   "showEndCircle": true,
   *   "animated": true
   * }
   */
  getConnectionPoint(corners, point, fromCenter = false, direction = null) {
    const { tl, tr, br, bl } = corners;

    // Calculate center first
    const center = {
      x: (tl.x + br.x) / 2,
      y: (tl.y + br.y) / 2
    };

    // If fromCenter is true, adjust the center point based on direction
    if (fromCenter && direction) {
      const offset = 20; // Distance from center to start drawing
      switch (direction) {
        case 'left':
          return { x: center.x - offset, y: center.y };
        case 'right':
          return { x: center.x + offset, y: center.y };
        case 'top':
          return { x: center.x, y: center.y - offset };
        case 'bottom':
          return { x: center.x, y: center.y + offset };
        default:
          return center;
      }
    }

    // If fromCenter is true but no direction specified, return exact center
    if (fromCenter) {
      return center;
    }

    switch (point) {
      case 'center':
        return center;
      case 'top':
        return {
          x: (tl.x + tr.x) / 2,
          y: (tl.y + tr.y) / 2
        };
      case 'bottom':
        return {
          x: (bl.x + br.x) / 2,
          y: (bl.y + br.y) / 2
        };
      case 'left':
        return {
          x: (tl.x + bl.x) / 2,
          y: (tl.y + bl.y) / 2
        };
      case 'right':
        return {
          x: (tr.x + br.x) / 2,
          y: (tr.y + br.y) / 2
        };
      case 'top-left':
        return { x: tl.x, y: tl.y };
      case 'top-right':
        return { x: tr.x, y: tr.y };
      case 'bottom-left':
        return { x: bl.x, y: bl.y };
      case 'bottom-right':
        return { x: br.x, y: br.y };
      default:
        // Default to center if unknown point
        return center;
    }
  }

  // Update existing SVG overlay without redrawing
  updateSceneDimensions() {
    const perspective = this.container.querySelector('.isometric-perspective');
    const svg = perspective.querySelector('.scene-overlay');
    const perspectiveRect = perspective.getBoundingClientRect();

    if (!svg) return;


    // Update each polygon with new corner positions
    const polygons = svg.querySelectorAll('polygon[data-scene-id]');
    polygons.forEach(polygon => {
      const sceneId = polygon.getAttribute('data-scene-id');
      const scene = document.getElementById(sceneId) || document.querySelector(`.${sceneId}`);

      if (scene) {
        const corners = this.getTransformedCorners(scene, perspectiveRect);
        if (corners) {
          const { tl, tr, br, bl } = corners;
          const points = `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;
          polygon.setAttribute('points', points);
        }
      }
    });

  }

  // Highlight elements by key(s)
  highlightByKey(keys) {
    // Ensure keys is an array
    const keyArray = Array.isArray(keys) ? keys : [keys];

    // Store the requested keys for connector matching
    this.currentHighlightKeys = keyArray;

    this.emit('highlightChange', { action: 'highlight', keys: keyArray, source: this._navigationSource || 'unknown' });

    // First, remove ALL highlighted and dimmed classes from everything
    const allHighlighted = this.container.querySelectorAll('.highlighted');
    allHighlighted.forEach(el => el.classList.remove('highlighted'));

    const allDimmed = this.container.querySelectorAll('.dimmed');
    allDimmed.forEach(el => el.classList.remove('dimmed'));

    const perspective = this.container.querySelector('.isometric-perspective');
    if (!perspective) return;

    // Process all direct children of the perspective recursively
    Array.from(perspective.children).forEach(child => {
      this.processElementRecursive(child, keyArray, undefined);
    });

    // Redraw SVG to properly show/hide animations based on highlight state
    this.captureCoordinatesAndDrawSvg();
  }

  /**
   * Recursive function to process elements and apply highlighting/dimming
   * @param {HTMLElement} element - Current element to process
   * @param {Array<string>} selectedKeys - Array of selected key values (e.g., ["groupC"])
   * @param {string|undefined} parentState - State of parent: 'highlighted', 'not-highlighted', or undefined
   * @returns {boolean} - True if this element or any descendant matched the selected keys
   */
  processElementRecursive(element, selectedKeys, parentState) {
    // Step 1: Check if current element matches any of the selected keys
    const currentMatches = this.elementMatchesCriteria(element, selectedKeys);

    // Step 2: Determine current state based on parent state and match
    let currentState;
    if (parentState === 'highlighted') {
      // Parent is highlighted → inherit highlighted state
      currentState = 'highlighted';
    } else if (parentState === undefined && currentMatches) {
      // First-level match → set as highlighted
      currentState = 'highlighted';
    } else {
      // No match and parent not highlighted
      currentState = 'not-highlighted';
    }

    // Step 3: Apply .highlighted class if current element matches
    if (currentMatches) {
      element.classList.add('highlighted');

      // Restore original colors if previously dimmed
      this.restoreElementColors(element);
    }

    // Step 4: Recursively process all direct children
    let anyChildMatched = false;
    Array.from(element.children).forEach(child => {
      const childMatched = this.processElementRecursive(child, selectedKeys, currentState);
      anyChildMatched = anyChildMatched || childMatched;
    });

    // Step 5: Determine if this element or any descendant matched
    const hasMatch = currentMatches || anyChildMatched;

    // Step 6: Apply dimming logic using alpha channel modification
    // Only dim if:
    // - Element itself didn't match
    // - No descendant matched
    // - Parent is not highlighted (children of highlighted parents stay in default state)
    const shouldDim = !hasMatch && parentState !== 'highlighted';

    if (shouldDim) {
      // Apply alpha-based dimming (preserves 3D transforms, no stacking context)
      this.applyAlphaDimming(element);
    } else if (!currentMatches) {
      // Element doesn't match but is protected by parent or has matching children
      // Restore original colors if previously dimmed
      this.restoreElementColors(element);
    }

    // Step 7: Return whether this subtree had any match
    return hasMatch;
  }

  /**
   * Check if an element matches the selected criteria (data-related-keys OR data-key)
   * @param {HTMLElement} element - Element to check
   * @param {Array<string>} selectedKeys - Array of selected key values
   * @returns {boolean} - True if element matches any of the selected keys
   */
  elementMatchesCriteria(element, selectedKeys) {
    // Check data-related-keys attribute
    const groupsAttr = element.getAttribute('data-related-keys');
    if (groupsAttr) {
      const groups = groupsAttr.split(',').map(g => g.trim());
      if (groups.some(group => selectedKeys.includes(group))) {
        return true;
      }
    }

    // Check data-key attribute (implicit membership)
    const activateAttr = element.getAttribute('data-key');
    if (activateAttr) {
      const activateKeys = activateAttr.split(',').map(k => k.trim());
      if (activateKeys.some(key => selectedKeys.includes(key))) {
        return true;
      }
    }

    // Check data-connector-keys attribute (for SVG connectors)
    const connectorKeysAttr = element.getAttribute('data-connector-keys');
    if (connectorKeysAttr) {
      const connectorKeys = connectorKeysAttr.split(',').map(k => k.trim());
      if (connectorKeys.some(key => selectedKeys.includes(key))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Apply dimming by modifying color alpha channels instead of opacity/filter
   * This avoids creating stacking contexts that break transform-style: preserve-3d
   * @param {HTMLElement} element - Element to dim
   */
  applyAlphaDimming(element) {
    // Store original styles if not already stored
    if (!element.hasAttribute('data-original-styles')) {
      const computedStyle = window.getComputedStyle(element);
      const originalStyles = {
        backgroundColor: computedStyle.backgroundColor,
        borderColor: computedStyle.borderColor,
        color: computedStyle.color,
        stroke: element.getAttribute('stroke') || '', // For SVG elements
        fill: element.getAttribute('fill') || '' // For SVG elements
      };
      element.setAttribute('data-original-styles', JSON.stringify(originalStyles));
    }

    // Get original styles
    const storedStyles = JSON.parse(element.getAttribute('data-original-styles') || '{}');

    // Apply dimmed colors with configured alpha values
    if (storedStyles.backgroundColor && storedStyles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      element.style.backgroundColor = this.modifyColorAlpha(storedStyles.backgroundColor, this.dimmingAlpha.backgroundColor);
    }

    if (storedStyles.borderColor && storedStyles.borderColor !== 'rgba(0, 0, 0, 0)') {
      element.style.borderColor = this.modifyColorAlpha(storedStyles.borderColor, this.dimmingAlpha.borderColor);
    }

    if (storedStyles.color) {
      element.style.color = this.modifyColorAlpha(storedStyles.color, this.dimmingAlpha.color);
    }

    // Handle SVG elements (paths, circles)
    if (element.tagName === 'path' || element.tagName === 'circle') {
      if (storedStyles.stroke) {
        element.setAttribute('stroke', this.modifyColorAlpha(storedStyles.stroke, this.dimmingAlpha.svg));
      }
      if (storedStyles.fill) {
        element.setAttribute('fill', this.modifyColorAlpha(storedStyles.fill, this.dimmingAlpha.svg));
      }
    }

    // Mark as dimmed for state tracking
    element.setAttribute('data-dimmed', 'true');
  }

  /**
   * Restore original colors by removing alpha dimming
   * @param {HTMLElement} element - Element to restore
   */
  restoreElementColors(element) {
    const storedStyles = JSON.parse(element.getAttribute('data-original-styles') || '{}');

    if (!element.hasAttribute('data-dimmed')) {
      return; // Not dimmed, nothing to restore
    }

    // Restore original colors
    if (storedStyles.backgroundColor) {
      element.style.backgroundColor = storedStyles.backgroundColor;
    }

    if (storedStyles.borderColor) {
      element.style.borderColor = storedStyles.borderColor;
    }

    if (storedStyles.color) {
      element.style.color = storedStyles.color;
    }

    // Handle SVG elements
    if (element.tagName === 'path' || element.tagName === 'circle') {
      if (storedStyles.stroke) {
        element.setAttribute('stroke', storedStyles.stroke);
      }
      if (storedStyles.fill) {
        element.setAttribute('fill', storedStyles.fill);
      }
    }

    // Remove dimmed state
    element.removeAttribute('data-dimmed');
  }

  /**
   * Modify the alpha channel of a color string
   * Handles rgb(), rgba(), #hex formats
   * @param {string} colorString - Color in any CSS format
   * @param {number} newAlpha - New alpha value (0-1)
   * @returns {string} - Color in rgba() format with modified alpha
   */
  modifyColorAlpha(colorString, newAlpha) {
    // Parse rgba() or rgb() format
    const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      const [, r, g, b] = rgbaMatch;
      return `rgba(${r}, ${g}, ${b}, ${newAlpha})`;
    }

    // Parse hex format (#RRGGBB or #RGB)
    const hexMatch = colorString.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      let hex = hexMatch[1];
      // Expand short hex (#RGB -> #RRGGBB)
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, ${newAlpha})`;
    }

    // Fallback: return original color with reduced opacity via rgba
    // This handles named colors like 'red', 'blue', etc.
    return colorString;
  }

  // Start all animations (for default view)
  startAllAnimations() {
    const allAnimatedMarkers = this.container.querySelectorAll('.connector-animated-marker');
    allAnimatedMarkers.forEach(marker => {
      const animateMotion = marker.querySelector('animateMotion');
      if (animateMotion) {
        animateMotion.beginElement();
      }
    });
  }

  // Clear all highlights
  clearHighlights() {
    // Clear the stored highlight keys
    this.currentHighlightKeys = null;

    this.emit('highlightChange', { action: 'clear', keys: null, source: this._navigationSource || 'unknown' });

    // Remove .highlighted class from all elements
    const allHighlighted = this.container.querySelectorAll('.highlighted');
    allHighlighted.forEach(el => el.classList.remove('highlighted'));

    // Restore original colors for all dimmed elements
    const allDimmed = this.container.querySelectorAll('[data-dimmed="true"]');
    allDimmed.forEach(el => {
      this.restoreElementColors(el);
      el.removeAttribute('data-original-styles');
    });

    // Redraw SVG to restore all animations
    this.captureCoordinatesAndDrawSvg();
  }

  // Toggle highlight for specific key
  toggleHighlight(key) {
    // Placeholder for new toggle highlight implementation
  }

  destroy() {
    this.removeEventListeners();
    clearTimeout(this.urlUpdateTimeout);

    // Clean up compact controls if they exist
    const compactControls = this.container.querySelector('.compact-controls');
    if (compactControls) {
      compactControls.remove();
    }
  }
}

// Expose Phase enum on the class for external consumers
Isometric3D.Phase = Phase;

// Global registry for multiple instances
window.isometric3DInstances = window.isometric3DInstances || {};

// Helper function to create and manage instances
function createIsometric3D(containerId, options = {}) {
  // Clean up existing instance if it exists
  if (window.isometric3DInstances[containerId]) {
    window.isometric3DInstances[containerId].destroy();
  }

  // Create new instance
  const instance = new Isometric3D(containerId, options);
  window.isometric3DInstances[containerId] = instance;

  return instance;
}

// Helper function to get instance
function getIsometric3D(containerId) {
  return window.isometric3DInstances[containerId];
}

// Helper function to destroy instance
function destroyIsometric3D(containerId) {
  if (window.isometric3DInstances[containerId]) {
    window.isometric3DInstances[containerId].destroy();
    delete window.isometric3DInstances[containerId];
  }
}
