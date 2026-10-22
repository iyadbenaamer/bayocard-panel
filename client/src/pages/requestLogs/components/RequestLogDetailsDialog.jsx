import RedBtn from "components/RedBtn";
import Badge from "components/Badge";

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
};

const ACTION_TYPE_LABELS = {
  login: "تسجيل دخول",
  signup: "تسجيل حساب",
  verification_code: "رمز التحقق",
  password_change: "تغيير كلمة المرور",
  checkout: "عملية شراء",
};

const AUTH_METHOD_LABELS = {
  session: "جلسة تطبيق",
  api_key: "مفتاح API",
};

const DetailRow = ({ label, value, dir }) => (
  <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
    <span className="text-xs text-slate-600">{label}</span>
    <span className="text-sm font-medium text-slate-800" dir={dir}>
      {value || "—"}
    </span>
  </div>
);

const RequestLogDetailsDialog = ({ log, onClose }) => {
  const location = [log?.location?.city, log?.location?.country]
    .filter(Boolean)
    .join(", ");
  const device = [log?.device?.platform, log?.device?.deviceName]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="min-w-[22rem] max-w-lg p-4 text-right" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            تفاصيل السجل
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {ACTION_TYPE_LABELS[log?.actionType] || log?.actionType || "—"}
          </p>
        </div>
        <Badge tone={log?.status === "success" ? "success" : "danger"}>
          {log?.status === "success" ? "نجاح" : "فشل"}
        </Badge>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <DetailRow
          label="المستخدم"
          value={
            log?.user
              ? `${log.user.name || "—"}${
                  log.user.phone ? ` (${log.user.phone})` : ""
                }`
              : log?.name || log?.phone
                ? `${log.name || "—"}${log.phone ? ` (${log.phone})` : ""} — غير مسجل`
                : "—"
          }
        />
        <DetailRow label="رمز النتيجة" value={log?.resultCode} dir="ltr" />
        <DetailRow
          label="المحاولات المتبقية"
          value={
            log?.remainingAttempts != null
              ? String(log.remainingAttempts)
              : undefined
          }
        />
        <DetailRow
          label="طريقة الدخول"
          value={AUTH_METHOD_LABELS[log?.authMethod]}
        />
        <DetailRow
          label="الطلب"
          value={log ? `${log.method} ${log.path}` : ""}
          dir="ltr"
        />
        <DetailRow label="عنوان IP" value={log?.ip} dir="ltr" />
        <DetailRow label="الموقع" value={location} />
        <DetailRow label="المنطقة الزمنية" value={log?.timeZone} dir="ltr" />
        <DetailRow label="الجهاز" value={device} />
        <DetailRow label="معرّف الجهاز" value={log?.device?.deviceId} dir="ltr" />
        <DetailRow label="التاريخ" value={formatDateTime(log?.createdAt)} />
      </div>

      <div className="mt-4 flex items-center justify-end">
        <RedBtn onClick={onClose}>إغلاق</RedBtn>
      </div>
    </div>
  );
};

export default RequestLogDetailsDialog;
