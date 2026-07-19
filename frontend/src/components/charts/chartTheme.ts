// Shared chart color language. Reads the CSS variables defined in index.css so charts
// stay consistent with the rest of the UI (and any future theme change). Recharts wants
// concrete color strings, so we wrap each token in hsl().
const hsl = (v: string) => `hsl(${v})`;

export const CHART = {
  add: hsl('var(--chart-add)'),
  deduct: hsl('var(--chart-deduct)'),
  discard: hsl('var(--chart-discard)'),
  grid: 'hsl(var(--chart-grid))',
  axis: 'hsl(var(--chart-axis))',
  categorical: [
    hsl('var(--chart-1)'),
    hsl('var(--chart-2)'),
    hsl('var(--chart-3)'),
    hsl('var(--chart-4)'),
    hsl('var(--chart-5)'),
    hsl('var(--chart-6)'),
  ],
} as const;

// Semantic colours for the request statuses.
// NOTE: these point at the SEVERITY tokens, not the categorical ramp. The ramp is
// ordered for visual distinction and its hues moved when the palette changed to
// Paint Chip (chart-1 went blue -> red), which would silently have turned
// "Partial" red and "Rejected" indistinguishable from it. Binding status to the
// severity language keeps the meaning stable no matter how the ramp is retuned.
export const STATUS_COLOR: Record<string, string> = {
  PENDING: hsl('var(--warning)'), // amber — awaiting action
  IN_PROGRESS: hsl('var(--brand-violet)'), // violet — partially actioned
  APPROVED: hsl('var(--healthy)'), // green — done
  PARTIAL: hsl('var(--info)'), // blue — partially fulfilled, not an alarm
  REJECTED: hsl('var(--critical)'), // red — refused
};

// Departments are categorical, not semantic — any three distinct hues work, so
// these track the ramp. Chosen to stay distinguishable from the status colours.
export const DEPT_COLOR: Record<string, string> = {
  PU: hsl('var(--chart-1)'), // logo red
  ENAMEL: hsl('var(--chart-3)'), // logo violet
  POWDER: hsl('var(--chart-5)'), // blue
};
