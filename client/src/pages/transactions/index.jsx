import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Layout from "layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components/Table";
import RedBtn from "components/RedBtn";
import FilterBar from "components/FilterBar";
import Badge from "components/Badge";
import { useDialog } from "components/dialog/DialogContext";
import OrderDetailsDialog from "pages/orders/components/OrderDetailsDialog";

import axiosClient from "utils/AxiosClient";
import useQueryParamsState from "hooks/useQueryParamsState";

const TRANSACTIONS_PER_PAGE = 10;

const INITIAL_FILTERS = {
  userQuery: "",
  type: "",
  minAmount: "",
  maxAmount: "",
  startDate: "",
  endDate: "",
};

const TRANSACTION_QUERY_DEFAULTS = {
  page: 1,
  sortBy: "createdAt",
  sortOrder: "desc",
  role: "business",
  ...INITIAL_FILTERS,
};

const TRANSACTION_FILTER_FIELDS = [
  {
    key: "userQuery",
    type: "text",
    label: "المستخدم",
    placeholder: "ابحث بالاسم أو الهاتف",
    colSpan: 2,
  },
  {
    key: "type",
    type: "select",
    label: "النوع",
    options: [
      { value: "", label: "الكل" },
      { value: "deposit", label: "إيداع" },
      { value: "purchase", label: "شراء" },
      { value: "refund", label: "استرداد" },
    ],
  },
  { key: "minAmount", type: "number", label: "أقل مبلغ", placeholder: "0" },
  { key: "maxAmount", type: "number", label: "أقصى مبلغ", placeholder: "0" },
  { key: "startDate", type: "date", label: "من تاريخ" },
  { key: "endDate", type: "date", label: "إلى تاريخ" },
];

const TRANSACTION_SORT_OPTIONS = [
  { value: "createdAt:desc", label: "الأحدث" },
  { value: "createdAt:asc", label: "الأقدم" },
  { value: "amount:desc", label: "الأعلى قيمة" },
  { value: "amount:asc", label: "الأقل قيمة" },
];

const ROLE_TABS = [
  { key: "business", label: "تجاري" },
  { key: "individual", label: "فردي" },
];

const Transactions = () => {
  const [queryState, updateQueryState] = useQueryParamsState(
    TRANSACTION_QUERY_DEFAULTS,
  );
  const { page, sortBy, sortOrder, role: roleTab } = queryState;
  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(INITIAL_FILTERS).map((key) => [key, queryState[key]]),
      ),
    [
      queryState.userQuery,
      queryState.type,
      queryState.minAmount,
      queryState.maxAmount,
      queryState.startDate,
      queryState.endDate,
    ],
  );
  const setPage = useCallback(
    (nextPage) => updateQueryState({ page: nextPage }),
    [updateQueryState],
  );
  const [transactions, setTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState("");
  const [error, setError] = useState("");
  const [reloadFlag, setReloadFlag] = useState(0);

  const { openDialog, closeDialog } = useDialog();

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const typeLabels = {
    deposit: "إيداع",
    purchase: "شراء",
    refund: "استرداد",
    gateway_deposit: "إيداع بوابة دفع",
    exchange_sent: "تحويل صادر",
    exchange_received: "تحويل وارد",
  };

  const typeStyles = {
    deposit: "bg-emerald-100 text-emerald-800",
    purchase: "bg-sky-100 text-sky-800",
    refund: "bg-rose-100 text-rose-700",
    gateway_deposit: "bg-teal-100 text-teal-800",
    exchange_sent: "bg-amber-100 text-amber-800",
    exchange_received: "bg-indigo-100 text-indigo-800",
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

  const formatShortId = (value) => {
    if (!value) return "—";
    const raw = String(value);
    return raw.length > 8 ? raw.slice(-8) : raw;
  };

  const resolveOrderId = (transaction) => {
    if (!transaction) return "";

    if (typeof transaction.orderId === "object" && transaction.orderId?._id) {
      return String(transaction.orderId._id);
    }

    if (transaction.orderId) {
      return String(transaction.orderId);
    }

    if (typeof transaction.order === "object" && transaction.order?._id) {
      return String(transaction.order._id);
    }

    return transaction.order ? String(transaction.order) : "";
  };

  const buildParams = () => {
    const params = {
      page,
      limit: TRANSACTIONS_PER_PAGE,
      sortBy,
      sortOrder,
      role: roleTab,
    };

    if (filters.userQuery) params.userQuery = filters.userQuery.trim();
    if (filters.type) params.type = filters.type;
    if (filters.minAmount) params.minAmount = filters.minAmount;
    if (filters.maxAmount) params.maxAmount = filters.maxAmount;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;

    return params;
  };

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/transactions", {
        params: buildParams(),
      });
      const payload = response.data ?? {};
      setTransactions(
        Array.isArray(payload.transactions) ? payload.transactions : [],
      );
      setTotalTransactions(payload.pagination?.total ?? 0);
      setTotalPages(payload.pagination?.totalPages ?? 1);
    } catch (err) {
      setError("تعذر تحميل المعاملات. حاول مرة أخرى.");
      setTransactions([]);
      setTotalTransactions(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortOrder, roleTab, filters, reloadFlag]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, sortBy, sortOrder, roleTab, filters]);

  const handleApplyFilters = (event) => {
    event?.preventDefault?.();
    updateQueryState({
      ...draftFilters,
      page: 1,
      ...Object.fromEntries(
        Object.keys(draftFilters).map((key) => [`draft_${key}`, null]),
      ),
    });
  };

  const handleClearFilters = (draftKeys = []) => {
    setDraftFilters(INITIAL_FILTERS);
    updateQueryState({
      ...INITIAL_FILTERS,
      page: 1,
      ...Object.fromEntries(draftKeys.map((key) => [`draft_${key}`, null])),
    });
  };

  const handleSortChange = (event) => {
    const [field, direction] = event.target.value.split(":");
    updateQueryState({
      sortBy: field || "createdAt",
      sortOrder: direction || "desc",
      page: 1,
    });
  };

  const handleRoleTabSelect = (tabKey) => {
    updateQueryState({ role: tabKey, page: 1 });
  };

  const handleOpenOrder = async (transaction) => {
    const orderId = resolveOrderId(transaction);
    if (!orderId) return;

    setLoadingOrderId(transaction._id);
    try {
      const response = await axiosClient.get("/orders/one", {
        params: { id: orderId },
      });
      const order = response.data ?? null;

      if (!order?._id) {
        throw new Error("ORDER_NOT_FOUND");
      }

      openDialog(<OrderDetailsDialog order={order} onClose={closeDialog} />);
    } catch (err) {
      openDialog(
        <div className="min-w-70 p-4 text-right" dir="rtl">
          <h2 className="text-base font-semibold text-slate-800">
            تعذر تحميل الطلب
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            لم نتمكن من جلب تفاصيل الطلب المرتبط بهذه المعاملة.
          </p>
          <div className="mt-4 flex items-center justify-end">
            <RedBtn onClick={closeDialog}>إغلاق</RedBtn>
          </div>
        </div>,
      );
    } finally {
      setLoadingOrderId("");
    }
  };

  const transactionIdsOnPage = transactions
    .map((transaction) => transaction._id)
    .filter(Boolean);
  const isAllSelected =
    transactionIdsOnPage.length > 0 &&
    transactionIdsOnPage.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        transactionIdsOnPage.forEach((id) => next.delete(id));
      } else {
        transactionIdsOnPage.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (transactionId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  };

  const tableColumns = [
    {
      key: "select",
      label: (
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={toggleSelectAll}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
          aria-label="تحديد جميع المعاملات المعروضة"
        />
      ),
      width: "50px",
    },
    { key: "index", label: "ت", width: "60px", className: "text-center" },
    { key: "transactionId", label: "رقم العملية", width: "170px" },
    { key: "user", label: "المستخدم", width: "220px" },
    { key: "type", label: "النوع", width: "120px" },
    { key: "amount", label: "المبلغ", width: "140px" },
    { key: "before", label: "قبل", width: "140px" },
    { key: "after", label: "بعد", width: "140px" },
    { key: "order", label: "الطلب", width: "160px" },
    { key: "createdAt", label: "التاريخ", width: "170px" },
  ];

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف المعاملات
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          سيتم حذف {selectedIds.size} معاملة. هل تريد المتابعة؟
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={closeDialog}
          >
            إلغاء
          </button>
          <RedBtn
            onClick={async () => {
              setIsDeleting(true);
              setError("");
              try {
                await axiosClient.delete("/transactions", {
                  data: { ids: Array.from(selectedIds) },
                });
                closeDialog();
                setSelectedIds(new Set());
                setPage(1);
                setReloadFlag((prev) => prev + 1);
              } catch (err) {
                setError("تعذر حذف المعاملات المحددة. حاول مرة أخرى.");
              } finally {
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting}
          >
            حذف
          </RedBtn>
        </div>
      </div>,
    );
  };

  return (
    <Layout>
      <section className="px-4 py-6" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              جميع المعاملات
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              إجمالي المعاملات: {totalTransactions}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">
              المحدد: {selectedIds.size}
            </span>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || isDeleting}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              حذف المحدد
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleRoleTabSelect(tab.key)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                roleTab === tab.key
                  ? "bg-primary text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <FilterBar
          fields={TRANSACTION_FILTER_FIELDS}
          values={draftFilters}
          onChange={(key, value) =>
            setDraftFilters((prev) => ({ ...prev, [key]: value }))
          }
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          sort={{
            value: `${sortBy}:${sortOrder}`,
            onChange: handleSortChange,
            options: TRANSACTION_SORT_OPTIONS,
          }}
        />

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 shadow-sm">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-600">
              جاري تحميل المعاملات...
            </div>
          ) : transactions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-600">
              لا توجد معاملات متاحة حاليا.
            </div>
          ) : (
            <Table
              columns={tableColumns}
              pagination={{
                page,
                totalPages,
                onPageChange: (nextPage) => setPage(nextPage),
              }}
            >
              <TableHead columns={tableColumns} />
              <TableBody>
                {transactions.map((transaction, index) => {
                  const isSelected = selectedIds.has(transaction._id);
                  const userName = transaction?.user?.name || "—";
                  const userPhone = transaction?.user?.phone || "";
                  const typeLabel = typeLabels[transaction.type] || "—";
                  const typeClass =
                    typeStyles[transaction.type] ||
                    "bg-slate-100 text-slate-700";
                  const orderId = resolveOrderId(transaction);
                  const isOrderLoading = loadingOrderId === transaction._id;

                  return (
                    <TableRow
                      key={transaction._id}
                      className={isSelected ? "bg-slate-50" : ""}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(transaction._id)}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {index + 1 + (page - 1) * TRANSACTIONS_PER_PAGE}
                      </TableCell>
                      <TableCell>
                        <span title={transaction._id}>
                          {formatShortId(transaction._id)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {transaction.userId ? (
                          <Link
                            to={`/users/${transaction.userId}`}
                            className="text-slate-700 hover:text-primary"
                          >
                            <div className="font-semibold">{userName}</div>
                            {userPhone && (
                              <div className="text-xs text-slate-600">
                                {userPhone}
                              </div>
                            )}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={typeClass}>{typeLabel}</Badge>
                      </TableCell>
                      <TableCell>{formatAmount(transaction.amount)}</TableCell>
                      <TableCell>
                        {formatAmount(transaction.balanceBefore)}
                      </TableCell>
                      <TableCell>
                        {formatAmount(transaction.balanceAfter)}
                      </TableCell>
                      <TableCell>
                        {orderId ? (
                          <button
                            type="button"
                            onClick={() => handleOpenOrder(transaction)}
                            disabled={isOrderLoading}
                            title={orderId}
                            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:cursor-wait disabled:opacity-60"
                          >
                            <span>عرض الطلب</span>
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(transaction.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Transactions;
