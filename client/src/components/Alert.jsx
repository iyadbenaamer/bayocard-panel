const TONE_CLASSES = {
  error: "border-rose-200 bg-rose-50 text-rose-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

// Shared inline banner for form/page-level error, success, warning and info
// messages, replacing the ad-hoc "rounded-xl border ... bg ... text ..."
// strings that used to be redeclared on every page.
const Alert = ({ tone = "error", className = "", children }) => {
  if (!children) return null;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${TONE_CLASSES[tone] || TONE_CLASSES.error} ${className}`}
    >
      {children}
    </div>
  );
};

export default Alert;
