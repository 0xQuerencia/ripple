// Hand-authored glyphs on a 48x48 grid. `fill` shapes are printed in a spot ink (slightly misregistered),
// `ink` shapes are the line work on top. An ink entry may be { d, solid: true } to hide what is behind it.
const circle = (cx, cy, r) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const leaf = (y, side) =>
  `M24 ${y}c${7 * side} 0 ${10 * side}-4 ${10 * side}-9c${-7 * side} 0 ${-10 * side} 4 ${-10 * side} 9z`;

const BOLT = "M27 4L11 27H23L19 44L37 20H25Z";
const CANOPY =
  "M24 5C15 5 9 13 14 21C8 25 12 34 21 33H27C36 34 40 25 34 21C39 13 33 5 24 5Z";
const DROP = "M24 5C24 5 11 20 11 30a13 13 0 0 0 26 0C37 20 24 5 24 5Z";
const FLAME =
  "M24 4C26 14 38 18 38 31a14 14 0 0 1-28 0C10 24 15 21 17 15C19 19 21 20 22 20C22 14 22 9 24 4Z";
const BULB =
  "M24 5a13 13 0 0 0-7 24c1.5 1.5 2 3 2 5h10c0-2 .5-3.5 2-5A13 13 0 0 0 24 5Z";
const CLOUD = "M12 36C4 36 4 24 13 24C14 14 30 13 33 23C43 22 45 36 36 36Z";
const WING_UL = "M24 22C14 2 3 8 7 20C9 26 18 26 24 22Z";
const WING_LL = "M24 24C16 26 10 34 14 40C19 44 24 34 24 24Z";
const WING_UR = "M24 22C34 2 45 8 41 20C39 26 30 26 24 22Z";
const WING_LR = "M24 24C32 26 38 34 34 40C29 44 24 34 24 24Z";

export const GLYPHS = {
  // systems
  climate: {
    fill: [circle(20, 17, 8)],
    ink: [
      circle(20, 17, 8),
      "M20 3v3M8 8l2.2 2.2M32 8l-2.2 2.2M4 17h3",
      {
        d: "M13 41C6 41 6 30 14 30C15 22 28 21 30 29C38 28 41 41 33 41Z",
        solid: true,
      },
    ],
  },
  power: { fill: [BOLT], ink: [BOLT] },
  nature: { fill: [CANOPY], ink: [CANOPY, "M24 33v11M24 39l5-4"] },
  water: { fill: [DROP], ink: [DROP, "M18 31a6 6 0 0 0 5 5"] },
  transport: {
    fill: ["M7 12h34a2 2 0 0 1 2 2v20H5V14a2 2 0 0 1 2-2Z"],
    ink: [
      "M7 12h34a2 2 0 0 1 2 2v20H5V14a2 2 0 0 1 2-2Z",
      "M9 17h10v8H9zM22 17h10v8H22zM35 17h4v8h-4z",
      "M5 29h38",
      { d: circle(14, 36, 4), solid: true },
      { d: circle(34, 36, 4), solid: true },
    ],
  },
  farming: {
    fill: [
      leaf(16, -1),
      leaf(16, 1),
      leaf(26, -1),
      leaf(26, 1),
      leaf(36, -1),
      leaf(36, 1),
      "M24 12c-3-3-3-7 0-9c3 2 3 6 0 9z",
    ],
    ink: [
      "M24 44V12",
      leaf(16, -1),
      leaf(16, 1),
      leaf(26, -1),
      leaf(26, 1),
      leaf(36, -1),
      leaf(36, 1),
      "M24 12c-3-3-3-7 0-9c3 2 3 6 0 9z",
    ],
  },
  industry: {
    fill: ["M6 42V20l9-6v6l9-6v6l9-6V42Z"],
    ink: [
      "M6 42V20l9-6v6l9-6v6l9-6V42Z",
      "M34 42V10h7v32",
      "M11 31h4M19 31h4M27 31h4",
      "M37.5 6c-2-2 2-3 0-5",
    ],
  },
  health: {
    fill: ["M19 7h10v12h12v10H29v12H19V29H7V19h12Z"],
    ink: ["M19 7h10v12h12v10H29v12H19V29H7V19h12Z"],
  },
  communications: {
    fill: [circle(24, 16, 3)],
    ink: [
      circle(24, 16, 3),
      "M24 19v25M24 19L15 44M24 19L33 44M18.5 35h11M21 27h6",
      "M18 10a9 9 0 0 0 0 12M30 10a9 9 0 0 1 0 12M13 6a15 15 0 0 0 0 20M35 6a15 15 0 0 1 0 20",
    ],
  },
  economy: {
    fill: ["M8 14a16 6 0 1 0 32 0a16 6 0 1 0-32 0M8 14v24a16 6 0 0 0 32 0V14"],
    ink: [
      "M8 14a16 6 0 1 0 32 0a16 6 0 1 0-32 0",
      "M8 14v24a16 6 0 0 0 32 0V14",
      "M8 22a16 6 0 0 0 32 0M8 30a16 6 0 0 0 32 0",
      "M20 14h8",
    ],
  },
  education: {
    fill: ["M24 8L43 18L24 28L5 18Z"],
    ink: [
      "M24 8L43 18L24 28L5 18Z",
      "M12 23v9c0 4 24 4 24 0v-9",
      "M40 20v14",
      circle(40, 36, 2),
    ],
  },
  people: {
    fill: [circle(17, 15, 6), "M5 41c0-9 6-14 12-14s12 5 12 14Z"],
    ink: [
      circle(17, 15, 6),
      "M5 41c0-9 6-14 12-14s12 5 12 14Z",
      "M33 12a5 5 0 1 1 0 10",
      "M30 30c8-3 15 2 15 11H33",
    ],
  },
  // causes
  blackout: {
    fill: ["M11 16H37V24A13 13 0 0 1 11 24Z"],
    ink: [
      "M11 16H37V24A13 13 0 0 1 11 24Z",
      "M17 5V16M31 5V16",
      "M24 37c0 6-8 4-8 9",
      "M39 5l-3 5h4l-3 5",
    ],
  },
  drought: {
    fill: [circle(24, 15, 8)],
    ink: [
      circle(24, 15, 8),
      "M24 1v3M10 8l2 2M38 8l-2 2M6 15h3M39 15h3",
      "M4 32H44",
      "M10 32l4 6-3 6M23 32l-4 5 5 4-2 5M35 32l3 6-4 5",
    ],
  },
  wildfire: {
    fill: [FLAME],
    ink: [
      FLAME,
      "M24 42a6 6 0 0 1-6-6c0-5 6-6 6-12c0 6 6 7 6 12a6 6 0 0 1-6 6Z",
    ],
  },
  strike: {
    fill: ["M24 5L35 38H13Z"],
    ink: ["M24 5L35 38H13Z", "M8 38H40V43H8Z", "M20 19h8M17 28h14"],
  },
  discovery: {
    fill: [BULB],
    ink: [BULB, "M19 38h10M20 42h8", "M20 21l4 5 4-5", "M6 12l4 3M42 12l-4 3"],
  },
  signal: {
    fill: [circle(24, 40, 3)],
    ink: [
      "M6 20a26 26 0 0 1 36 0M12 27a17 17 0 0 1 24 0M18 34a8 8 0 0 1 12 0",
      circle(24, 40, 3),
      "M8 6L40 44",
    ],
  },
  // decoration and brand
  butterfly: {
    fill: [WING_UL, WING_UR, WING_LL, WING_LR],
    ink: [
      WING_UL,
      WING_UR,
      WING_LL,
      WING_LR,
      "M24 15V38",
      "M24 15c-1-5-4-7-6-8M24 15c1-5 4-7 6-8",
    ],
  },
  sparkle: {
    fill: [],
    ink: [
      "M24 4C25 16 32 23 44 24C32 25 25 32 24 44C23 32 16 25 4 24C16 23 23 16 24 4Z",
    ],
  },
  flower: {
    fill: [
      circle(24, 8, 6),
      circle(31.6, 13.5, 6),
      circle(28.7, 22.5, 6),
      circle(19.3, 22.5, 6),
      circle(16.4, 13.5, 6),
    ],
    ink: [
      circle(24, 8, 6),
      circle(31.6, 13.5, 6),
      circle(28.7, 22.5, 6),
      circle(19.3, 22.5, 6),
      circle(16.4, 13.5, 6),
      { d: circle(24, 16, 4), solid: true },
      "M24 29V46M24 39q6-4 9-2",
    ],
  },
  cloud: { fill: [CLOUD], ink: [CLOUD] },
};
