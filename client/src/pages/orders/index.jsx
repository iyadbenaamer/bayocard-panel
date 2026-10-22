import { useCallback, useEffect, useMemo, useState } from "react";

import Layout from "layout";
import { Table, TableBody, TableHead } from "components/Table";
import RedBtn from "components/RedBtn";
import FilterBar from "components/FilterBar";
import { useDialog } from "components/dialog/DialogContext";

import axiosClient from "utils/AxiosClient";
import OrderDetailsDialog from "./components/OrderDetailsDialog";
import OrderRow from "./components/OrderRow";
import useQueryParamsState from "hooks/useQueryParamsState";

const ORDERS_PER_PAGE = 10;

const INITIAL_FILTERS = {
  userQuery: "",
  provider: "",
  minTotal: "",
  maxTotal: "",
  startDate: "",
  endDate: "",
};

const ORDER_QUERY_DEFAULTS = {
  page: 1,
  sortBy: "createdAt",
  sortOrder: "desc",
  role: "business",
  ...INITIAL_FILTERS,
};

const ORDER_FILTER_FIELDS = [
  {
    key: "userQuery",
    type: "text",
    label: "المستخدم",
    placeholder: "ابحث بالاسم أو الهاتف",
    colSpan: 2,
  },
  {
    key: "provider",
    type: "select",
    label: "المصدر",
    options: [
      { value: "", label: "الكل" },
      { value: "local", label: "محلي" },
      { value: "bamboo", label: "بامبو" },
    ],
  },
  { key: "minTotal", type: "number", label: "أقل إجمالي", placeholder: "0" },
  { key: "maxTotal", type: "number", label: "أقصى إجمالي", placeholder: "0" },
  { key: "startDate", type: "date", label: "من تاريخ" },
  { key: "endDate", type: "date", label: "إلى تاريخ" },
];

const ORDER_SORT_OPTIONS = [
  { value: "createdAt:desc", label: "الأحدث" },
  { value: "createdAt:asc", label: "الأقدم" },
  { value: "totalAmount:desc", label: "الأعلى قيمة" },
  { value: "totalAmount:asc", label: "الأقل قيمة" },
];

const ROLE_TABS = [
  { key: "business", label: "تجاري" },
  { key: "individual", label: "فردي" },
];

const Orders = () => {
  const [queryState, updateQueryState] =
    useQueryParamsState(ORDER_QUERY_DEFAULTS);
  const { page, sortBy, sortOrder, role: roleTab } = queryState;
  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(INITIAL_FILTERS).map((key) => [key, queryState[key]]),
      ),
    [
      queryState.userQuery,
      queryState.provider,
      queryState.minTotal,
      queryState.maxTotal,
      queryState.startDate,
      queryState.endDate,
    ],
  );
  const setPage = useCallback(
    (nextPage) => updateQueryState({ page: nextPage }),
    [updateQueryState],
  );
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [reloadFlag, setReloadFlag] = useState(0);

  const { openDialog, closeDialog } = useDialog();

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const buildParams = () => {
    const params = {
      page,
      limit: ORDERS_PER_PAGE,
      role: roleTab,
    };

    if (sortBy) {
      params.sortBy = sortBy;
      params.sortOrder = sortOrder;
    }

    if (filters.userQuery) params.userQuery = filters.userQuery.trim();
    if (filters.provider) params.provider = filters.provider;
    if (filters.minTotal) params.minTotal = filters.minTotal;
    if (filters.maxTotal) params.maxTotal = filters.maxTotal;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;

    return params;
  };

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/orders", {
        params: buildParams(),
      });
      const payload = response.data ?? {};
      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      setTotalOrders(payload.pagination?.total ?? 0);
      setTotalPages(payload.pagination?.totalPages ?? 1);
    } catch (err) {
      setError("تعذر تحميل الطلبات. حاول مرة أخرى.");
      setOrders([]);
      setTotalOrders(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortOrder, roleTab, filters, reloadFlag]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

  const orderIdsOnPage = orders.map((order) => order._id).filter(Boolean);
  const isAllSelected =
    orderIdsOnPage.length > 0 &&
    orderIdsOnPage.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        orderIdsOnPage.forEach((id) => next.delete(id));
      } else {
        orderIdsOnPage.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (orderId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
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
          aria-label="تحديد جميع الطلبات المعروضة"
        />
      ),
      width: "50px",
    },
    { key: "index", label: "ت", width: "60px", className: "text-center" },
    { key: "orderId", label: "رقم الطلب", width: "170px" },
    { key: "user", label: "المستخدم", width: "220px" },
    { key: "items", label: "العناصر", width: "260px" },
    { key: "provider", label: "المصدر", width: "120px" },
    { key: "total", label: "الإجمالي", width: "140px" },
    { key: "createdAt", label: "التاريخ", width: "170px" },
  ];

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف الطلبات
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          سيتم حذف {selectedIds.size} طلب. هل تريد المتابعة؟
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
                await axiosClient.delete("/orders", {
                  data: { ids: Array.from(selectedIds) },
                });
                closeDialog();
                setSelectedIds(new Set());
                setPage(1);
                setReloadFlag((prev) => prev + 1);
              } catch (err) {
                setError("تعذر حذف الطلبات المحددة. حاول مرة أخرى.");
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

  const handleOpenOrder = (order) => {
    openDialog(<OrderDetailsDialog order={order} onClose={closeDialog} />);
  };

  return (
    <Layout>
      <section className="px-4 py-6" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              جميع الطلبات
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              إجمالي الطلبات: {totalOrders}
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
          fields={ORDER_FILTER_FIELDS}
          values={draftFilters}
          onChange={(key, value) =>
            setDraftFilters((prev) => ({ ...prev, [key]: value }))
          }
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          sort={{
            value: `${sortBy}:${sortOrder}`,
            onChange: handleSortChange,
            options: ORDER_SORT_OPTIONS,
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
              جاري تحميل الطلبات...
            </div>
          ) : orders.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-600">
              لا توجد طلبات متاحة حاليا.
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
                {orders.map((order, index) => {
                  const isSelected = selectedIds.has(order._id);

                  return (
                    <OrderRow
                      key={order._id}
                      order={order}
                      index={index}
                      page={page}
                      itemsPerPage={ORDERS_PER_PAGE}
                      isSelected={isSelected}
                      onToggleSelect={toggleSelectOne}
                      onOpen={handleOpenOrder}
                    />
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

export default Orders;
