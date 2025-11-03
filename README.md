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

## Configuration Options

### Core Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultRotation` | Object | `{x: 45, y: 0, z: -35}` | Initial rotation angles |
| `defaultZoom` | Number | `1.0` | Initial zoom level |
| `showCompactControls` | Boolean | `false` | Show spherical controller |
| `bookmarkPrefix` | String | `containerId_` | URL parameter prefix |
| `navSelectedTarget` | String | `'clicked'` | Which face gets `.nav-selected` class: `'clicked'`, `'top'`, `'bottom'`, `'front'`, `'back'`, `'left'`, `'right'` |

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

- `data-width` - Width of the 3D scene
- `data-height` - Height of the 3D scene (numeric value in pixels). If omitted, height is automatically calculated from content
- `data-depth` - Depth of the 3D scene
- `data-z-axis` - Z-axis offset (elevation)

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
     data-nav-pan="100,-50"
     data-section="section1">
  Click to navigate
</div>
```

### Navigation Data Attributes

- `data-nav-xyz` - Target rotation (format: "x.y.z" with dots, or `"current"` to keep current rotation)
- `data-nav-zoom` - Target zoom level (e.g., "1.2", or `"current"` to keep current zoom)
- `data-nav-pan` - Target pan/translation (format: "x,y" with comma, or `"current"` to keep current pan) - **Optional**
- `data-section` - Unique section identifier for navigation

#### Using `"current"` for Selection Without Navigation

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

**Use Cases:**

- ✅ Nested faces inside flex-column/flex-row that should be selectable but not navigate
- ✅ Interactive elements that trigger highlighting without camera movement
- ✅ Menu items or navigation lists that activate different highlight groups
- ✅ Partial navigation (e.g., change rotation but keep current zoom)

**Behavior:**

- Elements with `data-nav-xyz="current"` or `data-nav-zoom="current"` are still treated as navigable (get glass hover effect, appear in navigation bar)
- Clicking them applies highlights via `data-activate` but preserves the current camera position
- Can mix `"current"` with actual values (e.g., zoom to 1.5 but keep current rotation)

**Auto-Centering:** When `data-nav-pan` is not defined, the system automatically calculates the pan position to center the clicked element in the viewport while maintaining the specified rotation and zoom. This ensures the element is always perfectly centered without manual pan calculations.

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
     data-nav-pan="100,-50"
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
| `Ctrl/Cmd` + `←` `→` `↑` `↓` | Pan view (translate) |
| `+` `-` | Zoom controls |
| `Space` | Reset to default view |
| `Tab` | Navigate through navigation points |

## Mouse Controls

- **Left drag**: X and Z-axis rotation
- **Middle drag**: Pan/translate view
- **Right drag**: Y-axis rotation + zoom
- **Mouse wheel**: Zoom in/out
- **Click navigation point**: Navigate to preset view

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

/* Add background highlight instead of outline 
```

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

#### 2. Query Parameter Navigation (Manual Manipulation)

When manually rotating, zooming, or panning the view, the URL updates with query parameters after 3 seconds:

- `{prefix}xyz` - Rotation (e.g., "45.00.-35")
- `{prefix}zoom` - Zoom level (e.g., "1.2")
- `{prefix}pan` - Pan position (e.g., "100,-50" with comma separator)

Example: `?presentationxyz=45.00.-35&presentationzoom=1.2&presentationpan=100,-50`

**Note:** Hash navigation and query parameter navigation are mutually exclusive. Clicking an element removes query parameters, and manual navigation removes the hash.

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
