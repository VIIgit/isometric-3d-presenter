# SKILL: Isometric 3D Scroll-Synced Presentation Generator

Generate a complete, interactive isometric 3D presentation page from a topic list and grid layout. The user provides minimal input (title, teaser, topics, grid notation) and the agent produces a fully working HTML page with sticky 3D diagram, scroll-synchronized content sections, navigation, connectors, and highlighting.

**Library:** `isometric-3d-presenter` (zero runtime dependencies — pure CSS3 + vanilla JS)  
**Source files needed:**
- `src/isometric-3d.css` — structural CSS for 3D rendering
- `src/isometric-3d.js` — core `Isometric3D` class (~4850 lines)
- `src/scroll-sync.js` — `ScrollSync` class for bidirectional scroll sync (~250 lines)

---

## 1. User Input Schema

Collect the following from the user before generating:

| Input | Required | Type | Description |
|-------|----------|------|-------------|
| `title` | Yes | string | Page heading (`<h1>`) — displayed in the sticky diagram header |
| `teaser` | Yes | string | Introductory paragraph(s) in the sticky diagram header, below the title |
| `topics` | Yes | list | Each topic has: `id` (short slug), `label` (display name), `description` (markdown/HTML content for the section) |
| `grid` | Yes | multi-line text | Layout grid using topic IDs and `.` for empty cells (see Grid Notation below) |
| `connectors` | No | list | Connections between topics: `{from, to, color, style}` |
| `theme` | No | object | Colors for faces, background, perspective gradient |
| `containerHeight` | No | number | Height of sticky 3D container in px (default: `300`) |
| `stickyTop` | No | number | Top offset for sticky positioning in px (default: `20`) |

---

## 2. Grid Notation

The user provides a text grid where each cell is either a **topic ID** or `.` (empty). Rows are separated by newlines. Columns are separated by `|` or whitespace.

### Example Input

```
api  |  .   | db
 .   | svc  |  .
ui   | ui   |  .
```

### Mapping Rules

1. **Count rows and columns** from the grid text.
2. **Map to CSS Grid:**
   - `grid-template-columns: repeat(<cols>, 1fr)`
   - `grid-template-rows: repeat(<rows>, 1fr)`
   - `grid-template-areas:` — quote each row, use topic IDs and `.` directly
3. **Generate `grid-area` CSS** for each unique topic ID (e.g., `.topic-api { grid-area: api; }`).
4. **Spanning:** A topic ID repeated across adjacent cells spans those cells (e.g., `ui ui` spans 2 columns).
5. **Topic IDs must be valid CSS grid-area names** — lowercase alphanumeric + hyphens.

### Generated CSS

```css
.grid-layout {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
    gap: 2px;
    grid-template-areas:
        "api  .   db"
        ".    svc ."
        "ui   ui  .";
}
.topic-api { grid-area: api; }
.topic-db  { grid-area: db; }
.topic-svc { grid-area: svc; }
.topic-ui  { grid-area: ui; }
```

---

## 3. Page Structure Template

Every generated page follows this three-part layout:

```
┌─────────────────────────────────┐
│  PART 2: Sticky Block            │  ← position: sticky; stays visible
│  ┌─────────────────────────────┐│
│  │  .isometric-header          ││  ← Title + description (optional)
│  ├─────────────────────────────┤│
│  │  .isometric-viewport        ││  ← border-radius + overflow:hidden
│  │  ┌─────────────────────────┐││
│  │  │  .isometric-perspective │││  ← CSS Grid with topics as scenes/cuboids
│  │  │  (grid layout w/ topics)│││
│  │  └─────────────────────────┘││
│  └─────────────────────────────┘│
├─────────────────────────────────┤
│  PART 3: Content Sections        │  ← Scrollable; synced with 3D navigation
│  ┌─────────────────────────────┐│
│  │  Section: Topic 1           ││  ← id matches data-section on 3D element
│  │  (sticky h2 + scroll body) ││
│  ├─────────────────────────────┤│
│  │  Section: Topic 2           ││
│  ├─────────────────────────────┤│
│  │  Section: Topic N           ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

### Required HTML Skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <link rel="stylesheet" href="../src/isometric-3d.css">
    <style>
        /* === Generated structural CSS (see Section 4) === */
        /* === Generated grid CSS (see Section 2) === */
        /* === Generated theme CSS (see Section 6) === */
    </style>
</head>
<body>

    <!-- PART 2 + PART 3: Sticky wrapper -->
    <div class="sticky-section-wrapper">

        <!-- Sticky block: header + 3D diagram stick together -->
        <div class="isometric-wrapper">

        <!-- PART 2a: Diagram title & description (sticky with diagram) -->
        <div class="isometric-header">
            <h1>{{title}}</h1>
            <p>{{teaser}}</p>
        </div>

        <!-- PART 2b: 3D diagram (viewport provides rounded corners without breaking 3D) -->
        <div class="isometric-viewport">
        <div id="presenter" class="isometric-container">
            <div class="isometric-perspective grid-layout">
                <!-- Generated scenes/cuboids for each topic -->
            </div>
        </div>
        </div> <!-- /.isometric-viewport -->
        </div> <!-- /.isometric-wrapper -->

        <!-- Scrollable content sections -->
        <div class="content-sections">
            <!-- Generated description-section for each topic -->
        </div>
    </div>

    <script src="../src/isometric-3d.js"></script>
    <script src="../src/scroll-sync.js"></script>
    <script>
        // Generated initialization (see Section 5)
    </script>
</body>
</html>
```

---

## 4. Structural CSS (Required Boilerplate)

This CSS is **identical for every scroll-synced presentation**. The agent must include it. The only variables are `containerHeight` and `stickyTop` — `.isometric-header` height is content-dependent.

`ScrollSync` **auto-computes** `stickyThreshold` at runtime by measuring the `.isometric-wrapper` element's CSS `top` + `offsetHeight`. It then injects `scroll-margin-top` on `.description-section` and `top` on `.description-section h2` automatically. This means you do **not** need to hardcode `stickyThreshold` in CSS or JS — just set `position: sticky` and `top` on `.isometric-wrapper`, and let `ScrollSync` handle the rest.

```css
body {
    margin: 0;
    padding: 20px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    min-height: 100vh;
}

/* Wrapper for sticky positioning context */
.sticky-section-wrapper {
    position: relative;
}

/* Wrapper groups header + 3D diagram as a single sticky unit.
   Do NOT put border-radius or overflow here — that's .isometric-viewport's job. */
.isometric-wrapper {
    position: sticky;
    top: {{stickyTop}}px;              /* default: 20 */
    z-index: 100;
}

/* Viewport provides rounded corners without breaking 3D.
   border-radius must NEVER be on .isometric-container itself. */
.isometric-viewport {
    border-radius: 12px;
    overflow: hidden;                  /* clips the already-composited 3D output */
}

/* Sticky 3D container — NO border-radius allowed */
.isometric-container {
    height: {{containerHeight}}px;      /* default: 300 */
    width: 100%;
}

/* Content sections wrapper */
.content-sections {
    margin: 0 20px 40px 20px;
}

/* Individual content section.
   scroll-margin-top is injected by ScrollSync (auto-computed from wrapper height). */
.description-section {
    position: relative;
    min-height: 600px;
    margin-bottom: 20px;
}

/* Sticky section header — sticks right below the sticky 3D block.
   top is injected by ScrollSync (auto-computed from wrapper height). */
.description-section h2 {
    position: sticky;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    margin: 0;
    padding: 15px 20px;
    z-index: 50;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

> **Note:** `ScrollSync` auto-computes `stickyThreshold` by default (`'auto'`). It measures `.isometric-wrapper`'s CSS `top` + `offsetHeight` at runtime and injects the derived `scroll-margin-top` and `top` values into description sections. You can still pass an explicit numeric value to override: `new ScrollSync(controller, { stickyThreshold: 380 })`.

---

## 5. Generation Rules

### Step 1: Generate Scenes/Cuboids for Each Topic

For each topic in the user's list, generate a scene with a cuboid inside:

```html
<!-- Topic: {{topic.id}} -->
<div class="scene topic-{{topic.id}}" data-z-axis="0" data-groups="{{topic.id}}">
    <div id="{{topic.id}}" class="cuboid" data-width="100" data-height="auto" data-depth="100">
        <div class="front">{{topic.label}}</div>
        <div class="back">back</div>
        <div class="left">{{topic.label}}</div>
        <div class="right">right</div>
        <div class="top"
             data-nav-xyz="45.00.-35"
             data-nav-zoom="1.0"
             data-section="{{topic.id}}-description"
             data-activate="{{topic.id}}"
             data-focus="center">{{topic.label}}</div>
        <div class="bottom">bottom</div>
    </div>
</div>
```

**Key decisions per topic:**
- `data-z-axis`: Elevation in px. Use `60`–`120` for visual depth; vary between topics for interest.
- `data-width` / `data-height` / `data-depth`: Use `"auto"` for content-driven sizing or fixed px values. See [Cuboid Dimensions](#8-cuboid-dimensions).
- `data-section`: Link to the content section ID. Convention: `"{{topic.id}}-description"`.
- `data-activate`: Comma-separated group names to highlight when clicked.
- `data-groups`: Group membership for this element (used by highlighting).
- `data-nav-xyz`: Camera rotation target as `"x.y.z"` (dot-separated degrees). Default isometric: `"45.00.-35"`.
- `data-nav-zoom`: Zoom level target. Range `0.2`–`3.0`, default `1.0`.
- `data-focus="center"`: Auto-pan to center this element when clicked.

### Step 2: Generate Content Sections

For each topic, generate a matching content section:

```html
<div id="{{topic.id}}-description" class="description-section">
    <h2>{{topic.label}}</h2>
    <div style="padding: 20px;">
        {{topic.description}}
    </div>
</div>
```

**The section `id` must match the `data-section` value** on the corresponding 3D element.

### Step 3: Generate Connectors

If the user provides connectors, build the array for the `connectors` option in the JS constructor:

```javascript
connectors: [
    {
        ids: '{{from}},{{to}}',
        positions: 'right,left',
        color: '{{color}}',
        endStyles: ',arrowSmall',
        groups: '{{from}},{{to}}'
    }
]
```

See [Connector Reference](#9-connector-reference) for all properties.

### Step 4: Generate JavaScript Initialization

```javascript
const controller = createIsometric3D('presenter', {
    defaultRotation: { x: 45, y: 0, z: -35 },
    defaultZoom: 1.0,
    showCompactControls: true,
    connectors: [
        // Generated connector definitions (see Step 3)
    ],
    connectorDefaults: {
        endLine: 'arrow',
        lineStyle: 'solid'
    }
});

const scrollSync = new ScrollSync(controller, {
    // stickyThreshold: 'auto' (default) — auto-computed from .isometric-wrapper height
    scrollDuration: 1800,
    debounceDelay: 100
});
```

---

## 6. Theme / Visual CSS

The library provides **only structural CSS** (perspective, transforms, controls). Users must style:

### Face Colors (Required)

```css
.cuboid > .face {
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 5px;
}
.cuboid > .front  { background: rgba(255, 107, 107, 0.8); }
.cuboid > .back   { background: rgba(78, 205, 196, 0.8); }
.cuboid > .left   { background: rgba(255, 193, 7, 0.8); }
.cuboid > .right  { background: rgba(156, 39, 176, 0.8); }
.cuboid > .top    { background: rgba(76, 175, 80, 0.8); }
.cuboid > .bottom { background: rgba(233, 30, 99, 0.8); }
```

### Perspective Background

```css
.isometric-perspective {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: 2px solid #333;
    border-radius: 10px;
}
```

### Navigation Selected State (Recommended)

```css
.face.nav-selected,
.scene.nav-selected {
    outline: 3px solid rgb(255, 0, 225);
    outline-offset: 4px;
    border-radius: 4px;
}
.face.nav-selected[data-activate],
.scene.nav-selected[data-activate],
.scene[data-activate] > .cuboid > .face.nav-selected {
    animation: pulse 2s infinite;
}
@keyframes pulse {
    0%, 100% { outline-color: rgba(255, 0, 225, 0.8); }
    50%      { outline-color: rgba(255, 0, 255, 0.3); }
}
```

### Highlight State (Recommended)

```css
.face.highlight {
    border-bottom: 3px solid rgba(255, 0, 0, 0.8);
}
.scene.highlight:not(:has(> .cuboid)) {
    border-bottom: 3px solid rgba(255, 0, 0, 0.8);
}
```

### Connector Styling (Optional Enhancement)

```css
.connector-path {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    transition: opacity 0.3s ease;
}
.connector-path.highlight {
    filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.4));
    opacity: 1 !important;
}
.connector-animated-marker {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
```

---

## 7. Complete Data Attribute Reference

### On `.cuboid` Elements

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-width` | `"100"`, `"80%"`, `"auto"` | Cuboid width (px, % of parent, or auto-measured from face content) |
| `data-height` | `"60"`, `"50%"`, `"auto"` | Cuboid height / vertical dimension |
| `data-depth` | `"100"`, `"100%"`, `"auto"` | Cuboid depth / front-to-back dimension |

### On `.scene` Elements

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-z-axis` | `"0"` | Z-axis elevation offset in px. Creates automatic shadow when > 0 |

### On Any Clickable Element (Navigation)

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-nav-xyz` | `"45.00.-35"`, `"current"` | Target camera rotation as `x.y.z` (degrees, dot-separated). `"current"` = keep current rotation |
| `data-nav-zoom` | `"1.2"`, `"current"` | Target zoom level (`0.2`–`3.0`). `"current"` = keep current zoom |
| `data-nav-pan` | `"100.-50"`, `"current"`, `"default"` | Target pan as `x.y` (px). `"current"` / `"default"` = keep / reset. If omitted, auto-centers parent scene |
| `data-section` | `"intro"` | Section identifier. Links to content section `id`. Used for URL hash and ScrollSync |
| `data-activate` | `"workflow,database"` | Comma-separated group names to highlight when this element is clicked |
| `data-groups` | `"api,frontend"` | Comma-separated group membership for highlighting (this element belongs to these groups) |
| `data-focus` | `"center"` | Auto-pan to center this element when clicked |

### On `.label` Elements

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-cube` | `"elementId"` | ID of the 3D element this label tracks |
| `data-position` | `"left"`, `"right"`, `"top"`, `"bottom"` | Label position relative to target element |

---

## 8. Cuboid Dimensions

### Face-to-Dimension Mapping

| Face | Width | Height |
|------|-------|--------|
| `front` / `back` | `data-width` | `data-height` |
| `left` / `right` | `data-depth` | `data-height` |
| `top` / `bottom` | `data-width` | `data-depth` |

### Auto-Sizing

When a dimension is `"auto"`:
- **auto width** — measured from `front`/`back`/`top`/`bottom` face `offsetWidth`
- **auto height** — measured from `front`/`back`/`left`/`right` face `offsetHeight`  
- **auto depth** — measured from `left`/`right` face `offsetWidth` or `top`/`bottom` face `offsetHeight`

The library temporarily renders the cuboid flat (no 3D transforms), measures content, adds a 5% + 4px buffer, and applies the calculated size.

### Percentage Sizing

- `data-width="80%"` → % of parent element's CSS `width`
- `data-depth="100%"` → % of parent element's CSS `height`
- `data-height="50%"` → % of parent element's CSS `height`

---

## 9. Connector Reference

Connectors are defined as an array in the `connectors` option of `createIsometric3D()`. (Legacy: also supported as a JSON string in the `data-connectors` HTML attribute on `.isometric-perspective`.)

### Connector Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `ids` | string | Yes | — | `"fromId,toId"` — element IDs to connect |
| `positions` | string | Yes | — | `"fromPoint,toPoint"` — connection anchor points |
| `vertices` | string | No | auto | Edge routing offsets: `"50,40"` (Z-path), `"50"` (L from start), `",40"` (L before end) |
| `color` | string | No | `"#4CAF50"` | Line color (any CSS color) |
| `endStyles` | string | No | from defaults | `"startMarker,endMarker"` — line end decorations |
| `lineStyle` | string | No | `"solid"` | `"solid"` or `"dashed"` |
| `animationStyle` | string | No | none | `"circle"` for animated dot traveling along path |
| `groups` | string | No | `[]` | Comma-separated group names for highlighting |

### Position Values

`center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`

### End Style Values

| Value | Description |
|-------|-------------|
| `arrow` | Full-size arrowhead |
| `arrowSmall` | 30% smaller arrowhead |
| `circle` | Dot marker |
| `arrow-circle` | Both arrowhead and dot |
| (empty/undefined) | No marker |

### End Styles Format

`"startMarker,endMarker"` — comma-separated, first is start, second is end. Use empty string for no marker on one side: `",arrow"` = no start marker + arrow at end.

### Vertex Routing

| Format | Result | Shape |
|--------|--------|-------|
| `"50,40"` | Two corners creating Z-shaped path | 4 segments, 3 corners |
| `"50"` | One corner near start | L-shaped, 2 segments |
| `",40"` | One corner near end | L-shaped, 2 segments |
| (omitted) | Auto-route at 25%/75% of distance | Default routing |

### Example

```json
[
    {"ids": "api,db", "positions": "right,left", "vertices": "30", "color": "#4CAF50",
     "endStyles": ",arrow", "groups": "data-flow", "lineStyle": "solid"},
    {"ids": "svc,api", "positions": "top,bottom", "vertices": "20,40", "color": "#FF9800",
     "endStyles": "circle,arrow-circle", "animationStyle": "circle", "groups": "api-calls"}
]
```

---

## 10. JavaScript API Reference

### `createIsometric3D(containerId, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultRotation` | `{x, y, z}` | `{x:45, y:0, z:-35}` | Initial camera rotation (degrees) |
| `defaultZoom` | `number` | `1.0` | Initial zoom (range: `0.2`–`3.0`) |
| `mouseSensitivity` | `{x, y, z}` | `{x:0.5, y:0.3, z:0.5}` | Mouse drag sensitivity |
| `rotationLimits` | `{x:{min,max}, y:{min,max}, z:{min,max}}` | `x:[0,90], y:[-180,180], z:[-180,180]` | Rotation clamps |
| `bookmarkPrefix` | `string` | `containerId + '_'` | URL parameter prefix |
| `showCompactControls` | `boolean` | `false` | Show spherical controller |
| `debugShadows` | `boolean` | `false` | Visualize shadow divs |
| `navSelectedTarget` | `string` | `'clicked'` | Which face gets `.nav-selected`: `'clicked'`, `'top'`, `'bottom'`, `'front'`, `'back'`, `'left'`, `'right'` |
| `connectorDefaults` | `object` | see below | Default connector line styles |
| `connectors` | `array` | `null` | Connector definitions (see [Connector Reference](#9-connector-reference)). Alternative to `data-connectors` HTML attribute |
| `dimmingAlpha` | `object` | see below | Alpha values for dimming |

#### `connectorDefaults`

| Property | Default | Values |
|----------|---------|--------|
| `startLine` | `undefined` | `'arrow'`, `'arrowSmall'`, `'circle'`, `'arrow-circle'`, `undefined` |
| `endLine` | `undefined` | same as above |
| `lineStyle` | `'solid'` | `'solid'`, `'dashed'` |
| `animationStyle` | `undefined` | `'circle'`, `undefined` |

#### `dimmingAlpha`

| Property | Default | Description |
|----------|---------|-------------|
| `backgroundColor` | `0.2` | Alpha for background colors of dimmed elements |
| `borderColor` | `0.2` | Alpha for border colors |
| `color` | `0.3` | Alpha for text colors |
| `svg` | `0.25` | Alpha for SVG stroke/fill |

### Key Public Methods

| Method | Description |
|--------|-------------|
| `setRotation(x, y, z)` | Set rotation angles immediately |
| `setZoom(zoom)` | Set zoom level (clamped `0.2`–`3.0`) |
| `getState()` | Returns `{rotation, zoom}` |
| `navigateToPosition(xyz, zoom, el?, pan?, cb?)` | Animate to a camera position |
| `navigateByKey(key)` | Navigate by element ID or `data-section` value |
| `centerOnElement(element)` | Pan to center an element |
| `highlightByKey(keys[])` | Highlight elements matching groups |
| `clearHighlights()` | Remove all highlighting |
| `resetView()` | Animate to default state |
| `on(event, callback)` | Subscribe to events |
| `off(event, callback)` | Unsubscribe |
| `destroy()` | Clean up all listeners |

### Events

```javascript
controller.on('navigationChange', (data) => {
    // data.index      — nav point index
    // data.element    — clicked element
    // data.key        — data-section value or element.id
});
```

---

## 11. ScrollSync API Reference

### `new ScrollSync(controller, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stickyThreshold` | `number\|'auto'` | `'auto'` | Top offset where sections become "active". `'auto'` = measured from `.isometric-wrapper` (`top` + `offsetHeight`) at runtime. Override with a numeric px value if needed. |
| `stickyGap` | `number` | `10` | Gap in px between the sticky wrapper bottom and the section h2. Added to threshold for `scroll-margin-top` and h2 `top`. |
| `scrollDuration` | `number` | `1800` | Scroll animation duration (ms) |
| `debounceDelay` | `number` | `100` | Debounce delay for navigation updates (ms) |
| `sectionSelector` | `string` | `'.description-section'` | CSS selector for content sections |

### Behavior

- **3D → Scroll:** Clicking a navigable 3D element with `data-section` scrolls the page so the matching content section’s top aligns just below the sticky diagram block.
- **Scroll → 3D:** Scrolling through content sections triggers `.click()` on the first matching 3D element, updating the 3D view.
- **Reset:** When no section is visible (scrolled past all), resets to default 3D view and clears URL hash.

---

## 12. HTML Structure Rules

### Container Hierarchy

```
.sticky-section-wrapper                   (position: relative)
  └── .isometric-wrapper                    (position: sticky; groups header + diagram)
      ├── .isometric-header (optional)       (title + description, sticks with diagram)
      └── .isometric-viewport                (border-radius + overflow:hidden)
          └── .isometric-container (id required)
              └── .isometric-perspective (exactly one)
                  ├── .scene (optional wrapper, needed for data-z-axis shadow)
                  │   └── .cuboid (data-width, data-height, data-depth)
                  │       ├── .front
                  │       ├── .back
                  │       ├── .left
                  │       ├── .right
                  │       ├── .top
                  │       └── .bottom
                  ├── .cuboid (can be direct child without scene wrapper)
                  └── .scene (flat 2D content — no cuboid needed)
```

### Key Rules

- `.isometric-container` **must** have a unique `id` attribute.
- There must be exactly **one** `.isometric-perspective` inside the container.
- **Do NOT** put `.face` class in HTML — the library adds it programmatically to all face divs.
- Face divs (`.front`, `.back`, `.left`, `.right`, `.top`, `.bottom`) must be **direct children** of `.cuboid`.
- Every ancestor between a 3D-positioned element and `.isometric-perspective` needs `transform-style: preserve-3d`. The library auto-fixes broken chains (with console warning).
- `.scene` elements can nest inside other `.scene` elements for complex hierarchies.
- **NEVER apply `border-radius` to `.isometric-container`.** The library sets `overflow: hidden` on the container. Per the CSS Transforms spec, `overflow` values other than `visible` cause `transform-style` to be treated as `flat`. Browsers have relaxed this for simple `overflow: hidden`, so `perspective` still works — but adding `border-radius` forces the browser to composite/rasterize content into a separate layer for rounded clipping, which **flattens 3D perspective rendering**. For rounded corners, **always** use an `.isometric-viewport` div around `.isometric-container`:
  ```html
  <div class="isometric-wrapper">      <!-- position: sticky -->
    <div class="isometric-header">     <!-- optional title + description -->
      <h2>My Diagram</h2>
      <p>Description text</p>
    </div>
    <div class="isometric-viewport">   <!-- border-radius + overflow:hidden here -->
      <div id="presenter" class="isometric-container">
        <div class="isometric-perspective grid-layout">...</div>
      </div>
    </div>
  </div>
  ```
  ```css
  .isometric-wrapper {
      position: sticky;
      top: 20px;
      z-index: 100;
      /* NO border-radius or overflow here */
  }
  .isometric-viewport {
      border-radius: 12px;
      overflow: hidden;  /* clips the already-composited 3D output */
  }
  .isometric-container {
      /* NO border-radius here — ever */
  }
  ```

### Layout Classes

| Class | Purpose |
|-------|---------|
| `flex-row` | `display: flex; flex-direction: row; gap: 5px` — horizontal layout inside faces |
| `flex-column` | `display: flex; flex-direction: column; gap: 5px` — vertical layout inside faces |

### Nesting Content in Faces

Faces can contain child divs with navigation attributes:

```html
<div class="left flex-column">
    <div data-section="featureA" data-activate="group1"
         data-nav-xyz="current" data-nav-zoom="current">Feature A</div>
    <div data-nav-xyz="40.10.-65" data-nav-zoom="0.9"
         data-section="featureB">Feature B</div>
</div>
```

### Label Overlay

Labels are positioned **outside** `.isometric-perspective`, **inside** `.isometric-container`:

```html
<div class="label-overlay">
    <div class="label" data-cube="elementId" data-position="right">Label Text</div>
</div>
```

---

## 13. Keyboard & Mouse Controls

### Mouse

| Action | Behavior |
|--------|----------|
| Left drag | X-axis + Z-axis rotation |
| Shift + left drag | Y-axis rotation + zoom |
| Alt + left drag | Pan view |
| Middle drag | Pan view |
| Right drag | Y-axis rotation + zoom |
| Wheel | X-axis rotation |
| Shift + wheel | Zoom |

### Keyboard (container must have focus)

| Key | Action |
|-----|--------|
| `←` `→` | Z-axis rotation |
| `↑` `↓` | X-axis rotation |
| `Shift` + `←` `→` | Y-axis rotation |
| `Shift` + `↑` `↓` | Zoom in/out |
| `Alt` + `←` `→` `↑` `↓` | Pan view |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `Space` / `R` | Reset to default view |
| `Tab` | Next navigation point |
| `Shift+Tab` | Previous navigation point |
| `Alt+Tab` | Cycle highlights only |
| `P` | Toggle auto-play (5s per point) |
| `Shift+P` | Toggle highlight-only auto-play |

---

## 14. URL Bookmark System

- Clicking a navigable element with `data-section="intro"` sets URL to `page.html#intro`.
- Query parameters: `{prefix}-nav=2`, `{prefix}-xyz=45.00.-35`, `{prefix}-zoom=1.2`, `{prefix}-pan=100.-50`.
- Supports browser back/forward via `popstate` and `hashchange` events.

---

## 15. Complete Generated Example

**User Input:**

```
title: "Architecture Overview"
teaser: "A high-level view of the system architecture showing the key components and their interactions."

topics:
  - id: api,    label: "API Gateway",   description: "Handles all incoming HTTP requests..."
  - id: db,     label: "Database",      description: "PostgreSQL database for persistent storage..."
  - id: svc,    label: "Core Service",  description: "Business logic and orchestration layer..."
  - id: ui,     label: "Frontend UI",   description: "React-based single page application..."
  - id: cache,  label: "Cache Layer",   description: "Redis cache for session and query caching..."

grid:
  api  |  .     | db
   .   | svc    | cache
  ui   | ui     |  .

connectors:
  - from: ui,  to: api,   color: "#4CAF50"
  - from: api, to: svc,   color: "#FF9800"
  - from: svc, to: db,    color: "#2196F3"
  - from: svc, to: cache, color: "#E91E63", style: "dashed"
```

**Generated Output:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Architecture Overview</title>
    <link rel="stylesheet" href="../src/isometric-3d.css">
    <style>
        /* ===== Structural CSS ===== */
        body {
            margin: 0;
            padding: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 100vh;
        }
        .sticky-section-wrapper { position: relative; }
        .isometric-wrapper {
            position: sticky;
            top: 20px;
            z-index: 100;
        }
        .isometric-viewport {
            border-radius: 12px;
            overflow: hidden;  /* clips the already-composited 3D output */
        }
        .isometric-container {
            height: 300px;
            width: 100%;
            /* NEVER add border-radius here — it flattens 3D perspective (see Key Rules).
               Use .isometric-viewport above for rounded corners instead. */
        }
        .content-sections { margin: 0 20px 40px 20px; }
        .description-section {
            /* scroll-margin-top is injected by ScrollSync (auto-computed from wrapper height) */
            position: relative;
            min-height: 600px;
            margin-bottom: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .description-section h2 {
            position: sticky;
            /* top is injected by ScrollSync (auto-computed from wrapper height) */
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            margin: 0;
            padding: 15px 20px;
            z-index: 50;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        /* ===== Grid Layout ===== */
        .grid-layout {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-rows: 1fr 1fr 1fr;
            gap: 2px;
            grid-template-areas:
                "api  .     db"
                ".    svc   cache"
                "ui   ui    .";
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: 2px solid #333;
            border-radius: 10px;
        }
        .topic-api   { grid-area: api; }
        .topic-db    { grid-area: db; }
        .topic-svc   { grid-area: svc; }
        .topic-ui    { grid-area: ui; }
        .topic-cache { grid-area: cache; }

        /* ===== Face Colors ===== */
        .cuboid > .face {
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 5px;
            color: white;
            font-weight: bold;
            font-size: 12px;
        }
        .cuboid > .front  { background: rgba(52, 152, 219, 0.7); }
        .cuboid > .back   { background: rgba(46, 204, 113, 0.7); }
        .cuboid > .left   { background: rgba(155, 89, 182, 0.7); }
        .cuboid > .right  { background: rgba(241, 196, 15, 0.7); }
        .cuboid > .top    { background: rgba(76, 175, 80, 0.7); }
        .cuboid > .bottom { background: rgba(52, 73, 94, 0.7); }

        /* ===== Navigation & Highlight Styles ===== */
        .face.nav-selected, .scene.nav-selected {
            outline: 3px solid rgb(255, 0, 225);
            outline-offset: 4px;
        }
        .face.nav-selected[data-activate],
        .scene.nav-selected[data-activate],
        .scene[data-activate] > .cuboid > .face.nav-selected {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { outline-color: rgba(255, 0, 225, 0.8); }
            50%      { outline-color: rgba(255, 0, 255, 0.3); }
        }
        .face.highlight { border-bottom: 3px solid rgba(255, 0, 0, 0.8); }
        .scene.highlight:not(:has(> .cuboid)) { border-bottom: 3px solid rgba(255, 0, 0, 0.8); }

        /* ===== Connector Styles ===== */
        .connector-path { filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)); }
        .connector-path.highlight { filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.4)); opacity: 1 !important; }
    </style>
</head>
<body>

    <!-- PART 2 + PART 3: Sticky wrapper -->
    <div class="sticky-section-wrapper">

        <!-- Sticky block: header + 3D diagram stick together -->
        <div class="isometric-wrapper">

        <!-- PART 2a: Diagram title & description (sticky with diagram) -->
        <div class="isometric-header">
            <h1>Architecture Overview</h1>
            <p>A high-level view of the system architecture showing the key components and their interactions.</p>
        </div>

        <!-- PART 2b: 3D diagram (viewport provides rounded corners without breaking 3D) -->
        <div class="isometric-viewport">
        <div id="presenter" class="isometric-container">
            <div class="isometric-perspective grid-layout">

                <!-- API Gateway -->
                <div class="scene topic-api" data-z-axis="0" data-groups="api">
                    <div id="api" class="cuboid" data-width="100" data-height="auto" data-depth="100">
                        <div class="front">API Gateway</div>
                        <div class="back">back</div>
                        <div class="left">API</div>
                        <div class="right">right</div>
                        <div class="top"
                             data-nav-xyz="45.00.-35" data-nav-zoom="1.2"
                             data-section="api-description"
                             data-activate="api" data-focus="center">API Gateway</div>
                        <div class="bottom">bottom</div>
                    </div>
                </div>

                <!-- Database -->
                <div class="scene topic-db" data-z-axis="0" data-groups="db">
                    <div id="db" class="cuboid" data-width="100" data-height="auto" data-depth="100">
                        <div class="front">Database</div>
                        <div class="back">back</div>
                        <div class="left">DB</div>
                        <div class="right">right</div>
                        <div class="top"
                             data-nav-xyz="45.00.-35" data-nav-zoom="1.2"
                             data-section="db-description"
                             data-activate="db" data-focus="center">Database</div>
                        <div class="bottom">bottom</div>
                    </div>
                </div>

                <!-- Core Service -->
                <div class="scene topic-svc" data-z-axis="0" data-groups="svc">
                    <div id="svc" class="cuboid" data-width="100" data-height="auto" data-depth="100">
                        <div class="front">Core Service</div>
                        <div class="back">back</div>
                        <div class="left">Service</div>
                        <div class="right">right</div>
                        <div class="top"
                             data-nav-xyz="45.00.-35" data-nav-zoom="1.0"
                             data-section="svc-description"
                             data-activate="svc" data-focus="center">Core Service</div>
                        <div class="bottom">bottom</div>
                    </div>
                </div>

                <!-- Cache Layer -->
                <div class="scene topic-cache" data-z-axis="0" data-groups="cache">
                    <div id="cache" class="cuboid" data-width="100" data-height="auto" data-depth="100">
                        <div class="front">Cache Layer</div>
                        <div class="back">back</div>
                        <div class="left">Cache</div>
                        <div class="right">right</div>
                        <div class="top"
                             data-nav-xyz="45.00.-35" data-nav-zoom="1.2"
                             data-section="cache-description"
                             data-activate="cache" data-focus="center">Cache Layer</div>
                        <div class="bottom">bottom</div>
                    </div>
                </div>

                <!-- Frontend UI (spans 2 columns) -->
                <div class="scene topic-ui" data-z-axis="0" data-groups="ui">
                    <div id="ui" class="cuboid" data-width="auto" data-height="auto" data-depth="100">
                        <div class="front">Frontend UI</div>
                        <div class="back">back</div>
                        <div class="left">UI</div>
                        <div class="right">right</div>
                        <div class="top"
                             data-nav-xyz="45.00.-35" data-nav-zoom="0.9"
                             data-section="ui-description"
                             data-activate="ui" data-focus="center">Frontend UI</div>
                        <div class="bottom">bottom</div>
                    </div>
                </div>

            </div>
        </div>
        </div> <!-- /.isometric-viewport -->
        </div> <!-- /.isometric-wrapper -->

        <!-- Scrollable content sections -->
        <div class="content-sections">

            <div id="api-description" class="description-section">
                <h2>API Gateway</h2>
                <div style="padding: 20px;">
                    <p>Handles all incoming HTTP requests, performs authentication,
                       rate limiting, and routes to the appropriate service endpoints.</p>
                </div>
            </div>

            <div id="db-description" class="description-section">
                <h2>Database</h2>
                <div style="padding: 20px;">
                    <p>PostgreSQL database for persistent storage of application data,
                       user records, and transaction history.</p>
                </div>
            </div>

            <div id="svc-description" class="description-section">
                <h2>Core Service</h2>
                <div style="padding: 20px;">
                    <p>Business logic and orchestration layer. Processes requests from
                       the API Gateway and coordinates with Database and Cache.</p>
                </div>
            </div>

            <div id="cache-description" class="description-section">
                <h2>Cache Layer</h2>
                <div style="padding: 20px;">
                    <p>Redis cache for session and query caching. Reduces database load
                       and improves response times for frequently accessed data.</p>
                </div>
            </div>

            <div id="ui-description" class="description-section">
                <h2>Frontend UI</h2>
                <div style="padding: 20px;">
                    <p>React-based single page application. Communicates with the API
                       Gateway via REST and WebSocket connections.</p>
                </div>
            </div>

        </div>
    </div>

    <script src="../src/isometric-3d.js"></script>
    <script src="../src/scroll-sync.js"></script>
    <script>
        const controller = createIsometric3D('presenter', {
            defaultRotation: { x: 45, y: 0, z: -35 },
            defaultZoom: 1.0,
            showCompactControls: true,
            connectors: [
                {ids: 'ui,api', positions: 'top,bottom', vertices: '30', color: '#4CAF50', endStyles: ',arrow', groups: 'ui,api'},
                {ids: 'api,svc', positions: 'bottom,top', vertices: '25', color: '#FF9800', endStyles: ',arrow', groups: 'api,svc', animationStyle: 'circle'},
                {ids: 'svc,db', positions: 'right,left', vertices: '30', color: '#2196F3', endStyles: ',arrow', groups: 'svc,db'},
                {ids: 'svc,cache', positions: 'right,left', vertices: '20', color: '#E91E63', endStyles: ',arrow', lineStyle: 'dashed', groups: 'svc,cache'}
            ],
            connectorDefaults: {
                endLine: 'arrow',
                lineStyle: 'solid'
            }
        });

        const scrollSync = new ScrollSync(controller, {
            // stickyThreshold: 'auto' (default) — auto-computed from .isometric-wrapper height
            scrollDuration: 1800,
            debounceDelay: 100
        });
    </script>
</body>
</html>
```

---

## 16. Checklist for Generated Pages

Before finalizing a generated page, verify:

- [ ] Every topic has a `.scene > .cuboid` with 6 face divs (`front`, `back`, `left`, `right`, `top`, `bottom`)
- [ ] Every `.top` face (or chosen navigable face) has `data-nav-xyz`, `data-nav-zoom`, and `data-section`
- [ ] Every `data-section` value has a matching content section with `id="<same-value>"`
- [ ] The `stickyThreshold` is either `'auto'` (default, auto-computed) or a manually set numeric value matching the sticky block height
- [ ] Grid `grid-template-areas` matches topic IDs used in `.topic-<id>` CSS classes
- [ ] Connector `ids` reference valid element `id` attributes
- [ ] No `.face` class in HTML markup (library adds it automatically)
- [ ] **No `border-radius` on `.isometric-container`** — use `.isometric-viewport` with `border-radius` + `overflow: hidden` around `.isometric-container` for rounded corners
- [ ] `.isometric-wrapper` groups `.isometric-header` (optional) + `.isometric-viewport` as a single sticky unit — no `overflow: hidden` or `border-radius` on `.isometric-wrapper` itself
- [ ] `<link>` to `isometric-3d.css` is in `<head>`
- [ ] `isometric-3d.js` is loaded before `scroll-sync.js`
- [ ] `createIsometric3D()` is called before `new ScrollSync()`
- [ ] Scenes with `data-z-axis > 0` will get automatic shadows

---

## 17. Proposed Library Improvements

The current setup requires ~25 lines of identical structural CSS and careful manual synchronization of magic numbers across 4 locations. These improvements would make the library truly low-code:

### 17.1 Eliminate the Magic Number Chain

**Problem:** The value `stickyThreshold` (= `stickyTop + headerHeight + containerHeight`) must be manually kept in sync across:
1. CSS `.description-section { scroll-margin-top: 380px }`
2. CSS `.description-section h2 { top: 380px }`
3. JS `new ScrollSync(controller, { stickyThreshold: 380 })`
4. CSS `.isometric-wrapper { top: 20px }` + `.isometric-header` height (60px) + `.isometric-container { height: 300px }` (source values)

If any mismatch, scroll-sync breaks silently.

**Solution:** `ScrollSync` should **auto-compute** `stickyThreshold` at runtime:
```javascript
// In ScrollSync constructor:
const wrapper = this.controller.container.closest('.isometric-wrapper');
const wrapperStyle = getComputedStyle(wrapper);
const top = parseInt(wrapperStyle.top) || 0;
const wrapperHeight = wrapper.offsetHeight; // includes header + container
this.options.stickyThreshold = top + wrapperHeight;

// Then inject derived values:
document.querySelectorAll(this.options.sectionSelector).forEach(section => {
    section.style.scrollMarginTop = this.options.stickyThreshold + 'px';
    const h2 = section.querySelector('h2');
    if (h2) h2.style.top = this.options.stickyThreshold + 'px';
});
```

This reduces the 4-location sync to just CSS values (`top` on `.isometric-wrapper` and heights of `.isometric-header` + `.isometric-container`).

### 17.2 CSS Custom Properties Approach

**Alternative to 17.1:** Use CSS variables so all derived values auto-update:

```css
.isometric-wrapper {
    --sticky-top: 20px;
    --header-height: 60px;
    --container-height: 300px;
    position: sticky;
    top: var(--sticky-top);
}
.isometric-header {
    height: var(--header-height);
}
.isometric-container {
    height: var(--container-height);
}
.description-section {
    scroll-margin-top: calc(var(--sticky-top) + var(--header-height) + var(--container-height));
}
.description-section h2 {
    top: calc(var(--sticky-top) + var(--header-height) + var(--container-height));
}
```

Change three variables, everything updates. `ScrollSync` reads them via `getComputedStyle()`.

### 17.3 Ship Scroll-Sync Structural CSS

**Problem:** Every scroll-synced presentation needs ~25 identical lines of CSS for `.sticky-section-wrapper`, `.content-sections`, `.description-section`, and `.description-section h2`. None of these are in the library CSS.

**Solution:** Add these to `src/isometric-3d.css` (or a new `src/scroll-sync.css`):
```css
/* Scroll-sync layout (opt-in via .sticky-section-wrapper) */
.sticky-section-wrapper { position: relative; }
.sticky-section-wrapper > .isometric-wrapper { position: sticky; z-index: 100; }
.sticky-section-wrapper > .isometric-wrapper > .isometric-viewport { border-radius: 12px; overflow: hidden; }
.sticky-section-wrapper > .isometric-wrapper > .isometric-viewport > .isometric-container { /* NO border-radius — ever */ }
.sticky-section-wrapper > .content-sections { margin: 0 20px 40px 20px; }
.description-section { position: relative; min-height: 600px; margin-bottom: 20px; }
.description-section > h2 {
    position: sticky;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    margin: 0; padding: 15px 20px;
    z-index: 50;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

### 17.4 Single Factory Function

**Problem:** Two separate initializations (`createIsometric3D` + `new ScrollSync`) with shared config values.

**Solution:** Provide a combined factory:
```javascript
function createScrollPresentation(containerId, options = {}) {
    const controller = createIsometric3D(containerId, options);
    const scrollSync = new ScrollSync(controller, {
        scrollDuration: options.scrollDuration || 1800,
        debounceDelay: options.debounceDelay || 100
        // stickyThreshold auto-computed per 17.1
    });
    return { controller, scrollSync };
}
```

### 17.5 Auto-Generate Content Sections

**Problem:** Users must manually create a `.description-section` div for every `data-section` in the 3D markup, keeping IDs perfectly matched.

**Solution:** New option `autoCreateSections: true` scans all `data-section` attributes and generates empty section divs:
```javascript
// In ScrollSync or a new factory:
const sections = perspective.querySelectorAll('[data-section]');
const uniqueSections = [...new Set([...sections].map(el => el.getAttribute('data-section')))];
uniqueSections.forEach(sectionId => {
    if (!document.getElementById(sectionId)) {
        const div = document.createElement('div');
        div.id = sectionId;
        div.className = 'description-section';
        div.innerHTML = `<h2>${sectionId}</h2><div style="padding:20px;"></div>`;
        contentContainer.appendChild(div);
    }
});
```

### 17.6 Auto-Wrap Sticky Container

**Problem:** Users must create the `.sticky-section-wrapper` div manually.

**Solution:** `ScrollSync` wraps the container automatically if no wrapper exists:
```javascript
if (!this.controller.container.parentElement.classList.contains('sticky-section-wrapper')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sticky-section-wrapper';
    this.controller.container.parentElement.insertBefore(wrapper, this.controller.container);
    wrapper.appendChild(this.controller.container);
    // Move content-sections into wrapper too
}
```

### Impact Summary

| Improvement | Lines Saved | Complexity Removed |
|-------------|-------------|-------------------|
| 17.1 Auto-compute threshold | 3 CSS + 1 JS | Eliminates 4-location sync |
| 17.2 CSS variables | 3 CSS + 1 JS | Alternative to 17.1 |
| 17.3 Ship scroll CSS | ~25 CSS | Eliminates boilerplate |
| 17.4 Single factory | 5 JS | Simpler init |
| 17.5 Auto-generate sections | ~5 HTML per topic | Reduces HTML by 50% |
| 17.6 Auto-wrap | 3 HTML | Removes non-obvious wrapper |
