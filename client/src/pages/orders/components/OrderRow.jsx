import { Link } from "react-router-dom";

import Badge from "components/Badge";

const resolveProvider = (items) => {
  if (!Array.isArray(items) || items.length === 0) return "mixed";
  const providers = new Set(
    items.map((item) => item?.provider).filter(Boolean),
  );
  if (providers.size === 1) {
    return providers.values().next().value || "mixed";
  }
  return "mixed";
};

const providerLabels = {
  local: "محلي",
  bamboo: "بامبو",
  mixed: "مختلط",
};

const providerStyles = {
  local: "bg-emerald-100 text-emerald-800",
  bamboo: "bg-amber-100 text-amber-800",
  mixed: "bg-slate-100 text-slate-700",
};

const formatOrderId = (value) => {
  if (!value) return "—";
  const raw = String(value);
  return raw.length > 8 ? raw.slice(-8) : raw;
};

const getDisplayName = (name) => name?.ar || name?.en || "";

const describeItem = (item) => {
  const typeName = getDisplayName(item?.tierId?.typeId?.name);
  const tierName = getDisplayName(item?.title);
  if (typeName && tierName) return `${typeName} - ${tierName}`;
  return typeName || tierName || "عنصر";
};

const summarizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) return "—";
  const totalQuantity = items.reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0,
  );
  const firstTitle = describeItem(items[0]);
  if (items.length === 1) {
    return `${firstTitle} (${totalQuantity})`;
  }
  const restCount = items.length - 1;
  return `${firstTitle} + ${restCount} عناصر`;
};

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

const OrderRow = ({
  order,
  index,
  page,
  itemsPerPage,
  isSelected,
  onToggleSelect,
  onOpen,
}) => {
  const userName = order?.user?.name || "—";
  const userPhone = order?.user?.phone || "";
  const providerKey = resolveProvider(order.items);
  const providerLabel = providerLabels[providerKey] || "مختلط";
  const providerClass = providerStyles[providerKey] || providerStyles.mixed;

  return (
    <tr
      className={`${
        isSelected ? "bg-slate-50" : ""
      } cursor-pointer transition hover:bg-slate-50`}
      onClick={() => onOpen(order)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(order);
        }
      }}
    >
      <td onClick={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(order._id)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
        />
      </td>
      <td className="text-center" data-label="ت">
        {index + 1 + (page - 1) * itemsPerPage}
      </td>
      <td data-label="رقم الطلب">
        <span title={order._id}>{formatOrderId(order._id)}</span>
      </td>
      <td data-label="المستخدم" onClick={(event) => event.stopPropagation()}>
        {order.userId ? (
          <Link
            to={`/users/${order.userId}`}
            className="text-slate-700 hover:text-primary"
          >
            <div className="font-semibold">{userName}</div>
            {userPhone && (
              <div className="text-xs text-slate-600">{userPhone}</div>
            )}
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td data-label="العناصر">{summarizeItems(order.items)}</td>
      <td data-label="المصدر">
        <Badge className={providerClass}>{providerLabel}</Badge>
      </td>
      <td data-label="الإجمالي">{formatAmount(order.totalAmount)}</td>
      <td data-label="التاريخ">{formatDateTime(order.createdAt)}</td>
    </tr>
  );
};

export default OrderRow;
