# Isometric 3D Presenter

A modern, interactive 3D isometric presentation tool with smooth navigation, highlighting system, SVG connectors, and scroll synchronization. Perfect for creating engaging presentations, visualizing architecture diagrams, workflows, and interactive 3D storytelling experiences.

## Features

- **3D Isometric Presentation**: CSS3-based 3D transforms with smooth transitions for storytelling
- **Interactive Navigation**: Mouse drag, keyboard controls, and programmatic navigation between scenes
- **SVG Connectors**: Draw animated connections between elements with customizable styles
- **Highlighting System**: Multi-key highlighting with focus-based animations and automatic dimming
- **Scroll Synchronization**: Sync 3D navigation with page scrolling for seamless storytelling
- **Presentation Controls**: Spherical controller with navigation dots and keyboard shortcuts
- **Responsive Design**: Works on desktop and mobile devices for any presentation environment
- **URL Bookmarking**: Save and share specific presentation states via URL parameters
- **Multiple Presentations**: Run multiple independent presenters on the same page

## Installation

```bash
npm install isometric-3d-presenter
```

## Quick Start

### Basic Presentation Setup

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/isometric-3d-presenter/src/isometric-3d.css">
</head>
<body>
  <div id="presentation" class="isometric-container">
    <div class="isometric-perspective">
      <div id="scene1" class="scene" data-width="100" data-height="100" data-depth="100">
        <div class="face front">Scene 1</div>
        <div class="face back">Back</div>
        <div class="face left">Left</div>
        <div class="face right">Right</div>
        <div class="face top" data-nav-xyz="45.0.-35" data-nav-zoom="1.2">Main Content</div>
        <div class="face bottom">Bottom</div>
      </div>
    </div>
  </div>

  <script src="node_modules/isometric-3d-presenter/src/isometric-3d.js"></script>
  <script>
    const presenter = createIsometric3D('presentation', {
      defaultRotation: { x: 45, y: 0, z: -35 },
      defaultZoom: 1.0,
      showCompactControls: true
    });
  </script>
</body>
</html>
```

### Basic CSS Setup

Customize the appearance of your 3D scenes with different colors for each face and highlight effects:

```html
<style>
  /* Container styling */
  .isometric-container {
    height: 500px;
    width: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  /* Default face styling with semi-transparent colors */
  .face {
    border: 1px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }

  /* Different colors for each face */
  .face.front {
    background: rgba(52, 152, 219, 0.7);  /* Blue */
  }

  .face.back {
    background: rgba(46, 204, 113, 0.7);  /* Green */
  }

  .face.left {
    background: rgba(155, 89, 182, 0.7);  /* Purple */
  }

  .face.right {
    background: rgba(241, 196, 15, 0.7);  /* Yellow */
  }

  .face.top {
    background: rgba(231, 76, 60, 0.7);   /* Red */
  }

  .face.bottom {
    background: rgba(52, 73, 94, 0.7);    /* Dark blue */
  }

  /* Highlighted state - brighter and more opaque */
  .scene.highlight .face,
  .face.highlight {
    opacity: 1 !important;
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
  }

  /* Make highlighted faces more vibrant */
  .face.front.highlight {
    background: rgba(52, 152, 219, 0.95);
  }

  .face.back.highlight {
    background: rgba(46, 204, 113, 0.95);
  }

  .face.left.highlight {
    background: rgba(155, 89, 182, 0.95);
  }

  .face.right.highlight {
    background: rgba(241, 196, 15, 0.95);
  }

  .face.top.highlight {
    background: rgba(231, 76, 60, 0.95);
  }

  .face.bottom.highlight {
    background: rgba(52, 73, 94, 0.95);
  }

  /* Currently selected navigation target */
  .face.nav-selected {
    outline: 3px solid rgba(255, 0, 191, 0.9);
    outline-offset: 3px;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
    }
    50% {
      box-shadow: 0 0 30px rgba(255, 255, 255, 0.4);
    }
  }

  /* Dimming non-highlighted elements */
  .isometric-perspective:has(.highlight[data-activate]) .scene:not(.highlight) > .face {
    opacity: 0.2;  /* Dim to 20% when other elements are highlighted */
    filter: grayscale(50%);
  }

  /* Dim child content inside non-highlighted scenes */
  .isometric-perspective:has(.highlight[data-activate]) .scene:not(.highlight) > *:not(.face) {
    opacity: 0.3;
  }

  /* Scene styling */
  .scene {
    font-family: 'Arial', sans-serif;
    font-size: 14px;
    color: white;
    font-weight: bold;
  }

  /* Hover effect for navigable elements */
  [data-nav-xyz]:hover,
  [data-nav-zoom]:hover {
    transform: scale(1.02);
  }
</style>
```

**CSS Customization Tips:**

1. **Face Colors**: Use `rgba()` colors with alpha channel (0.7) for semi-transparency
2. **Highlighting**: Increase opacity to 0.95 and add `box-shadow` for highlighted state
3. **Dimming**: Non-highlighted faces automatically dim to `opacity: 0.2` (default)
4. **Borders**: Use `rgba(255, 255, 255, 0.3)` for subtle borders
5. **Animations**: Add `@keyframes` for pulse effects on selected elements
6. **Backdrop Filter**: Use `backdrop-filter: blur(10px)` for frosted glass effect

**Complete Example with Highlighting:**

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/isometric-3d-presenter/src/isometric-3d.css">
  <style>
    .isometric-container {
      height: 500px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .face {
      border: 1px solid rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(10px);
    }

    .face.front { background: rgba(52, 152, 219, 0.7); }
    .face.back { background: rgba(46, 204, 113, 0.7); }
    .face.left { background: rgba(155, 89, 182, 0.7); }
    .face.right { background: rgba(241, 196, 15, 0.7); }
    .face.top { background: rgba(231, 76, 60, 0.7); }
    .face.bottom { background: rgba(52, 73, 94, 0.7); }

    .face.highlight {
      opacity: 1 !important;
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
    }
  </style>
</head>
<body>
  <div id="demo" class="isometric-container">
    <div class="isometric-perspective">
      <div class="scene" data-width="100" data-height="100" data-depth="100" data-groups="cube1">
        <div class="face front">Front</div>
        <div class="face back">Back</div>
        <div class="face left">Left</div>
        <div class="face right">Right</div>
        <div class="face top" 
             data-nav-xyz="45.0.-35" 
             data-nav-zoom="1.2"
             data-activate="cube1">
          Click Me
        </div>
        <div class="face bottom">Bottom</div>
      </div>
    </div>
  </div>

  <script src="node_modules/isometric-3d-presenter/src/isometric-3d.js"></script>
  <script>
    createIsometric3D('demo', {
      showCompactControls: true
    });
  </script>
</body>
</html>
```

## Configuration Options

### Core Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultRotation` | Object | `{x: 45, y: 0, z: -35}` | Initial rotation angles |
| `defaultZoom` | Number | `1.0` | Initial zoom level |
| `showCompactControls` | Boolean | `false` | Show spherical controller |
| `bookmarkPrefix` | String | `containerId_` | URL parameter prefix |
| `navSelectedTarget` | String | `'clicked'` | Which face gets `.nav-selected` class: `'clicked'`, `'top'`, `'bottom'`, `'front'`, `'back'`, `'left'`, `'right'` |
| `dimmingAlpha` | Object | See below | Alpha values for dimming non-highlighted elements |

### Dimming Configuration

Control the transparency of non-highlighted elements during highlighting mode:

```javascript
const presenter = createIsometric3D('presentation', {
  dimmingAlpha: {
    backgroundColor: 0.2,  // 20% opacity for backgrounds (default: 0.2)
    borderColor: 0.2,      // 20% opacity for borders (default: 0.2)
    color: 0.3,            // 30% opacity for text - more readable (default: 0.3)
    svg: 0.25              // 25% opacity for SVG stroke/fill (default: 0.25)
  }
});
```

**How it works:**

- When elements are highlighted, non-highlighted elements are dimmed by reducing the **alpha channel** of their colors
- Uses JavaScript color manipulation instead of CSS `opacity` to preserve 3D transforms
- Original colors are stored and restored when clearing highlights
- Smooth CSS transitions (0.3s ease) for all color changes

**Benefits of alpha-based dimming:**

- ✅ Preserves `transform-style: preserve-3d` on nested elements
- ✅ No CSS stacking context issues
- ✅ Maintains 3D depth and perspective
- ✅ Smooth color transitions
- ✅ Works with any color format (rgb, rgba, hex)

**Customization examples:**

```javascript
// More dramatic dimming
dimmingAlpha: {
  backgroundColor: 0.1,  // 10% - very faint
  borderColor: 0.1,
  color: 0.2,
  svg: 0.15
}

// Subtle dimming
dimmingAlpha: {
  backgroundColor: 0.4,  // 40% - still quite visible
  borderColor: 0.4,
  color: 0.5,
  svg: 0.45
}

// Text-focused dimming
dimmingAlpha: {
  backgroundColor: 0.15,
  borderColor: 0.15,
  color: 0.6,  // Keep text more readable
  svg: 0.2
}
```

### Navigation Selected Target

The `navSelectedTarget` option controls which face receives the `.nav-selected` class when clicking on a face. This is useful for always highlighting a specific face (e.g., the bottom face) regardless of which face was clicked.

**Example:**

```javascript
const presenter = createIsometric3D('presentation', {
  navSelectedTarget: 'bottom'  // Always highlight the bottom face
});
```

When you click on the `top` face, the `.nav-selected` class will be applied to the `bottom` face instead. If the target face doesn't exist, it falls back to the clicked element.

**Use cases:**

- Display important information on a specific face (e.g., bottom) that should always be highlighted
- Create consistent visual feedback regardless of viewing angle
- Separate the interaction target from the visual selection indicator

### Rotation Limits

```javascript
rotationLimits: {
  x: { min: 0, max: 90 },
  y: { min: -180, max: 180 },
  z: { min: -180, max: 180 }
}
```

### Mouse Sensitivity

```javascript
mouseSensitivity: {
  x: 0.5,  // X-axis rotation sensitivity
  y: 0.3,  // Y-axis rotation sensitivity
  z: 0.5   // Z-axis rotation sensitivity
}
```

## Scene Configuration

### 3D Cubes

```html
<div class="scene" data-width="100" data-height="100" data-depth="100" data-z-axis="50">
  <div class="face front">Front</div>
  <div class="face back">Back</div>
  <div class="face left">Left</div>
  <div class="face right">Right</div>
  <div class="face top">Top</div>
  <div class="face bottom">Bottom</div>
</div>
```

### Flat Scenes (2D Elements)

```html
<div class="scene" data-z-axis="80">2D Content</div>
```

### Layout Utilities for Face Content

The library provides flex layout utility classes for organizing content within faces:

#### `.flex-row` and `.flex-column`

Organize child elements in horizontal or vertical layouts with automatic spacing:

```html
<div class="face front flex-column">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

<div class="face top flex-row">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>
```

**Features:**

- Automatic 5px gap between items
- Child elements scale to 1.1x on hover for interactive feedback
- Elements are positioned with `position: initial` and `width: 100%` for proper flex layout
- Works perfectly with automatic height calculation (when `data-height` is omitted)

**Example with automatic height calculation:**

```html
<div class="scene" 
     data-width="200" 
     data-depth="100">
  <div class="face left flex-column">
    <div>Dashboard</div>
    <div>Settings</div>
    <div>Profile</div>
    <div>Logout</div>
  </div>
  <div class="face right flex-row">
    <div>📊</div>
    <div>⚙️</div>
    <div>👤</div>
  </div>
  <div class="face top">Menu</div>
  <div class="face bottom">Footer</div>
</div>
```

**Use cases:**

- ✅ Lists of items (flex-column)
- ✅ Navigation buttons (flex-row)
- ✅ Dashboard widgets (flex-row/flex-column)
- ✅ Feature lists with icons
- ✅ Dynamic content that needs to flow vertically or horizontally

### Data Attributes

#### For Cuboids (`.cuboid`)

- `data-width` - Width of the cuboid. Supports:
  - **Pixel values**: `"100"` → 100px width
  - **Percentage values**: `"100%"` → 100% of parent's width, `"80%"` → 80% of parent's width
  - **Auto value**: `"auto"` → Automatically measured from content
  - **Omitted**: Same as `"auto"`
  
- `data-height` - Height of the cuboid (vertical dimension). Supports:
  - **Pixel values**: `"60"` → 60px height
  - **Percentage values**: `"50%"` → 50% of parent's height
  - **Auto value**: `"auto"` → Automatically calculated from content (recommended)
  - **Omitted**: Same as `"auto"`
  
- `data-depth` - Depth of the cuboid (front-to-back dimension). Supports:
  - **Pixel values**: `"100"` → 100px depth
  - **Percentage values**: `"100%"` → 100% of parent's height (depth maps to parent's CSS height)
  - **Auto value**: `"auto"` → Automatically measured from content
  - **Omitted**: Same as `"auto"`

#### For Scenes (`.scene`)

- `data-z-axis` - Z-axis offset for elevation and shadow effects (only for `.scene` elements)

**Important:** The `data-z-axis` attribute is specifically for scene elements to control shadows and elevation.

#### Percentage-Based Sizing

Percentage values allow cuboids to automatically fill a portion of their parent container's available space. This is perfect for responsive designs where you want cuboids to adapt to their container's size.

**Example: Cuboid filling 100% of parent space**

```html
<div class="scene" style="width: 300px; height: 300px;">
  <div class="cuboid" data-width="100%" data-height="60" data-depth="100%">
    <!-- Cuboid will be 300×60×300 (fills parent's 300×300 space) -->
    <div class="front">Front</div>
    <div class="back">Back</div>
    <div class="left">Left</div>
    <div class="right">Right</div>
    <div class="top">Top</div>
    <div class="bottom">Bottom</div>
  </div>
</div>
```

**Example: Cuboid using 80% of parent space (automatically centered)**

```html
<div class="scene" style="min-width: 400px; min-height: 400px;">
  <div class="cuboid" data-width="80%" data-height="60" data-depth="80%">
    <!-- Cuboid will be 320×60×320 (80% of 400×400, centered with 10% margin on all sides) -->
    <div class="front">Centered Cuboid</div>
    <!-- ...other faces... -->
  </div>
</div>
```

**Key behaviors:**

- **`data-width` percentage** → Calculated from parent's CSS `width` (including `min-width`, `max-width`)
- **`data-depth` percentage** → Calculated from parent's CSS `height` (including `min-height`, `max-height`)
- **`data-height` percentage** → Calculated from parent's CSS `height`
- **Automatic centering** → Cuboids are automatically centered within their parent via CSS transforms
- **Responsive** → Updates when parent container is resized

**Use cases:**

- ✅ Responsive designs where container size varies
- ✅ Filling available space without hardcoding pixel values
- ✅ Maintaining aspect ratios relative to parent
- ✅ Creating padding/margins via percentages (e.g., `"90%"` creates 5% margin on each side)
- ✅ Avoiding manual synchronization between CSS and HTML attributes

#### Automatic Height Calculation

When `data-height` is not specified, the system automatically measures and calculates the height based on the actual rendered content of the side faces (front, back, left, right). This is perfect for dynamic content where you don't know the height in advance.

```html
<div id="cube1" class="scene" 
     data-width="100" 
     data-depth="100">
  <div class="face front">Front content</div>
  <div class="face back">Back content</div>
  <div class="face left">
    <!-- Dynamic content with unknown height -->
    <div>Item 1</div>
    <div>Item 2</div>
    <div>Item 3</div>
    <div>Item 4</div>
  </div>
  <div class="face right">Right content</div>
  <div class="face top">Top face</div>
  <div class="face bottom">Bottom face</div>
</div>
```

**How it works:**

1. During initialization, the scene temporarily renders with no 3D transforms
2. The actual `scrollHeight` of `.face.left`, `.face.right`, `.face.front`, and `.face.back` is measured
3. The maximum height among these side faces becomes the scene's height (top/bottom faces are excluded)
4. The scene is then configured with the calculated height

**Use cases:**

- ✅ Flex layouts (`flex-column`/`flex-row`) with variable number of items
- ✅ Dynamic content loaded from APIs or user input
- ✅ Responsive text that changes based on viewport
- ✅ Nested elements with unknown combined height
- ✅ Lists, menus, or navigation with varying content
- ✅ Ensuring top/bottom faces align with the tallest side face

## Navigation

### Programmatic Navigation

```html
<div class="face top" 
     data-nav-xyz="45.00.-35" 
     data-nav-zoom="1.2"
     data-nav-pan="100.-50"
     data-section="section1">
  Click to navigate
</div>
```

### Navigation Data Attributes

- `data-nav-xyz` - Target rotation (format: "x.y.z" with dots, or `"current"` to keep current rotation)
- `data-nav-zoom` - Target zoom level (e.g., "1.2", or `"current"` to keep current zoom)
- `data-nav-pan` - Target pan/translation (format: "x.y" with dot separator, or `"current"` to keep current pan) - **Optional**
- `data-section` - Unique section identifier for navigation

#### Using Special Keywords for Navigation Control

The navigation system supports special keywords for fine-grained control over camera behavior:

##### `"current"` - Keep Current Value

To enable element selection and highlighting **without changing the camera position**, use the keyword `"current"` for any navigation attribute:

```html
<!-- Select and highlight without moving camera -->
<div class="face" 
     data-section="featureA" 
     data-activate="database"
     data-nav-xyz="current" 
     data-nav-zoom="current">
  Feature A
</div>

<!-- Only lock rotation, allow zoom/pan to change -->
<div class="face" 
     data-section="featureB" 
     data-activate="workflow"
     data-nav-xyz="current" 
     data-nav-zoom="1.5">
  Feature B (zooms but doesn't rotate)
</div>

<!-- Lock zoom but allow rotation -->
<div class="face" 
     data-section="featureC" 
     data-activate="integration"
     data-nav-xyz="15.00.-45" 
     data-nav-zoom="current">
  Feature C (rotates but doesn't zoom)
</div>
```

##### `"default"` - Reset to Initial Value

Use `"default"` to return to the initial/default camera position set during initialization:

```html
<!-- Return to default pan position (0,0,0) -->
<div class="face" 
     data-section="reset-view" 
     data-nav-xyz="45.0.-35"
     data-nav-zoom="1.0"
     data-nav-pan="default">
  Reset to home position
</div>

<!-- Keep current rotation/zoom but reset pan -->
<div class="face" 
     data-section="center-view" 
     data-nav-xyz="current"
     data-nav-zoom="current"
     data-nav-pan="default">
  Center view
</div>
```

**Summary of Keywords:**

| Keyword | Behavior | Example Use Case |
|---------|----------|------------------|
| `"current"` | Preserve current camera value | Selection without navigation, partial updates |
| `"default"` | Reset to initial value from config | Return to home view, reset pan after zooming |
| (omitted) | Auto-calculate (for pan only) | Automatic centering on clicked element |
| Numeric | Set specific value | Precise camera positioning |

**Use Cases:**

- ✅ Nested faces inside flex-column/flex-row that should be selectable but not navigate
- ✅ Interactive elements that trigger highlighting without camera movement
- ✅ Menu items or navigation lists that activate different highlight groups
- ✅ Partial navigation (e.g., change rotation but keep current zoom)
- ✅ "Home" or "Reset" buttons that return to initial view
- ✅ Combine keywords for complex behaviors (e.g., `data-nav-pan="default"` with `data-nav-zoom="current"`)

**Behavior:**

- Elements with navigation keywords are still treated as navigable (get glass hover effect, appear in navigation bar)
- Clicking them applies highlights via `data-activate`
- Can mix keywords with actual values for fine control
- `"current"` preserves the exact current state
- `"default"` uses values from `defaultRotation`, `defaultZoom`, and `defaultTranslation` in config

**Auto-Centering:** When `data-nav-pan` is not defined (neither keyword nor numeric value), the system automatically calculates the pan position to center the **parent scene** of the clicked element in the viewport. For faces, this means centering the entire cube rather than the individual face. This ensures optimal viewing without manual pan calculations.

```html
<!-- Auto-centered navigation (recommended) -->
<div class="face top" 
     data-nav-xyz="45.0.-35" 
     data-nav-zoom="1.2"
     data-section="intro">
  <!-- Element will be centered automatically -->
</div>

<!-- Manual pan override (when specific positioning is needed) -->
<div class="face top" 
     data-nav-xyz="45.0.-35" 
     data-nav-zoom="1.2"
     data-nav-pan="100.-50"
     data-section="custom-position">
  <!-- Element positioned at specific pan coordinates -->
</div>
```

#### Navigation Bar Behavior

The navigation bar displays circular indicators for each unique navigation point. The system automatically:

1. **Deduplicates** - If multiple elements share the same `data-section` value, only one navigation dot appears
2. **Sorts alphabetically** - Navigation dots are ordered alphanumerically by `data-section` name

**Naming Recommendations:**

To control the order of navigation dots, use prefixed numbering in your `data-section` names:

```html
<!-- ✅ Good: Ordered presentation flow -->
<div class="face top" data-section="01-intro" data-nav-xyz="45.0.-35">Introduction</div>
<div class="face top" data-section="02-features" data-nav-xyz="30.0.-45">Features</div>
<div class="face top" data-section="03-demo" data-nav-xyz="15.0.-55">Demo</div>
<div class="face top" data-section="04-conclusion" data-nav-xyz="0.0.-35">Conclusion</div>

<!-- ✅ Good: Topic-based grouping -->
<div class="face top" data-section="api-overview" data-nav-xyz="45.0.0">API Overview</div>
<div class="face top" data-section="api-endpoints" data-nav-xyz="45.0.-30">API Endpoints</div>
<div class="face top" data-section="database-schema" data-nav-xyz="30.0.0">Database</div>

<!-- ❌ Avoid: Unordered naming -->
<div class="face top" data-section="conclusion" data-nav-xyz="0.0.-35">Conclusion</div>
<div class="face top" data-section="intro" data-nav-xyz="45.0.-35">Introduction</div>
<!-- Navigation bar will show: conclusion → intro (alphabetical, not logical order) -->
```

**Common Naming Patterns:**

- **Sequential**: `"01-intro"`, `"02-overview"`, `"03-details"`, `"04-summary"`
- **Hierarchical**: `"1.1-setup"`, `"1.2-config"`, `"2.1-usage"`, `"2.2-advanced"`
- **Categorized**: `"a-frontend"`, `"b-backend"`, `"c-database"`, `"d-infrastructure"`
- **Semantic**: `"intro"`, `"main"`, `"conclusion"` (works when natural alphabetical order matches presentation order)

### Navigation API Methods

```javascript
// Navigate programmatically
viewer.navigateToPosition("45.00.-35", "1.2");

// Navigate by key/ID
viewer.navigateByKey("section1");

// Set rotation
viewer.setRotation(45, 0, -35);

// Set zoom
viewer.setZoom(1.5);

// Reset to default view
viewer.resetView();

// Get current state
const state = viewer.getState();
```

## SVG Connectors

Draw connections between elements with automatic routing and customizable line endings:

```html
<div class="isometric-perspective" 
     data-connectors='[
       {
         "ids": "cube1,cube2",
         "positions": "top,bottom",
         "color": "#4CAF50",
         "endStyles": "circle,arrow",
         "lineStyle": "solid",
         "animationStyle": "circle",
         "groups": "workflow,integration"
       }
     ]'>
  <!-- scenes -->
</div>
```

### Connector Configuration

#### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `ids` | String | - | Element IDs: `"from,to"` (e.g., `"cube1,cube2"`) |
| `positions` | String | - | Connection points: `"fromPoint,toPoint"` (e.g., `"top,bottom"`, `"center,left"`) |
| `vertices` | String | - | Edge positioning: `"50,40"` = 50px from start, 40px before end; `"50"` = only start edge; `",40"` = only end edge |
| `color` | String | `"#4CAF50"` | Line color (hex or CSS color) |
| `endStyles` | String | `undefined` | Line endings: `"start,end"` (e.g., `"circle,arrow"`, `",arrowSmall"`, `"arrow-circle,circle"`) |
| `lineStyle` | String | `"solid"` | Line style: `"solid"` or `"dashed"` |
| `animationStyle` | String | `undefined` | Animated marker: `"circle"` or `undefined` |
| `groups` | String | - | Group membership for highlighting (e.g., `"workflow,integration"`) |

**Position values:** `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`

**End style values:** `arrow`, `arrowSmall`, `circle`, `arrow-circle`, or empty for no marker

**Note:** Using `positions="center,..."` automatically enables center-based connection.

### Connector Defaults

Set global defaults for all connectors to avoid repetition:

```javascript
const presenter = createIsometric3D('presentation', {
  connectorDefaults: {
    startLine: undefined,      // Default: no start marker
    endLine: 'arrow',          // Default: arrow at end
    lineStyle: 'solid',        // Default: solid line
    animationStyle: undefined  // Default: no animation
  }
});
```

Individual connectors can override these defaults.

### Line Ending Options

**Arrow Markers:**

- `"arrow"` - Standard arrow (full size)
- `"arrowSmall"` - Small arrow (30% smaller, perfect for subtle connections)

**Circle Markers:**

- `"circle"` - Circular dot marker

**Combined:**

- `"arrow-circle"` - Both arrow and circle at the same point

**None:**

- `undefined` - No marker

**Example with different line endings:**

```javascript
// Small arrow at start, large arrow at end
{
  "ids": "cube1,cube2",
  "positions": "right,left",
  "endStyles": "arrowSmall,arrow",
  "color": "#2196F3"
}

// Circle at both ends
{
  "ids": "cube2,cube3",
  "positions": "bottom,top",
  "endStyles": "circle,circle",
  "color": "#FF9800"
}

// No start marker, arrow with circle at end, animated, with custom routing
{
  "ids": "cube3,cube4",
  "positions": "center,left",
  "vertices": "50",
  "endStyles": ",arrow-circle",
  "animationStyle": "circle",
  "color": "#4CAF50"
}
```

### Edge Routing Examples

```javascript
// Two corners at specific positions
{"vertices": "50,40"}  // First corner at 50px, second corner 40px before end

// Single corner at end
{"vertices": ",60"}  // Corner 60px before end

// Single corner at start
{"vertices": "80"}  // Corner at 80px from start
```

## Highlighting System

The highlighting system allows you to create visual focus effects on specific scenes and connectors. When elements are highlighted, non-highlighted elements automatically dim and animations pause, creating a clear visual hierarchy.

### Data Attributes

The library uses intuitive, semantic attribute names with consistent comma-separated list notation:

- **`data-activate`** - Auto-activate groups when navigating (e.g., `"workflow,database"`)
- **`data-groups`** - Mark element as member of named groups (e.g., `"api,frontend"`)
- **`data-section`** - Unique section identifier for navigation
- **`groups`** (connectors) - Connector group membership (e.g., `"workflow,integration"`)

These semantic names make the code self-documenting. Use meaningful names like "workflow", "database", "integration" rather than abstract identifiers.

> **Note:** If you're upgrading from an earlier version, see [TERMINOLOGY-MIGRATION.md](./TERMINOLOGY-MIGRATION.md) for migration guidance and backward compatibility information.

---

### Auto-Highlighting on Navigation

Use `data-activate` to automatically activate groups when navigating to a scene:

```html
<div class="face top" 
     data-activate="workflow,database"
     data-nav-xyz="45.00.-35"
     data-nav-zoom="1.2">
  When clicked, automatically highlights all elements in workflow and database groups
</div>
```

**Behavior:**

- Can be placed on navigable faces or scenes
- Automatically activates when the element is clicked for navigation
- Supports multiple groups separated by commas (e.g., "workflow,integration")
- Highlights matching scenes, faces, and SVG connectors
- Non-highlighted elements dim to 40% opacity
- Connector animations pause on non-highlighted connectors

### Element Group Membership

Use `data-groups` to mark elements as members of named groups:

```html
<!-- Scene that belongs to multiple groups -->
<div class="scene" data-groups="workflow,integration">
  This scene activates when workflow or integration groups are active
</div>

<!-- Face with specific group -->
<div class="face top" data-groups="database">
  Highlighted when "database" group is active
</div>
```

**Behavior:**

- Elements with matching groups receive `.highlight` class
- Non-matching elements dim automatically
- Multiple groups can be assigned (comma-separated)
- Works on both scenes and individual faces
- Use semantic names (e.g., "api", "frontend", "backend") for clarity

### SVG Connector Group Highlighting

Connectors can be highlighted using the same group system:

```html
<div class="isometric-perspective" 
     data-connectors='[
       {
         "ids": "cube1,cube2",
         "positions": "center,top",
         "color": "#4CAF50",
         "groups": "workflow,integration"
       }
     ]'>
```

**Behavior:**

- Connectors with matching groups remain colored
- Non-matching connectors turn gray (#808080)
- Animations stop on non-highlighted connectors
- Arrow markers change to gray

### Highlighting Workflow

1. **Navigate to element** with `data-activate="workflow,database"`
2. **System highlights**:
   - All scenes/faces with `data-groups` containing "workflow" or "database"
   - All connectors with `"groups": "workflow"` or `"groups": "database"`
3. **System dims**:
   - All elements without matching groups (40% opacity)
   - Connector colors turn gray

**Example Flow:**
```html
<!-- Navigation trigger -->
<div class="face top" 
     data-activate="api,backend"
     data-nav-xyz="0.0.0">
  Click me to highlight API and backend components
</div>

<!-- Highlighted scene -->
<div class="scene" data-groups="api">
  API Gateway (receives .highlight class)
</div>

<!-- Highlighted connector -->
<div class="isometric-perspective" 
     data-connectors='[
       {"ids": "api,db", "groups": "backend"}
     ]'>
</div>
```
   - Animations pause

### Highlighting API Methods

```javascript
// Highlight by group(s)
viewer.highlightByKey(['workflow', 'integration']);

// Clear all highlights (returns all to normal)
viewer.clearHighlights();

// Programmatically check current highlights
const highlighted = document.querySelectorAll('.highlight');
```

### Example: Multi-Step Presentation

```html
<!-- Step 1: Introduce input system -->
<div class="face top" 
     data-activate="input"
     data-nav-xyz="45.00.-35"
     data-nav-zoom="1.5">
  Step 1: Input Layer
</div>

<div id="input-scene" class="scene" data-groups="input">
  Input Processing
</div>

<!-- Step 2: Show data flow -->
<div class="face top" 
     data-activate="input,processing"
     data-nav-xyz="30.00.-45"
     data-nav-zoom="1.2">
  Step 2: Data Flow
</div>

<div id="processor" class="scene" data-groups="processing">
  Data Processor
</div>

<!-- Connectors highlight with their steps -->
<div class="isometric-perspective" 
     data-connectors='[
       {"ids": "input-scene,processor", "positions": "right,left", "groups": "input,processing"}
     ]'>
```

### Troubleshooting Highlighting

If highlighting isn't working, verify these requirements:

#### 1. Missing `data-groups` Attribute

Elements must have `data-groups` to be highlightable:

```html
<!-- ❌ Won't highlight -->
<div id="cube1" class="scene">Content</div>

<!-- ✅ Will highlight when "workflow" group is active -->
<div id="cube1" class="scene" data-groups="workflow">Content</div>
```

#### 2. Missing `data-activate` on Navigation

Navigation elements need `data-activate` to trigger highlighting:

```html
<!-- ❌ Navigation won't trigger highlighting -->
<div class="face top" data-nav-xyz="15.00.-15">Click me</div>

<!-- ✅ Triggers highlighting for "workflow" group -->
<div class="face top" 
     data-nav-xyz="15.00.-15" 
     data-activate="workflow">
  Click me
</div>
```

#### 3. Missing `groups` in Connector Configuration

Connectors need the `groups` array property:

```javascript
// ❌ Connector won't highlight
{"ids": "cube1,cube2", "positions": "right,left", "color": "#2196F3"}

// ✅ Connector highlights with groups
{"ids": "cube1,cube2", "positions": "right,left", "color": "#2196F3", "groups": "workflow,integration"}
```

#### 4. Group Matching Rules

- Group names are **case-sensitive**: `"workflow"` ≠ `"Workflow"`
- Multiple groups use **comma separation**: `data-groups="workflow,integration,api"` or `"groups": "workflow,integration"`
- Group names must match exactly between navigation and elements

#### 5. Debug Checklist

Run in browser console to verify setup:

```javascript
// Check elements with groups
document.querySelectorAll('[data-groups]').forEach(el => {
  console.log('Highlightable:', el.id, el.getAttribute('data-groups'));
});

// Check navigation elements with activation triggers
document.querySelectorAll('[data-activate]').forEach(el => {
  console.log('Nav trigger:', el.className, el.getAttribute('data-activate'));
});

// Check connectors configuration
const perspective = document.querySelector('.isometric-perspective');
console.log('Connectors:', perspective.getAttribute('data-connectors'));
```

#### 6. Complete Working Example

```html
<div class="isometric-perspective" data-connectors='[
  {"ids": "cube1,cube2", "positions": "right,left", "color": "#2196F3", "groups": "workflow"}
]'>
  <!-- Element 1: Has group -->
  <div id="cube1" class="scene" data-groups="workflow">
    <div class="face top" 
         data-nav-xyz="15.00.-15" 
         data-activate="workflow"
         data-nav-zoom="1.2">
      Click to highlight workflow
    </div>
  </div>
  
  <!-- Element 2: Has same group -->
  <div id="cube2" class="scene" data-groups="workflow">
    Connected element
  </div>
  
  <!-- Element 3: Different group (won't highlight) -->
  <div id="cube3" class="scene" data-groups="database">
    Other element
  </div>
</div>
```

**Expected behavior when clicking cube1's top face:**

- ✅ cube1 and cube2 stay bright (both have `data-groups="workflow"`)
- ✅ Connector turns bright blue (has `"groups": "workflow"`)
- ✅ cube3 dims to 40% opacity (different key)
- ✅ Other connectors turn gray and stop animating

## Scroll Synchronization

Sync 3D navigation with page scrolling:

```javascript
const scrollSync = new ScrollSync(viewer, {
  stickyThreshold: 320,   // Sticky header offset
  scrollDuration: 1800,   // Animation duration
  debounceDelay: 100      // Debounce delay
});
```

### HTML Structure

```html
<div class="sticky-section-wrapper">
  <div id="viewer" class="isometric-container">
    <!-- 3D scenes -->
  </div>
  
  <div id="content-sections">
    <div id="section1" class="description-section">
      <h2>Section 1</h2>
      <p>Content...</p>
    </div>
    <!-- more sections -->
  </div>
</div>
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| `←` `→` | Z-axis rotation |
| `↑` `↓` | X-axis rotation |
| `Shift` + `←` `→` | Y-axis rotation |
| `Shift` + `↑` `↓` | Zoom in/out |
| `Alt` + `←` `→` `↑` `↓` | Pan view (translate) |
| `+` `-` | Zoom controls |
| `Space` | Reset to default view |
| `Tab` | Navigate to next navigation point |
| `Shift` + `Tab` | Navigate to previous navigation point |
| `Alt` + `Tab` | Cycle highlights only (keep view position) |
| `Alt` + `Shift` + `Tab` | Cycle highlights backwards (keep view position) |
| `P` | Toggle auto-play (cycles through navigation points) |
| `Shift` + `P` | Toggle highlight-only auto-play (cycles highlights without moving view) |

### Auto-Play Modes

**Full Navigation Auto-Play (`P`):**

Press `P` to automatically cycle through navigation points every 5 seconds with full camera movements:

- Starts from the current navigation position
- Advances to the next point with complete view changes (rotation, zoom, pan)
- Applies highlights via `data-activate` if present
- Loops back to the beginning after reaching the end
- Press `P` again to pause

**Highlight-Only Auto-Play (`Shift` + `P`):**

Press `Shift` + `P` to cycle through navigation highlights without moving the camera:

- Updates highlights and active states for each navigation point
- Camera position (rotation, zoom, pan) remains unchanged
- Perfect for keeping a fixed overview while cycling through different highlighted elements
- Applies all `data-activate` groups at each navigation point
- Loops continuously through all navigation points
- Press `Shift` + `P` again to pause

**Perfect for:**

- ✅ Automated presentations and demos (`P`)
- ✅ Trade show displays and kiosks (`P`)
- ✅ Architecture overviews with component focus cycling (`Shift` + `P`)
- ✅ Continuous looping through features
- ✅ Hands-free walkthroughs

**Example:**

```javascript
const presenter = createIsometric3D('demo', {
  showCompactControls: true
});

// Auto-play will cycle through all elements with data-nav-xyz attributes
// Use P for full navigation or Shift+P for highlight-only cycling
```

**Common Behaviors:**

- Only works when navigation points exist (`data-nav-xyz`, `data-nav-zoom`, or `data-nav-pan`)
- Timing: 5 seconds per navigation point
- Automatically applies highlights if `data-activate` is present
- Stops when manually interacting (clicking, dragging, keyboard controls)
- Resume by pressing `P` or `Shift` + `P` again

**Use Case Comparison:**

| Scenario | Use `P` | Use `Shift` + `P` |
|----------|---------|-------------------|
| Product demo with different viewing angles | ✅ | ❌ |
| Architecture diagram with fixed camera, cycling component focus | ❌ | ✅ |
| Step-by-step tutorial with camera movements | ✅ | ❌ |
| System overview maintaining bird's-eye view | ❌ | ✅ |
| Workflow visualization with zoom-ins | ✅ | ❌ |
| Network topology with component highlighting | ❌ | ✅ |

## Mouse Controls

- **Left drag**: X and Z-axis rotation
- **Shift + drag**: Y-axis rotation (horizontal) + zoom (vertical, inverted)
- **Alt + drag**: Pan/translate view
- **Middle drag**: Pan/translate view
- **Right drag**: Y-axis rotation + zoom
- **Mouse wheel**: X-axis rotation
- **Shift + Wheel**: Zoom in/out
- **Alt + Wheel**: Pan up/down
- **Click navigation point**: Navigate to preset view

**Note**: Shift+drag has inverted zoom behavior (drag up = zoom out, drag down = zoom in) for intuitive "grab and move" interaction, while keyboard Shift+Arrow keys maintain traditional increment behavior (up = zoom in, down = zoom out).

## Styling

### CSS Variables

```css
.isometric-container {
  --nav-bg-light: rgba(255, 255, 255, 0.5);
  --nav-bg-active-light: rgba(255, 255, 255, 1);
  --control-bg-light: rgba(255, 255, 255, 0.3);
  --control-border-light: rgba(255, 255, 255, 0.15);
}
```

### Custom Styling

```css
.scene {
  /* Your custom styles */
}

.scene:not(:has(> .face)) {
  /* your styles for scence without faces */
}
.face {
  background: rgba(100, 150, 200, 0.8);
  border: 1px solid #fff;
}

.scene.highlight {
  /* Highlighted state */
}

```

### Customizing Highlight and Selection States

The library provides two CSS classes for visual feedback during navigation and highlighting:

#### `.highlight` Class

Applied to elements that belong to the currently active highlight group (based on `data-groups` or `data-section`). Multiple elements can have this class simultaneously. The class name intentionally uses the universal web convention term "highlight" rather than "group" or "activate" because it represents the visual presentation state.

**Common customizations:**

```css
/* Add background color to highlighted elements */
.scene.highlight,
.face.highlight {
  background-color: rgba(173, 216, 230, 0.3); /* Light blue tint */
}

/* Add a glow effect to highlighted elements */
.scene.highlight,
.face.highlight {
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
}

/* Adjust dimming level for non-highlighted elements */
.isometric-perspective:has(.highlight) .scene:not(.highlight) > .face {
  opacity: 0.1; /* More dramatic dimming (default: 0.2) */
}

.isometric-perspective:has(.highlight) .scene:not(.highlight) > *:not(.face) {
  opacity: 0.2; /* Dim child elements more (default: 0.4) */
}

/* Keep non-highlighted connectors more visible */
.isometric-perspective:has(.highlight) .connector-path:not(.highlight) {
  opacity: 0.3; /* More visible (default: 0.1) */
  stroke: #999999; /* Lighter gray (default: #808080) */
}
```

#### `.nav-selected` Class

Applied to the specific element that was clicked or navigated to. Only one element has this class at a time.

**Common customizations:**

```css
/* Change outline color and style */
.face.highlight,
.face.nav-selected,
.scene.nav-selected {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Add animation to selected element */
.face.nav-selected,
.scene.nav-selected {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    outline-color: rgba(0, 255, 0, 0.8);
  }
  50% {
    outline-color: rgba(0, 255, 0, 0.3);
  }
}

/* Add background highlight instead of outline */
.face.nav-selected,
.scene.nav-selected {
  background-color: rgba(255, 215, 0, 0.2); /* Gold background */
}
```

#### `.hover-highlight` Class

**Automatically applied** via JavaScript when hovering over non-highlighted elements during highlighting mode. This provides instant visual feedback by temporarily restoring the opacity of dimmed elements when the user hovers over them.

**Behavior:**

- Applied when mouse enters a non-highlighted cuboid or scene while highlighting is active
- Removed when mouse leaves the element
- Makes dimmed elements (opacity: 0.2) temporarily fully visible (opacity: 1)
- Includes smooth transition: `opacity 0.2s ease`

**Default styles:**

```css
/* Hover highlight - applied via JavaScript */
.hover-highlight > .face,
.hover-highlight.scene {
  opacity: 1 !important;
  transition: opacity 0.2s ease;
}

.hover-highlight > *:not(.face) {
  opacity: 1 !important;
  transition: opacity 0.2s ease;
}
```

**Customization:**

```css
/* Change hover effect intensity */
.hover-highlight > .face,
.hover-highlight.scene {
  opacity: 0.8 !important; /* Partial visibility instead of full */
  background-color: rgba(255, 255, 255, 0.05); /* Subtle background */
}

/* Add hover glow effect */
.hover-highlight > .face {
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
}

/* Slower transition */
.hover-highlight > .face,
.hover-highlight.scene {
  transition: opacity 0.5s ease, box-shadow 0.5s ease;
}
```

**Note:** The `.hover-highlight` class is managed automatically by the library. You don't need to add or remove it manually - just hover over any dimmed element to see it temporarily highlighted.

#### Complete Theme Example

Here's a complete dark theme with purple highlights:

```css
/* Dark theme with purple highlights */
.scene.highlight,
.face.highlight {
  background-color: rgba(138, 43, 226, 0.2); /* Purple tint */
  border: 1px solid rgba(138, 43, 226, 0.5);
}

.face.nav-selected,
.scene.nav-selected {
  outline: 2px solid rgba(255, 0, 255, 0.9); /* Magenta outline */
  outline-offset: 3px;
  animation: glow 1.5s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(255, 0, 255, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 0, 255, 0.8);
  }
}

/* Adjust non-highlighted elements for dark theme */
.isometric-perspective:has(.highlight) .scene:not(.highlight) > .face {
  opacity: 0.15;
}

.isometric-perspective:has(.highlight) .connector-path:not(.highlight) {
  stroke: #444444; /* Darker gray for dark theme */
  opacity: 0.2;
}

/* Custom hover effect */
.nav-clickable::before {
  background: linear-gradient(135deg,
    rgba(138, 43, 226, 0.3) 0%,
    rgba(138, 43, 226, 0) 50%,
    rgba(138, 43, 226, 0.3) 100%);
  border: 2px solid rgba(138, 43, 226, 0.8);
}
```

## Advanced Features

### Multiple Instances

```javascript
const viewer1 = createIsometric3D('viewer1', {
  bookmarkPrefix: 'v1_'
});

const viewer2 = createIsometric3D('viewer2', {
  bookmarkPrefix: 'v2_'
});
```

### Event System

```javascript
viewer.on('navigationChange', (data) => {
  console.log('Navigation changed:', data);
});
```

### URL Bookmarking

The presenter uses two types of URL navigation:

#### 1. Hash Navigation (Click/Scroll-Based)

When clicking on a navigable element or scrolling to a content section, the URL updates with a hash anchor:

```html
example.html#cube1-description
```

This provides semantic navigation to specific content sections using the element's `data-section` attribute.

#### 2. Query Parameter Navigation (Index + Manual Adjustments)

When navigating via navigation points or manually adjusting the view, the URL updates with query parameters:

- `{prefix}nav` - Navigation point index (1-based, e.g., "1" for first point, "2" for second)
- `{prefix}xyz` - Rotation delta from navigation point (e.g., "45.00.-35")
- `{prefix}zoom` - Zoom level delta from navigation point (e.g., "1.2")
- `{prefix}pan` - Pan position delta from navigation point (e.g., "100.-50" with dot separator)

**URL Format Examples:**

- First navigation point: `example.html#section?demo-nav=1`
- Second point with section: `example.html#A2?demo-nav=2`
- With manual adjustments: `example.html#D?demo-nav=4&demo-xyz=60.00.-20&demo-zoom=0.8&demo-pan=-58.-64`

**Note:** The navigation index (`demo-nav`) uses **1-based numbering** for user clarity (first point = 1, second point = 2, etc.). Manual adjustment parameters (xyz, zoom, pan) are only added when the view differs from the base navigation point.

## Examples

See the `examples/` directory for:

- Interactive cube presentation
- Architecture diagram walkthroughs
- Workflow process demonstrations  
- Scroll-synced storytelling experiences

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile: iOS Safari 12+, Chrome Android

## License

Apache License 2.0

Copyright 2025 Isometric 3D Presenter Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

```text
http://www.apache.org/licenses/LICENSE-2.0
```

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md for guidelines.

## Changelog

See CHANGELOG.md for version history.
