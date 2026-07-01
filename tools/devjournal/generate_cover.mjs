#!/usr/bin/env node
// Generate a branded "Building Elsa 4" DevJournal featured cover (SVG -> PNG).
//
// Deterministic, no external services. Renders a polished editorial cover that
// keeps the series identity consistent while letting each post carry its own
// visual metaphor.
//
// Usage:
//   node tools/devjournal/generate_cover.mjs \
//     --kicker "WEEK 5" \
//     --title "The Runtime Stops Being a Stub" \
//     --meta "June 5-12, 2026 · elsa-foundation" \
//     --accent teal \
//     --motif runtime \
//     --out content/assets/2026-06-12-building-elsa-4-week-5/featured.png
//
// Accents: teal (default), blue, violet, amber, green, rose.
// Motifs: foundation, constitution, events, specs, command, runtime,
//         observability, trust.

import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const WIDTH = 1600;
const HEIGHT = 900;

const ACCENTS = {
  teal: { main: '#25d0c3', second: '#3b82f6', warm: '#f5b547', deep: '#102a37' },
  blue: { main: '#58a6ff', second: '#22c55e', warm: '#f5b547', deep: '#10243f' },
  violet: { main: '#a78bfa', second: '#22d3ee', warm: '#f59e0b', deep: '#241b3f' },
  amber: { main: '#f5b547', second: '#38bdf8', warm: '#fb7185', deep: '#342414' },
  green: { main: '#4ade80', second: '#38bdf8', warm: '#f5b547', deep: '#123323' },
  rose: { main: '#fb7185', second: '#60a5fa', warm: '#f5b547', deep: '#3b1722' },
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key?.startsWith('--')) continue;
    out[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text, fontSize, maxWidth) {
  const avg = fontSize * 0.54;
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

function headline(title) {
  const fontSize = title.length > 48 ? 64 : title.length > 34 ? 72 : 82;
  const lineHeight = Math.round(fontSize * 1.13);
  const lines = wrapText(title, fontSize, 720).slice(0, 4);
  const top = 360;
  const svg = lines
    .map(
      (line, i) =>
        `<text x="96" y="${top + i * lineHeight}" font-size="${fontSize}" font-weight="760" fill="#132033">${escapeXml(line)}</text>`,
    )
    .join('\n    ');

  return { svg, underlineY: top + (lines.length - 1) * lineHeight + 54 };
}

function connectorPath(x1, y1, x2, y2, color, opacity = 0.74) {
  const mid = (x1 + x2) / 2;
  return `<path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" stroke="${color}" stroke-width="4" fill="none" opacity="${opacity}"/>`;
}

function node(x, y, w, h, label, color = '#253245') {
  return `
    <g filter="url(#softShadow)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}" stroke="#ffffff" stroke-opacity="0.08"/>
      <rect x="${x + 22}" y="${y + 23}" width="${Math.max(28, w - 86)}" height="8" rx="4" fill="#d9e5f0" opacity="0.34"/>
      <rect x="${x + 22}" y="${y + 44}" width="${Math.max(22, w - 124)}" height="6" rx="3" fill="#d9e5f0" opacity="0.18"/>
      <text x="${x + 22}" y="${y + h - 22}" font-size="18" font-weight="700" fill="#d9e5f0" opacity="0.78">${escapeXml(label)}</text>
    </g>`;
}

function glassPanel(x, y, w, h, title, accent) {
  return `
    <g filter="url(#softShadow)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="#111a27" fill-opacity="0.84" stroke="#dcecff" stroke-opacity="0.1"/>
      <rect x="${x + 26}" y="${y + 28}" width="12" height="12" rx="6" fill="${accent.main}"/>
      <text x="${x + 50}" y="${y + 40}" font-size="21" font-weight="720" fill="#e8f1fb">${escapeXml(title)}</text>
      <rect x="${x + 26}" y="${y + 66}" width="${w - 52}" height="1" fill="#ffffff" opacity="0.1"/>
    </g>`;
}

function foundationMotif(accent) {
  return `
    <g transform="translate(845 162)">
      ${glassPanel(0, 0, 570, 600, 'thin protocol foundation', accent)}
      <g transform="translate(62 132)">
        <rect x="0" y="312" width="430" height="38" rx="10" fill="${accent.main}" opacity="0.92"/>
        <rect x="28" y="244" width="374" height="40" rx="10" fill="#d7e7f8" opacity="0.18"/>
        <rect x="58" y="176" width="314" height="40" rx="10" fill="#d7e7f8" opacity="0.24"/>
        <rect x="90" y="108" width="250" height="40" rx="10" fill="#d7e7f8" opacity="0.32"/>
        <rect x="124" y="40" width="184" height="40" rx="10" fill="${accent.second}" opacity="0.9"/>
        <path d="M 214 40 L 214 0" stroke="${accent.warm}" stroke-width="5" stroke-linecap="round"/>
        <circle cx="214" cy="-16" r="13" fill="${accent.warm}"/>
      </g>
      ${node(302, 420, 172, 76, 'primitives', accent.deep)}
    </g>`;
}

function constitutionMotif(accent) {
  return `
    <g transform="translate(846 154)">
      ${glassPanel(0, 0, 572, 616, 'architecture law', accent)}
      <g transform="translate(74 118)" filter="url(#softShadow)">
        <rect x="0" y="0" width="362" height="430" rx="22" fill="#f8fafc" opacity="0.94"/>
        <rect x="42" y="52" width="190" height="12" rx="6" fill="#182233" opacity="0.82"/>
        <rect x="42" y="92" width="274" height="8" rx="4" fill="#182233" opacity="0.25"/>
        <rect x="42" y="122" width="236" height="8" rx="4" fill="#182233" opacity="0.25"/>
        <rect x="42" y="174" width="278" height="52" rx="12" fill="${accent.main}" opacity="0.2"/>
        <rect x="42" y="256" width="278" height="52" rx="12" fill="${accent.second}" opacity="0.18"/>
        <rect x="42" y="338" width="180" height="12" rx="6" fill="${accent.warm}" opacity="0.82"/>
      </g>
      <g transform="translate(356 442)">
        <circle cx="70" cy="70" r="70" fill="${accent.deep}" stroke="${accent.main}" stroke-width="7"/>
        <path d="M 36 72 L 62 98 L 108 42" stroke="#f8fafc" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </g>`;
}

function eventsMotif(accent) {
  return `
    <g transform="translate(846 162)">
      ${glassPanel(0, 0, 572, 600, 'domains talk through events', accent)}
      ${connectorPath(112, 214, 282, 142, accent.main)}
      ${connectorPath(112, 300, 282, 300, accent.second)}
      ${connectorPath(112, 386, 282, 458, accent.warm)}
      ${connectorPath(342, 142, 462, 236, accent.main, 0.55)}
      ${connectorPath(342, 300, 462, 300, accent.second, 0.55)}
      ${connectorPath(342, 458, 462, 364, accent.warm, 0.55)}
      ${node(58, 180, 150, 76, 'design', accent.deep)}
      ${node(58, 266, 150, 76, 'runtime', '#17283c')}
      ${node(58, 352, 150, 76, 'scripting', '#2a2338')}
      ${node(282, 104, 150, 76, 'event', '#233145')}
      ${node(282, 266, 150, 76, 'mediator', accent.deep)}
      ${node(282, 428, 150, 76, 'adapter', '#342414')}
      <circle cx="494" cy="300" r="66" fill="${accent.main}" opacity="0.15"/>
      <circle cx="494" cy="300" r="35" fill="${accent.main}" opacity="0.88"/>
    </g>`;
}

function specsMotif(accent) {
  const specs = [
    ['001', 76, 140, accent.main],
    ['002', 244, 232, accent.second],
    ['E2.9', 110, 356, accent.warm],
    ['scope', 330, 390, accent.main],
  ];
  return `
    <g transform="translate(846 154)">
      ${glassPanel(0, 0, 572, 616, 'spec-driven slices', accent)}
      <g transform="translate(68 116)">
        ${specs
          .map(
            ([label, x, y, color]) => `
              <g filter="url(#softShadow)">
                <rect x="${x}" y="${y}" width="146" height="112" rx="20" fill="#152033" stroke="${color}" stroke-opacity="0.55"/>
                <text x="${x + 26}" y="${y + 54}" font-size="32" font-weight="800" fill="${color}">${label}</text>
                <rect x="${x + 26}" y="${y + 76}" width="82" height="7" rx="4" fill="#d8e6f3" opacity="0.22"/>
              </g>`,
          )
          .join('')}
        <path d="M 150 252 C 204 300, 234 270, 276 304 S 380 342, 404 310" stroke="#9fb3c8" stroke-width="4" fill="none" opacity="0.46"/>
        <rect x="258" y="130" width="206" height="74" rx="18" fill="#f8fafc" opacity="0.88"/>
        <text x="282" y="176" font-size="25" font-weight="760" fill="#162133">no god object</text>
      </g>
    </g>`;
}

function commandMotif(accent) {
  return `
    <g transform="translate(846 154)">
      ${glassPanel(0, 0, 572, 616, 'one command surface', accent)}
      <g transform="translate(62 152)">
        <rect x="0" y="142" width="448" height="124" rx="28" fill="${accent.deep}" stroke="${accent.main}" stroke-opacity="0.7" filter="url(#softShadow)"/>
        <text x="54" y="216" font-size="34" font-weight="820" fill="#f8fafc">IUpdateDraftCommand</text>
        ${connectorPath(92, 60, 92, 142, accent.main)}
        ${connectorPath(226, 60, 226, 142, accent.second)}
        ${connectorPath(360, 60, 360, 142, accent.warm)}
        ${connectorPath(92, 266, 72, 356, accent.main)}
        ${connectorPath(226, 266, 226, 356, accent.second)}
        ${connectorPath(360, 266, 380, 356, accent.warm)}
        ${node(22, 0, 140, 70, 'state', '#1f2c42')}
        ${node(156, 0, 140, 70, 'layout', '#1f2c42')}
        ${node(290, 0, 140, 70, 'diff', '#1f2c42')}
        ${node(0, 356, 150, 76, 'events', '#1f2c42')}
        ${node(150, 356, 150, 76, 'validate', '#1f2c42')}
        ${node(300, 356, 150, 76, 'persist', '#1f2c42')}
      </g>
    </g>`;
}

function runtimeMotif(accent) {
  return `
    <g transform="translate(846 154)">
      ${glassPanel(0, 0, 572, 616, 'checkpoint runtime', accent)}
      <g transform="translate(74 136)">
        <path d="M 44 220 H 414" stroke="#d8e7f5" stroke-width="8" stroke-linecap="round" opacity="0.18"/>
        ${[0, 1, 2, 3].map((i) => {
          const x = 48 + i * 118;
          const color = [accent.main, accent.second, accent.warm, '#d8e7f5'][i];
          return `
            <g filter="url(#softShadow)">
              <rect x="${x}" y="${156 - i * 22}" width="92" height="128" rx="22" fill="#142033" stroke="${color}" stroke-opacity="0.72"/>
              <circle cx="${x + 46}" cy="${220}" r="20" fill="${color}"/>
              <rect x="${x + 24}" y="${250 - i * 22}" width="44" height="7" rx="4" fill="#d8e7f5" opacity="0.25"/>
            </g>`;
        }).join('')}
        <rect x="78" y="358" width="318" height="72" rx="22" fill="${accent.deep}" stroke="${accent.main}" stroke-opacity="0.45" filter="url(#softShadow)"/>
        <text x="126" y="404" font-size="30" font-weight="790" fill="#f8fafc">post-commit outbox</text>
      </g>
    </g>`;
}

function observabilityMotif(accent) {
  return `
    <g transform="translate(846 154)">
      ${glassPanel(0, 0, 572, 616, 'observable engine', accent)}
      <g transform="translate(70 122)" filter="url(#softShadow)">
        <rect x="0" y="0" width="430" height="410" rx="28" fill="#111a27" stroke="#dcecff" stroke-opacity="0.1"/>
        <rect x="34" y="42" width="362" height="86" rx="20" fill="#172338"/>
        <path d="M 62 92 C 118 34, 166 134, 224 80 S 326 54, 372 96" stroke="${accent.main}" stroke-width="7" fill="none" stroke-linecap="round"/>
        ${[0, 1, 2, 3, 4].map((i) => `<rect x="${54 + i * 66}" y="${318 - i * 30}" width="32" height="${60 + i * 30}" rx="8" fill="${i % 2 ? accent.second : accent.main}" opacity="${0.58 + i * 0.08}"/>`).join('')}
        <circle cx="340" cy="224" r="58" fill="none" stroke="${accent.warm}" stroke-width="18" opacity="0.9"/>
        <circle cx="340" cy="224" r="58" fill="none" stroke="${accent.second}" stroke-width="18" stroke-dasharray="130 300" opacity="0.9"/>
        <rect x="52" y="166" width="160" height="12" rx="6" fill="#d8e7f5" opacity="0.24"/>
        <rect x="52" y="198" width="212" height="12" rx="6" fill="#d8e7f5" opacity="0.18"/>
        <rect x="52" y="230" width="132" height="12" rx="6" fill="#d8e7f5" opacity="0.18"/>
      </g>
    </g>`;
}

function trustMotif(accent) {
  return `
    <g transform="translate(846 154)">
      ${glassPanel(0, 0, 572, 616, 'review-first trust boundary', accent)}
      <g transform="translate(80 126)">
        <path d="M 214 0 L 408 70 V 210 C 408 336, 322 410, 214 458 C 106 410, 20 336, 20 210 V 70 Z" fill="${accent.deep}" stroke="${accent.main}" stroke-width="7" filter="url(#softShadow)"/>
        <path d="M 214 58 L 350 108 V 216 C 350 298, 292 350, 214 388 C 136 350, 78 298, 78 216 V 108 Z" fill="#0d1522" stroke="#ffffff" stroke-opacity="0.1"/>
        <path d="M 144 234 L 194 284 L 294 174" stroke="#f8fafc" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="116" y="414" width="196" height="64" rx="20" fill="${accent.warm}" opacity="0.95" filter="url(#softShadow)"/>
        <text x="156" y="455" font-size="26" font-weight="820" fill="#172033">undoable</text>
      </g>
    </g>`;
}

function motifSvg(name, accent) {
  switch (name) {
    case 'foundation':
      return foundationMotif(accent);
    case 'constitution':
      return constitutionMotif(accent);
    case 'events':
      return eventsMotif(accent);
    case 'specs':
      return specsMotif(accent);
    case 'command':
      return commandMotif(accent);
    case 'runtime':
      return runtimeMotif(accent);
    case 'observability':
      return observabilityMotif(accent);
    case 'trust':
      return trustMotif(accent);
    default:
      return eventsMotif(accent);
  }
}

function buildSvg({ kicker, title, meta, accentName, motif }) {
  const accent = ACCENTS[accentName] || ACCENTS.teal;
  const fontFamily = "Inter, Helvetica, 'Helvetica Neue', Arial, sans-serif";
  const headlineBlock = headline(title);

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6f9fc"/>
      <stop offset="0.46" stop-color="#e8eef6"/>
      <stop offset="0.461" stop-color="#111827"/>
      <stop offset="1" stop-color="#172337"/>
    </linearGradient>
    <linearGradient id="leftWash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.96"/>
      <stop offset="1" stop-color="#d7e2ef" stop-opacity="0.82"/>
    </linearGradient>
    <linearGradient id="rightWash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent.deep}" stop-opacity="0.2"/>
      <stop offset="1" stop-color="${accent.main}" stop-opacity="0.18"/>
    </linearGradient>
    <pattern id="grid" width="46" height="46" patternUnits="userSpaceOnUse">
      <path d="M 46 0 H 0 V 46" fill="none" stroke="#506174" stroke-width="1" opacity="0.18"/>
    </pattern>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#07111f" flood-opacity="0.24"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="0" y="0" width="792" height="${HEIGHT}" fill="url(#leftWash)"/>
  <rect x="792" y="0" width="808" height="${HEIGHT}" fill="url(#grid)" opacity="0.72"/>
  <rect x="792" y="0" width="808" height="${HEIGHT}" fill="url(#rightWash)"/>
  <path d="M 792 0 C 856 148, 838 336, 795 456 C 746 592, 784 744, 832 900 H 760 V 0 Z" fill="#f6f9fc" opacity="0.94"/>
  <rect x="0" y="0" width="${WIDTH}" height="8" fill="${accent.main}"/>

  <g font-family="${fontFamily}">
    <g>
      <rect x="96" y="126" width="22" height="22" rx="6" fill="${accent.main}"/>
      <text x="134" y="145" font-size="25" font-weight="780" fill="#172033">BUILDING ELSA 4</text>
      <text x="134" y="179" font-size="20" font-weight="680" fill="#607086">DEVJOURNAL</text>
    </g>

    <text x="96" y="266" font-size="38" font-weight="820" fill="${accent.main}">${escapeXml(kicker)}</text>
    ${headlineBlock.svg}
    <rect x="96" y="${headlineBlock.underlineY}" width="150" height="8" rx="4" fill="${accent.main}"/>
    <rect x="258" y="${headlineBlock.underlineY}" width="62" height="8" rx="4" fill="${accent.warm}"/>

    <text x="96" y="774" font-size="25" font-weight="600" fill="#5f7082">${escapeXml(meta)}</text>
    <text x="96" y="818" font-size="22" font-weight="640" fill="#8a98a8">elsa-workflows · .NET workflow engine rebuild</text>

    ${motifSvg(motif, accent)}
  </g>
</svg>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const key of ['kicker', 'title', 'out']) {
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
    motif: args.motif || 'events',
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
