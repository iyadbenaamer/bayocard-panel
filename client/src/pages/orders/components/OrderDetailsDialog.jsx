import RedBtn from "components/RedBtn";

const getDisplayName = (name) => name?.ar || name?.en || "";

const formatAmount = (value) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return amount.toLocaleString("ar-LY", {
    style: "currency",
    currency: "LYD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const resolveProviderLabel = (provider) => {
  switch (provider) {
    case "local":
      return "محلي";
    case "bamboo":
      return "بامبو";
    default:
      return "مختلط";
  }
};

const OrderDetailsDialog = ({ order, onClose }) => {
  const items = Array.isArray(order?.items) ? order.items : [];

  return (
    <div className="min-w-[22rem] max-w-3xl p-4 text-right" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">تفاصيل الطلب</h2>
          <p className="mt-1 text-sm text-slate-600">
            رقم الطلب: {order?._id || "—"}
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {formatDateTime(order?.createdAt)}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs text-slate-600">المستخدم</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">
            {order?.user?.name || "—"}
          </div>
          <div className="mt-1 text-xs text-slate-600" dir="ltr">
            {order?.user?.phone || ""}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs text-slate-600">الإجمالي</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">
            {formatAmount(order?.totalAmount)}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-700">العناصر</h3>
          <span className="text-xs text-slate-600">{items.length} عنصر</span>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 text-sm text-slate-600">
            لا توجد عناصر لعرضها.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div
                key={`${item?._id || item?.title || index}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {getDisplayName(item?.tierId?.typeId?.name)
                        ? `${getDisplayName(item.tierId.typeId.name)} - `
                        : ""}
                      {getDisplayName(item?.title) || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      الكمية: {item?.quantity ?? 0}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {formatAmount(item?.price)}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                    المصدر: {resolveProviderLabel(item?.provider)}
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                    المجموع:{" "}
                    {formatAmount(
                      (Number(item?.price) || 0) *
                        (Number(item?.quantity) || 0),
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end">
        <RedBtn onClick={onClose}>إغلاق</RedBtn>
      </div>
    </div>
  );
};

export default OrderDetailsDialog;
