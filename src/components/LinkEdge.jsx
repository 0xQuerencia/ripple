import { memo } from "react";

/** A gently bowed link. When active, ink draws itself from source to target and an arrow shows direction. */
function LinkEdgeBase({ sourceX, sourceY, targetX, targetY, data }) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy) || 1;
  const bend = length * 0.1;
  const cx = (sourceX + targetX) / 2 - (dy / length) * bend;
  const cy = (sourceY + targetY) / 2 + (dx / length) * bend;
  const path = `M${sourceX} ${sourceY}Q${cx} ${cy} ${targetX} ${targetY}`;

  const t = 0.58;
  const ax = (1 - t) ** 2 * sourceX + 2 * (1 - t) * t * cx + t * t * targetX;
  const ay = (1 - t) ** 2 * sourceY + 2 * (1 - t) * t * cy + t * t * targetY;
  const angle =
    (Math.atan2(
      2 * (1 - t) * (cy - sourceY) + 2 * t * (targetY - cy),
      2 * (1 - t) * (cx - sourceX) + 2 * t * (targetX - cx),
    ) *
      180) /
    Math.PI;
  const state = data?.state ?? "quiet";
  const lit = state === "active" || state === "path";

  return (
    <g className={`link link-${state}`}>
      <path className="link-base" d={path} />
      {lit && <path className="link-ink" d={path} pathLength="1" />}
      <path
        className="link-arrow"
        d="M-6 -5L5 0L-6 5"
        transform={`translate(${ax} ${ay}) rotate(${angle})`}
      />
    </g>
  );
}

export const LinkEdge = memo(LinkEdgeBase);
