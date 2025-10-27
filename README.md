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
     data-id="section1">
  Click to navigate
</div>
```

### Data Attributes

- `data-nav-xyz` - Target rotation (format: "x.y.z")
- `data-nav-zoom` - Target zoom level
- `data-id` - ID for scroll synchronization

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

### Auto-Highlighting

```html
<div class="face top" 
     data-auto-highlight-key="A,B"
     data-nav-xyz="45.00.-35">
  Auto-highlights keys A and B on navigation
</div>
```

### Element Highlighting

```html
<div class="scene" data-keys="A,B,C">
  Highlighted when key A, B, or C is active
</div>
```

### API Methods

```javascript
// Highlight by key(s)
viewer.highlightByKey(['A', 'B']);

// Clear all highlights
viewer.clearHighlights();

// Toggle highlight
viewer.toggleHighlight('A');
```

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
| `+` `-` | Zoom controls |
| `Space` | Reset to default view |
| `Tab` | Navigate through navigation points |

## Mouse Controls

- **Left drag**: X and Z-axis rotation
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

Example: `?presentationxyz=45.00.-35&presentationzoom=1.2`

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
