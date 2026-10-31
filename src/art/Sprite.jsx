const urls = import.meta.glob("../assets/sprites/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});
const SRC = Object.fromEntries(
  Object.entries(urls).map(([path, url]) => [
    path.split("/").pop().replace(".png", ""),
    url,
  ]),
);

// Native pixel sizes. Everything else is a 40x40 grid.
const SIZE = {
  crowd: [112, 44],
  "arrow-curl": [40, 40],
  "arrow-down": [32, 40],
  "arrow-right": [40, 28],
};

/** A pixel-art doodle, scaled by whole pixels so every edge stays crisp. */
export function Sprite({ id, scale = 2, className = "", alt = "" }) {
  const [w, h] = SIZE[id] ?? [40, 40];
  return (
    <img
      src={SRC[id] ?? SRC.sparkle}
      width={w * scale}
      height={h * scale}
      alt={alt}
      draggable={false}
      className={`sprite sprite-${id} ${className}`}
    />
  );
}
