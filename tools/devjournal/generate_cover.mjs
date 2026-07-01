#!/usr/bin/env node
// Generate a branded "Building Elsa 4" DevJournal featured cover (SVG -> PNG).
//
// Deterministic, no external services. Renders a dark slate cover that echoes the
// Elsa designer aesthetic (workflow nodes + connectors) with series-consistent
// typography, then rasterizes it to a PNG via @resvg/resvg-js.
//
// Usage:
//   node tools/devjournal/generate_cover.mjs \
//     --kicker "WEEK 5" \
//     --title "The Runtime Stops Being a Stub" \
//     --meta "June 5–12, 2026 · elsa-foundation" \
//     --accent teal \
//     --out content/assets/2026-06-12-building-elsa-4-week-5/featured.png
//
// Accents: teal (default), blue, purple, amber.

import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const WIDTH = 1600;
const HEIGHT = 900;

const ACCENTS = {
  teal:   { main: '#2dd4bf', soft: '#0f766e', dim: '#14b8a6' },
  blue:   { main: '#60a5fa', soft: '#1d4ed8', dim: '#3b82f6' },
  purple: { main: '#a78bfa', soft: '#6d28d9', dim: '#8b5cf6' },
  amber:  { main: '#fbbf24', soft: '#b45309', dim: '#f59e0b' },
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--')) continue;
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Greedy word-wrap based on an approximate glyph width for the headline font.
function wrapText(text, fontSize, maxWidth) {
  const avg = fontSize * 0.56; // bold Helvetica/Arial approximation
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length * avg > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildSvg({ kicker, title, meta, accentName }) {
  const accent = ACCENTS[accentName] || ACCENTS.teal;
  const fontFamily = "Helvetica, 'Helvetica Neue', Arial, sans-serif";

  // Headline: size adapts to length so 1-3 lines always fit the left column.
  const headlineSize = title.length > 40 ? 72 : title.length > 26 ? 84 : 96;
  const lineHeight = Math.round(headlineSize * 1.12);
  const lines = wrapText(title, headlineSize, 940);
  const headlineBlockTop = 420 - ((lines.length - 1) * lineHeight) / 2;
  const headlineSvg = lines
    .map(
      (ln, i) =>
        `<text x="112" y="${headlineBlockTop + i * lineHeight}" font-family="${fontFamily}" ` +
        `font-size="${headlineSize}" font-weight="700" fill="#f4f7fb" letter-spacing="-1">${escapeXml(ln)}</text>`,
    )
    .join('\n      ');
  const underlineY = headlineBlockTop + (lines.length - 1) * lineHeight + 46;

  // Right-side workflow motif: nodes + connectors echoing the designer canvas.
  const node = (x, y, w, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="56" rx="14" fill="${fill}" opacity="0.92"/>` +
    `<rect x="${x + 16}" y="${y + 25}" width="${w - 70}" height="6" rx="3" fill="#0b0f14" opacity="0.5"/>`;
  const link = (x1, y1, x2, y2) =>
    `<path d="M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" ` +
    `stroke="#5b6b7d" stroke-width="3" fill="none" opacity="0.7"/>`;

  const motif = `
      <g transform="translate(1120 250)">
        ${link(70, 60, 250, 28)}
        ${link(70, 60, 250, 150)}
        ${link(310, 150, 250, 270)}
        ${link(70, 60, 130, 350)}
        ${link(190, 350, 250, 270)}
        <rect x="232" y="120" width="56" height="56" rx="12" transform="rotate(45 260 148)" fill="${accent.main}" opacity="0.95"/>
        ${node(0, 32, 150, '#3b4757')}
        ${node(250, 0, 160, '#4f6072')}
        ${node(250, 122, 160, accent.dim)}
        ${node(250, 242, 160, '#4f6072')}
        ${node(70, 322, 150, '#3b4757')}
      </g>`;

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10141b"/>
      <stop offset="0.55" stop-color="#1a2330"/>
      <stop offset="1" stop-color="#222f40"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.32" r="0.5">
      <stop offset="0" stop-color="${accent.soft}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${accent.soft}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.6" fill="#9fb0c2" opacity="0.06"/>
    </pattern>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${WIDTH}" height="8" fill="${accent.main}"/>
  ${motif}

  <g>
    <rect x="112" y="150" width="22" height="22" rx="5" fill="${accent.main}"/>
    <text x="148" y="168" font-family="${fontFamily}" font-size="26" font-weight="700" letter-spacing="5" fill="#aebccb">BUILDING ELSA 4 <tspan fill="#5f6f80">·  DEVJOURNAL</tspan></text>
  </g>

  <text x="112" y="252" font-family="${fontFamily}" font-size="40" font-weight="700" letter-spacing="3" fill="${accent.main}">${escapeXml(kicker)}</text>

  ${headlineSvg}

  <rect x="112" y="${underlineY}" width="132" height="7" rx="3.5" fill="${accent.main}"/>

  <text x="112" y="800" font-family="${fontFamily}" font-size="27" font-weight="500" fill="#8294a6">${escapeXml(meta)}</text>
</svg>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['kicker', 'title', 'out'];
  for (const key of required) {
    if (!args[key]) {
      console.error(`Missing --${key}. See header for usage.`);
      process.exit(1);
    }
  }
  const svg = buildSvg({
    kicker: args.kicker,
    title: args.title,
    meta: args.meta || '',
    accentName: args.accent || 'teal',
  });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' },
  });
  const png = resvg.render().asPng();
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, png);
  console.log(`Wrote ${args.out} (${png.length} bytes)`);
}

main();
