#!/usr/bin/env node
/**
 * export-layers.js — Extract per-layer SVGs from architecture.drawio
 *
 * Usage:
 *   node export-layers.js [input.drawio] [viewBoxWidth] [viewBoxHeight]
 *
 * Defaults:
 *   input    = architecture.drawio  (in the same directory as this script)
 *   width    = 660
 *   height   = 305
 *
 * Output:
 *   layer-1-<name>.svg, layer-2-<name>.svg, … (one file per layer)
 *
 * Each drawio layer is an <mxCell> whose parent is "0". Its child vertex
 * cells are converted to <rect> + <text> SVG elements using the drawio
 * style properties (fillColor, strokeColor, fontSize, rounded, arcSize).
 */

const fs   = require('fs');
const path = require('path');

// ── CLI arguments ──────────────────────────────────────────────
const args      = process.argv.slice(2);
const inputFile = args[0] || path.join(__dirname, 'architecture.drawio');
const VB_W      = Number(args[1]) || 660;
const VB_H      = Number(args[2]) || 305;

// ── Read & parse drawio XML ────────────────────────────────────
const xml = fs.readFileSync(inputFile, 'utf8');

// Lightweight XML helpers (no dependencies)
function attr(tag, name) {
  const re = new RegExp(`${name}="([^"]*)"`, 'i');
  const m  = tag.match(re);
  return m ? m[1] : null;
}

function parseStyle(style) {
  if (!style) return {};
  const obj = {};
  style.split(';').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) obj[k.trim()] = v !== undefined ? v.trim() : 'true';
  });
  return obj;
}

// Collect all <mxCell …>…</mxCell> and self-closing <mxCell …/>
// Note: [^>]*? (lazy) is critical so self-closing /> is matched before >…</mxCell>
const cellRe = /<mxCell\b[^>]*?(?:\/>|>[\s\S]*?<\/mxCell>)/g;
const cells  = [];
let m;
while ((m = cellRe.exec(xml)) !== null) {
  const tag  = m[0];
  const id   = attr(tag, 'id');
  const par  = attr(tag, 'parent');
  const val  = attr(tag, 'value') || '';
  const st   = attr(tag, 'style') || '';
  const isV  = attr(tag, 'vertex') === '1';

  // Geometry
  const geoM = tag.match(/<mxGeometry\b[^>]*/);
  let x = 0, y = 0, w = 0, h = 0;
  if (geoM) {
    x = Number(attr(geoM[0], 'x')) || 0;
    y = Number(attr(geoM[0], 'y')) || 0;
    w = Number(attr(geoM[0], 'width'))  || 0;
    h = Number(attr(geoM[0], 'height')) || 0;
  }

  cells.push({ id, parent: par, value: val, style: st, vertex: isV, x, y, w, h });
}

// ── Identify layers (parent === "0", not id "0") ──────────────
const layers = cells
  .filter(c => c.parent === '0' && c.id !== '0')
  .sort((a, b) => Number(a.id) - Number(b.id));

console.log(`Found ${layers.length} layer(s) in ${path.basename(inputFile)}`);

// ── Generate an SVG for each layer ─────────────────────────────
layers.forEach((layer, idx) => {
  const children = cells.filter(c => c.parent === layer.id && c.vertex);
  if (children.length === 0) return;

  const layerName = layer.value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const fileName = `layer-${idx + 1}-${layerName}.svg`;

  let svgBody = '';
  for (const c of children) {
    const s    = parseStyle(c.style);
    const fill = s.fillColor   || '#ffffff';
    const strk = s.strokeColor || '#000000';
    const fs   = Number(s.fontSize) || 12;
    const bold = s.fontStyle === '1';
    const rx   = s.arcSize ? Number(s.arcSize) : (s.rounded === '1' ? 6 : 0);
    const sw   = fs >= 14 ? 2.5 : 1.5;

    // Vertical-align drives text y position
    const vAlign = s.verticalAlign || 'middle';
    let textY;
    if (vAlign === 'top')         textY = c.y + fs + 4;
    else if (vAlign === 'bottom') textY = c.y + c.h - 4;
    else                          textY = c.y + c.h / 2 + fs / 3;

    const textX = c.x + c.w / 2;

    svgBody += `  <rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${rx}" fill="${fill}" stroke="${strk}" stroke-width="${sw}"/>\n`;
    svgBody += `  <text x="${textX}" y="${textY}" text-anchor="middle" style="font:${bold ? 'font-weight:bold;' : ''}${fs}px sans-serif;fill:${strk}">${escapeXml(c.value)}</text>\n`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}">\n${svgBody}</svg>\n`;

  const outPath = path.join(path.dirname(inputFile), fileName);
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`  ✓ ${fileName}  (${children.length} elements)`);
});

console.log('Done.');

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
