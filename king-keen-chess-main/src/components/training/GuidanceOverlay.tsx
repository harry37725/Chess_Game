// SVG guidance overlay placed above the chessboard. pointer-events: none.
type Square = string;
export type Arrow = { from: Square; to: Square; color?: string };
export type Highlight = { square: Square; color?: string };

function fileRank(sq: Square, orientation: "white" | "black") {
  const file = sq.charCodeAt(0) - 97; // a=0..h=7
  const rank = parseInt(sq[1], 10) - 1; // 1=0..8=7
  const x = orientation === "white" ? file : 7 - file;
  const y = orientation === "white" ? 7 - rank : rank;
  // center percent
  return { cx: x * 12.5 + 6.25, cy: y * 12.5 + 6.25, x: x * 12.5, y: y * 12.5 };
}

export function GuidanceOverlay({
  arrows = [],
  highlights = [],
  spotlight,
  visible = true,
  orientation = "white",
}: {
  arrows?: Arrow[];
  highlights?: Highlight[];
  spotlight?: Square;
  visible?: boolean;
  orientation?: "white" | "black";
}) {
  if (!visible) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-3 sm:inset-4 z-20"
      style={{ width: "calc(100% - 1.5rem)", height: "calc(100% - 1.5rem)" }}
    >
      <defs>
        {["#22c55e", "#f97316", "#3b82f6"].map((c) => (
          <marker key={c} id={`arrow-${c.slice(1)}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={c} />
          </marker>
        ))}
      </defs>

      {spotlight && (() => {
        const { x, y } = fileRank(spotlight, orientation);
        return (
          <>
            <mask id="spot">
              <rect x="0" y="0" width="100" height="100" fill="white" />
              <rect x={x} y={y} width="12.5" height="12.5" fill="black" rx="2" />
            </mask>
            <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.45)" mask="url(#spot)">
              <animate attributeName="fill-opacity" values="0.5;0.25;0.5" dur="2s" repeatCount="indefinite" />
            </rect>
          </>
        );
      })()}

      {highlights.map((h, i) => {
        const { x, y } = fileRank(h.square, orientation);
        const c = h.color ?? "#22c55e";
        return (
          <rect
            key={i} x={x + 0.5} y={y + 0.5} width="11.5" height="11.5" rx="1.5"
            fill={c} fillOpacity="0.35" stroke={c} strokeWidth="0.4"
          >
            <animate attributeName="fill-opacity" values="0.45;0.15;0.45" dur="1.6s" repeatCount="indefinite" />
          </rect>
        );
      })}

      {arrows.map((a, i) => {
        const f = fileRank(a.from, orientation);
        const t = fileRank(a.to, orientation);
        const c = a.color ?? "#22c55e";
        return (
          <line
            key={i} x1={f.cx} y1={f.cy} x2={t.cx} y2={t.cy}
            stroke={c} strokeWidth="1.6" strokeLinecap="round"
            markerEnd={`url(#arrow-${c.slice(1)})`}
            opacity="0.85"
          >
            <animate attributeName="stroke-width" values="1.4;2.2;1.4" dur="1.4s" repeatCount="indefinite" />
          </line>
        );
      })}
    </svg>
  );
}
