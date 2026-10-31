// Renders the authored vector glyphs (src/art/glyphs.js) into crisp pixel-art PNG sprites.
// Run: node scripts/make-sprites.mjs   (needs the Playwright Chromium that `npm i` already installs)
import { chromium } from "playwright-core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { GLYPHS } from "./glyphs.js";
import { DOMAINS, SYSTEMS } from "../shared/world.mjs";
import { ICON_IDS } from "../shared/icons.mjs";

const OUT = new URL("../src/assets/sprites/", import.meta.url);
const OUTLINE = "#4a4543";
const PAPER = "#fbfbfb";
const GRID = 40;

const FILL = {
  climate: "#ecd878",
  power: "#ecd878",
  nature: "#8fd68a",
  water: "#86a6e6",
  transport: "#e49a94",
  farming: "#e6c874",
  industry: "#dcaa85",
  health: "#e49a94",
  communications: "#b38be0",
  economy: "#ecc678",
  education: "#b38be0",
  people: "#e0a98a",
  blackout: "#ecd878",
  drought: "#e6b384",
  wildfire: "#e49a94",
  strike: "#e6b384",
  discovery: "#ecd878",
  signal: "#86a6e6",
  butterfly: "#b38be0",
  sparkle: "#ecd878",
  flower: "#e49ac8",
  cloud: "#a8c2ee",
};

const svgFor = (glyph, fill) => {
  const f = glyph.fill.map((d) => `<path d="${d}" fill="${fill}"/>`).join("");
  const ink = glyph.ink
    .map((i) => {
      const s = typeof i === "string" ? { d: i } : i;
      return `<path d="${s.d}" fill="${s.solid ? PAPER : "none"}" stroke="${OUTLINE}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 52 52">${f}${ink}</svg>`;
};

const figure = (x, y, tilt, fill) => `
  <g transform="rotate(${tilt} ${x} ${y + 14})" stroke="${OUTLINE}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${x - 3} ${y + 22}l-2 9M${x + 3} ${y + 22}l2 9M${x - 5} ${y + 12}l-6 5M${x + 5} ${y + 12}l6 4" fill="none"/>
    <rect x="${x - 5}" y="${y + 10}" width="10" height="13" fill="${fill}"/>
    <circle cx="${x}" cy="${y + 5}" r="6.2" fill="#ffffff"/>
    <circle cx="${x - 2.3}" cy="${y + 4.6}" r="0.9" fill="${OUTLINE}" stroke="none"/><circle cx="${x + 2.3}" cy="${y + 4.6}" r="0.9" fill="${OUTLINE}" stroke="none"/>
  </g>`;
const CROWD = [
  [12, 8, -8, "#86a6e6"],
  [26, 3, 6, "#b38be0"],
  [40, 8, -4, "#8fd68a"],
  [54, 2, 9, "#e0a98a"],
  [68, 7, -7, "#e6d878"],
  [82, 3, 5, "#8fd68a"],
  [96, 8, -10, "#e49a94"],
];

const EXTRA = {
  crowd: {
    w: 112,
    h: 44,
    view: "0 0 112 44",
    svg: CROWD.map((c) => figure(...c)).join(""),
  },
  "arrow-curl": {
    w: 40,
    h: 40,
    view: "0 0 40 40",
    color: "#db9591",
    svg: '<g fill="none" stroke="#db9591" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5C7 24 18 33 33 30"/><path d="M26 23l8 7-9 5"/></g>',
  },
  "arrow-down": {
    w: 32,
    h: 40,
    view: "0 0 32 40",
    color: "#db9591",
    svg: '<g fill="none" stroke="#db9591" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 4C10 14 24 22 16 35"/><path d="M8 28l8 8 7-9"/></g>',
  },
  "arrow-right": {
    w: 40,
    h: 28,
    view: "0 0 40 28",
    color: "#db9591",
    svg: '<g fill="none" stroke="#db9591" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18C12 6 24 8 35 14"/><path d="M28 7l8 7-9 5"/></g>',
  },
};

const jobs = [
  ...Object.entries(FILL).map(([id, fill]) => ({
    id,
    w: GRID,
    h: GRID,
    svg: svgFor(GLYPHS[id], fill),
    palette: [OUTLINE, fill, PAPER],
  })),
  ...Object.entries(EXTRA).map(([id, e]) => ({
    id,
    w: e.w,
    h: e.h,
    palette: e.color
      ? [e.color]
      : [
          OUTLINE,
          "#ffffff",
          "#86a6e6",
          "#b38be0",
          "#8fd68a",
          "#e0a98a",
          "#e6d878",
          "#e49a94",
        ],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${e.view}" shape-rendering="${e.color ? "auto" : "crispEdges"}">${e.svg}</svg>`,
  })),
];

// ---- Sprites rendered from the open-source Phosphor icon set (MIT), in the same pixel style ----
const PHOSPHOR = new URL(
  "../node_modules/@phosphor-icons/core/assets/duotone/",
  import.meta.url,
);
const PASTELS = [
  "#ecd878",
  "#8fd68a",
  "#86a6e6",
  "#e49a94",
  "#b38be0",
  "#e6c874",
  "#e49ac8",
  "#9aa8ee",
  "#dcaa85",
  "#a8c2ee",
];

// Known systems that have no hand-drawn glyph borrow an icon, coloured by their area.
const SYSTEM_ICON = {
  renewables: "solar-panel",
  fuel: "gas-pump",
  air: "wind",
  oceans: "waves",
  waste: "recycle",
  food: "shopping-cart",
  restaurants: "fork-knife",
  fisheries: "fish",
  pharma: "pill",
  publichealth: "virus",
  mental: "brain",
  rail: "train",
  aviation: "airplane",
  shipping: "boat",
  logistics: "truck",
  datacenters: "database",
  cyber: "shield-check",
  software: "code",
  ai: "robot",
  social: "chat-circle",
  chips: "cpu",
  banks: "bank",
  markets: "chart-line-up",
  jobs: "briefcase",
  business: "storefront",
  prices: "receipt",
  retail: "shopping-bag",
  housing: "house",
  culture: "music-notes",
  media: "newspaper",
  trust: "handshake",
  construction: "hard-hat",
  mining: "hammer",
  governance: "flag",
  elections: "check-fat",
  budget: "piggy-bank",
  diplomacy: "globe-hemisphere-west",
  crime: "mask-sad",
  law: "gavel",
  military: "shield",
  emergency: "siren",
  universities: "student",
  research: "flask",
  cybercrime: "skull",
};
const CAUSE_ICON = {
  cyberattack: ["bug", "#e49a94"],
  pandemic: ["virus", "#8fd68a"],
  crash: ["chart-line-down", "#e49a94"],
  heatwave: ["thermometer-hot", "#e6b384"],
};

async function phosphorSvg(name, fill) {
  const raw = await readFile(new URL(`${name}-duotone.svg`, PHOSPHOR), "utf8");
  const body = raw.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const painted = body.replace(
    /<(path|circle|rect|ellipse|line|polygon|polyline)\b([^>]*?)\/>/g,
    (_, tag, attrs) => {
      const bare = attrs.replace(/\sfill="[^"]*"/g, "");
      return /opacity="0\.2"/.test(bare)
        ? `<${tag}${bare.replace(/\sopacity="0\.2"/, "")} fill="${fill}"/>`
        : `<${tag}${bare} fill="${OUTLINE}"/>`;
    },
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${painted}</svg>`;
}
const areaColor = (domain) => DOMAINS.find((d) => d.id === domain).color;
const iconJob = async (id, name, fill) => ({
  id,
  w: GRID,
  h: GRID,
  svg: await phosphorSvg(name, fill),
  palette: [OUTLINE, fill],
});

for (const system of SYSTEMS) {
  if (FILL[system.id] || !SYSTEM_ICON[system.id]) continue;
  jobs.push(
    await iconJob(system.id, SYSTEM_ICON[system.id], areaColor(system.domain)),
  );
}
for (const [id, [name, fill]] of Object.entries(CAUSE_ICON))
  jobs.push(await iconJob(id, name, fill));
for (const [i, name] of ICON_IDS.entries())
  jobs.push(await iconJob(`i-${name}`, name, PASTELS[i % PASTELS.length]));

const browser = await chromium.launch();
const page = await browser.newPage();
await mkdir(OUT, { recursive: true });

for (const job of jobs) {
  const dataUrl = await page.evaluate(async ({ svg, w, h, palette }) => {
    const toRgb = (hex) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const colors = palette.map(toRgb);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 120) {
        d[i + 3] = 0;
        continue;
      }
      let best = 0,
        bestDist = Infinity;
      colors.forEach((c, k) => {
        const dist =
          (c[0] - d[i]) ** 2 + (c[1] - d[i + 1]) ** 2 + (c[2] - d[i + 2]) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = k;
        }
      });
      [d[i], d[i + 1], d[i + 2]] = colors[best];
      d[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }, job);
  await writeFile(
    new URL(`${job.id}.png`, OUT),
    Buffer.from(dataUrl.split(",")[1], "base64"),
  );
}

const CURSORS = {
  cursor: [
    "K...........",
    "KK..........",
    "KWK.........",
    "KWWK........",
    "KWWWK.......",
    "KWWWWK......",
    "KWWWWWK.....",
    "KWWWWWWK....",
    "KWWWWWWWK...",
    "KWWWWWKKKK..",
    "KWWKWWK.....",
    "KWK.KWWK....",
    "KK..KWWK....",
    "K....KWWK...",
    ".....KWWK...",
    "......KK....",
  ],
  "cursor-pointer": [
    "....KK......",
    "...KWWK.....",
    "...KWWK.....",
    "...KWWK.....",
    "...KWWKKK...",
    "...KWWKWWKK.",
    ".KKKWWKWWKWK",
    "KWWKWWWWWWWK",
    "KWWWKWWWWWWK",
    ".KWWWWWWWWWK",
    "..KWWWWWWWWK",
    "..KWWWWWWWK.",
    "...KWWWWWWK.",
    "...KWWWWWK..",
    "....KKKKKK..",
  ],
};
for (const [name, rows] of Object.entries(CURSORS)) {
  const url = await page.evaluate(
    ({ rows, outline, paper }) => {
      const px = 2;
      const c = document.createElement("canvas");
      c.width = 16 * px;
      c.height = 16 * px;
      const ctx = c.getContext("2d");
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === ".") return;
          ctx.fillStyle = ch === "K" ? outline : paper;
          ctx.fillRect(x * px, y * px, px, px);
        }),
      );
      return c.toDataURL("image/png");
    },
    { rows, outline: OUTLINE, paper: PAPER },
  );
  await writeFile(
    new URL(`../${name}.png`, OUT),
    Buffer.from(url.split(",")[1], "base64"),
  );
}
await browser.close();
console.log(
  `wrote ${jobs.length} sprites and ${Object.keys(CURSORS).length} cursors`,
);
