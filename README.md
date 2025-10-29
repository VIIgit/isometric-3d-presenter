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

### Data Attributes

- `data-width` - Width of the 3D scene
- `data-height` - Height of the 3D scene
- `data-depth` - Depth of the 3D scene
- `data-z-axis` - Z-axis offset (elevation)

## Navigation

### Programmatic Navigation

```html
<div class="face top" 
     data-nav-xyz="45.00.-35" 
     data-nav-zoom="1.2"
     data-nav-pan="100,-50"
     data-id="section1">
  Click to navigate
</div>
```

### Navigation Data Attributes

- `data-nav-xyz` - Target rotation (format: "x.y.z" with dots)
- `data-nav-zoom` - Target zoom level (e.g., "1.2")
- `data-nav-pan` - Target pan/translation (format: "x,y" with comma)
- `data-id` - ID for scroll synchronization

**Note:** When navigating, if `data-nav-pan` is not defined, the pan position automatically resets to (0,0).

### API Methods

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

Draw connections between elements with automatic routing:

```html
<div class="isometric-perspective" 
     data-connectors='[
       {
         "from": "cube1",
         "fromPoint": "top",
         "to": "cube2",
         "toPoint": "bottom",
         "color": "#4CAF50",
         "keys": ["A", "B"]
       }
     ]'>
  <!-- scenes -->
</div>
```

### Connector Configuration

| Property | Type | Description |
|----------|------|-------------|
| `from` | String | Source element ID |
| `fromPoint` | String | Connection point: `center`, `top`, `bottom`, `left`, `right`, `top-left`, etc. |
| `to` | String | Target element ID |
| `toPoint` | String | Connection point |
| `color` | String | Line color (hex or CSS color) |
| `keys` | Array | Highlight keys for this connector |
| `edgeAt` | String | Edge positioning: `"50,40"` = edge 50px from start, 40px before end |

### Edge Routing Examples

```javascript
// Two corners at specific positions
{"edgeAt": "50,40"}  // First corner at 50px, second corner 40px before end

// Single corner at end
{"edgeAt": ",60"}  // Corner 60px before end

// Single corner at start
{"edgeAt": "80"}  // Corner at 80px from start
```

## Highlighting System

The highlighting system allows you to create visual focus effects on specific scenes and connectors. When elements are highlighted, non-highlighted elements automatically dim and animations pause, creating a clear visual hierarchy.

### Auto-Highlighting on Navigation

Use `data-highlight-keys` to automatically highlight elements when navigating to a scene:

```html
<div class="face top" 
     data-highlight-keys="A,B"
     data-nav-xyz="45.00.-35"
     data-nav-zoom="1.2">
  When clicked, automatically highlights all elements with keys A and B
</div>
```

**Behavior:**

- Can be placed on navigable faces or scenes
- Automatically activates when the element is clicked for navigation
- Supports multiple keys separated by commas
- Highlights matching scenes, faces, and SVG connectors
- Non-highlighted elements dim to 40% opacity
- Connector animations pause on non-highlighted connectors

### Element Highlighting Keys

Use `data-keys` to mark elements as highlightable:

```html
<!-- Scene that highlights with multiple keys -->
<div class="scene" data-keys="A,B,C">
  This scene highlights when key A, B, or C is active
</div>

<!-- Face with specific highlight key -->
<div class="face top" data-keys="feature1">
  Highlighted when "feature1" key is active
</div>
```

**Behavior:**

- Elements with matching keys receive `.highlight` class
- Non-matching elements dim automatically
- Multiple keys can be assigned (comma-separated)
- Works on both scenes and individual faces

### SVG Connector Highlighting

Connectors can be highlighted using the same key system:

```html
<div class="isometric-perspective" 
     data-connectors='[
       {
         "from": "cube1",
         "to": "cube2",
         "color": "#4CAF50",
         "keys": ["A", "B"]
       }
     ]'>
```

**Behavior:**

- Connectors with matching keys remain colored
- Non-matching connectors turn gray (#808080)
- Animations stop on non-highlighted connectors
- Arrow markers change to gray

### Highlighting Workflow

1. **Navigate to element** with `data-highlight-keys="A,B"`
2. **System highlights**:
   - All scenes/faces with `data-keys` containing A or B
   - All connectors with `"keys": ["A"]` or `"keys": ["B"]`
3. **System dims**:
   - All elements without matching keys (40% opacity)
   - Connector colors turn gray
   - Animations pause

### API Methods

```javascript
// Highlight by key(s)
viewer.highlightByKey(['A', 'B']);

// Clear all highlights (returns all to normal)
viewer.clearHighlights();

// Programmatically check current highlights
const highlighted = document.querySelectorAll('.highlight');
```

### Example: Multi-Step Presentation

```html
<!-- Step 1: Introduce input system -->
<div class="face top" 
     data-highlight-keys="input"
     data-nav-xyz="45.00.-35"
     data-nav-zoom="1.5">
  Step 1: Input Layer
</div>

<div id="input-scene" class="scene" data-keys="input">
  Input Processing
</div>

<!-- Step 2: Show data flow -->
<div class="face top" 
     data-highlight-keys="input,processing"
     data-nav-xyz="30.00.-45"
     data-nav-zoom="1.2">
  Step 2: Data Flow
</div>

<div id="processor" class="scene" data-keys="processing">
  Data Processor
</div>

<!-- Connectors highlight with their steps -->
<div class="isometric-perspective" 
     data-connectors='[
       {"from": "input-scene", "to": "processor", "keys": ["input", "processing"]}
     ]'>
```

### Troubleshooting Highlighting

If highlighting isn't working, verify these requirements:

#### 1. Missing `data-keys` Attribute

Elements must have `data-keys` to be highlightable:

```html
<!-- ❌ Won't highlight -->
<div id="cube1" class="scene">Content</div>

<!-- ✅ Will highlight when key "A" is active -->
<div id="cube1" class="scene" data-keys="A">Content</div>
```

#### 2. Missing `data-highlight-keys` on Navigation

Navigation elements need `data-highlight-keys` to trigger highlighting:

```html
<!-- ❌ Navigation won't trigger highlighting -->
<div class="face top" data-nav-xyz="15.00.-15">Click me</div>

<!-- ✅ Triggers highlighting for key "A" -->
<div class="face top" 
     data-nav-xyz="15.00.-15" 
     data-highlight-keys="A">
  Click me
</div>
```

#### 3. Missing `keys` in Connector Configuration

Connectors need the `keys` array property:

```javascript
// ❌ Connector won't highlight
{"from": "cube1", "to": "cube2", "color": "#2196F3"}

// ✅ Connector highlights with keys
{"from": "cube1", "to": "cube2", "color": "#2196F3", "keys": ["A", "B"]}
```

#### 4. Key Matching Rules

- Keys are **case-sensitive**: `"A"` ≠ `"a"`
- Multiple keys in HTML use **comma separation**: `data-keys="A,B,C"`
- Connector keys use **array format**: `"keys": ["A", "B"]`
- Keys must match exactly between navigation and elements

#### 5. Debug Checklist

Run in browser console to verify setup:

```javascript
// Check elements with highlight keys
document.querySelectorAll('[data-keys]').forEach(el => {
  console.log('Highlightable:', el.id, el.getAttribute('data-keys'));
});

// Check navigation elements with highlight triggers
document.querySelectorAll('[data-highlight-keys]').forEach(el => {
  console.log('Nav trigger:', el.className, el.getAttribute('data-highlight-keys'));
});

// Check connectors configuration
const perspective = document.querySelector('.isometric-perspective');
console.log('Connectors:', perspective.getAttribute('data-connectors'));
```

#### 6. Complete Working Example

```html
<div class="isometric-perspective" data-connectors='[
  {"from": "cube1", "to": "cube2", "color": "#2196F3", "keys": ["flow"]}
]'>
  <!-- Element 1: Has highlight key -->
  <div id="cube1" class="scene" data-keys="flow">
    <div class="face top" 
         data-nav-xyz="15.00.-15" 
         data-highlight-keys="flow"
         data-nav-zoom="1.2">
      Click to highlight flow
    </div>
  </div>
  
  <!-- Element 2: Has same highlight key -->
  <div id="cube2" class="scene" data-keys="flow">
    Connected element
  </div>
  
  <!-- Element 3: Different key (won't highlight) -->
  <div id="cube3" class="scene" data-keys="other">
    Other element
  </div>
</div>
```

**Expected behavior when clicking cube1's top face:**

- ✅ cube1 and cube2 stay bright (both have `data-keys="flow"`)
- ✅ Connector turns bright blue (has `"keys": ["flow"]`)
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

.face {
  background: rgba(100, 150, 200, 0.8);
  border: 1px solid #fff;
}

.scene.highlight {
  /* Highlighted state */
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

The presenter automatically saves state to URL:

- `{prefix}xyz` - Rotation (e.g., "45.00.-35")
- `{prefix}zoom` - Zoom level (e.g., "1.2")
- `{prefix}pan` - Pan position (e.g., "100,-50" with comma separator)

Example: `?presentationxyz=45.00.-35&presentationzoom=1.2&presentationpan=100,-50`

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
