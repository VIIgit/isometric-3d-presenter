# Architecture Layers Example

Stacked isometric layers showing a hierarchical architecture:
**Geo Regions → Planets → Organizations → Environments**.

## Files

| File | Description |
|------|-------------|
| `stacked-layers.html` | Demo page using the isometric-3d presenter |
| `architecture.drawio` | Source diagram (edit in draw.io / VS Code) |
| `layer-1-geo-regions.svg` | SVG — Geo Regions layer |
| `layer-2-planets.svg` | SVG — Planets layer |
| `layer-3-organizations.svg` | SVG — Organizations layer |
| `layer-4-environments.svg` | SVG — Environments layer |
| `export-layers.js` | Node.js script to regenerate SVGs from the drawio |

## Editing the Diagram

1. Open `architecture.drawio` in [draw.io](https://app.diagrams.net/) or the VS Code draw.io extension.
2. Each **layer** in draw.io becomes a separate SVG file. The layers (bottom to top) are:
   - **Geo Regions** — top-level geographic regions (US, CH, …)
   - **Planets** — Internal / External groupings
   - **Organizations** — Org subdivisions within each planet
   - **Environments** — Dev / Stg / Prd instances within each org
3. Add, remove, or reposition cells within a layer. The export script reads each cell's position, size, and style directly from the drawio XML.

## Exporting Layers to SVG

After editing `architecture.drawio`, regenerate the SVG files:

```bash
node export-layers.js
```

This reads the drawio XML, groups cells by their parent layer, and writes one SVG per layer with a `660 × 305` viewBox.

### Custom viewBox size

```bash
node export-layers.js architecture.drawio 800 400
```

Arguments: `[input.drawio] [width] [height]` — all optional, defaults to `architecture.drawio` / `660` / `305`.

### How the export works

1. Parses all `<mxCell>` elements from the drawio XML.
2. Identifies layers — cells whose `parent="0"` (excluding the root cell `id="0"`).
3. For each layer, collects child vertex cells and converts them to SVG `<rect>` + `<text>` elements using drawio style properties (`fillColor`, `strokeColor`, `fontSize`, `rounded`, `arcSize`).
4. Writes `layer-N-<name>.svg` files alongside the drawio source.
