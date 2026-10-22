// text-*-800 on bg-*-100 keeps every tone at ~6.5:1+ contrast (WCAG AA),
// vs. the ~4.5-5:1 that text-*-700 gives on the same background.
const TONE_CLASSES = {
  success: "bg-emerald-100 text-emerald-800",
  danger: "bg-rose-100 text-rose-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-sky-100 text-sky-800",
  violet: "bg-violet-100 text-violet-800",
  neutral: "bg-slate-100 text-slate-800",
};

// Shared status/category pill. Pass `tone` for the standard semantic colors,
// or `className` to keep a page-specific color map (e.g. per-provider colors)
// while still getting consistent padding/shape/typography.
const Badge = ({ tone = "neutral", className = "", children }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
      className || TONE_CLASSES[tone] || TONE_CLASSES.neutral
    }`}
  >
    {children}
  </span>
);

export default Badge;
