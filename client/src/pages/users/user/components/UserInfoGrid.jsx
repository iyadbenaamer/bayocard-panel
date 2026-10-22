import Badge from "components/Badge";

const UserInfoGrid = ({ infoItems }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    {infoItems.map((item) => (
      <div
        key={item.label}
        className="rounded-2xl border border-slate-200 bg-white/80 p-4"
      >
        <div className="text-xs text-slate-600">{item.label}</div>
        <div
          className={`mt-2 text-sm text-slate-800 ${
            item.subtle ? "break-all text-xs text-slate-600" : ""
          }`}
        >
          {item.badge ? (
            <Badge
              tone={
                item.badgeVariant === "role"
                  ? item.value === "فردي"
                    ? "info"
                    : "warning"
                  : item.value === "نعم" ||
                      item.value === "مفعّل" ||
                      item.value === "تم التحقق"
                    ? "success"
                    : "danger"
              }
            >
              {item.value}
            </Badge>
          ) : (
            item.value
          )}
        </div>
      </div>
    ))}
  </div>
);

export default UserInfoGrid;
