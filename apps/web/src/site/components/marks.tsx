/**
 * Brand mark and hero figure for the public site. Same geometry as the approved design-preview BrandMark and
 * MarketingHome BridgeFigure (BRAND_DIRECTION_V1: line-drawn bridge, two anchors, one arc), redrawn here so
 * production does not import `ui/AppShell` (which carries the preview's route table).
 */

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M4 24h24" />
      <path d="M8 24V14M24 24V14" />
      <path d="M6 16c4-8 16-8 20 0" />
      <circle cx="16" cy="9" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Thin-line bridge: two piers, one arc drawn once on load, cable verticals, the two ends named. */
export function BridgeFigure() {
  return (
    <svg
      viewBox="0 0 640 300"
      className="h-auto w-full max-w-xl"
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
    >
      <path d="M20 230h600" strokeOpacity={0.4} />
      <path d="M120 230V128M520 230V128" className="fbg-rise fbg-rise-2" />
      <path
        d="M60 200c90-130 430-130 520 0"
        pathLength={1}
        className="fbg-draw"
        strokeWidth={1.6}
      />
      {Array.from({ length: 11 }).map((_, i) => {
        const x = 120 + i * 40;
        const t = (x - 320) / 260;
        const y = 200 - 65 * (1 - t * t);
        return (
          <path key={x} d={`M${x} ${y}V230`} strokeOpacity={0.4} className="fbg-rise fbg-rise-3" />
        );
      })}
      <circle cx="320" cy="135" r="3" fill="currentColor" stroke="none" />
      <path d="M20 256h600" strokeOpacity={0.12} />
      <text
        x="120"
        y="284"
        textAnchor="middle"
        fontSize="12"
        fill="currentColor"
        fillOpacity={0.75}
        stroke="none"
        className="fbg-rise fbg-rise-3"
      >
        U.S. buyer
      </text>
      <text
        x="520"
        y="284"
        textAnchor="middle"
        fontSize="12"
        fill="currentColor"
        fillOpacity={0.75}
        stroke="none"
        className="fbg-rise fbg-rise-3"
      >
        Factory
      </text>
    </svg>
  );
}
