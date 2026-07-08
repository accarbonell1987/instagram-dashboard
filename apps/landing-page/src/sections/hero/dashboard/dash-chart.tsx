export function DashChart() {
  return (
    <svg
      viewBox="0 0 400 110"
      preserveAspectRatio="none"
      className="w-full h-[110px]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a6ec4" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#1a6ec4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill under the blue line */}
      <path
        d="M0,80 L30,72 L60,76 L90,60 L120,55 L150,48 L180,52 L210,40 L240,35 L270,28 L300,32 L330,22 L360,18 L400,12 L400,110 L0,110 Z"
        fill="url(#chart-gradient)"
      />

      {/* Blue solid line */}
      <path
        d="M0,80 L30,72 L60,76 L90,60 L120,55 L150,48 L180,52 L210,40 L240,35 L270,28 L300,32 L330,22 L360,18 L400,12"
        fill="none"
        stroke="#93c5fd"
        strokeWidth="1.5"
      />

      {/* Accent dashed line */}
      <path
        d="M0,92 L30,88 L60,90 L90,82 L120,80 L150,76 L180,78 L210,70 L240,66 L270,62 L300,64 L330,58 L360,54 L400,50"
        fill="none"
        stroke="#F77737"
        strokeWidth="1.5"
        strokeDasharray="2 2"
        opacity="0.8"
      />

      {/* Circle endpoints */}
      <circle cx="400" cy="12" r="3" fill="#93c5fd" />
      <circle cx="400" cy="50" r="3" fill="#F77737" />
    </svg>
  );
}
