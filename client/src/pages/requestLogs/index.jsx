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
import RequestLogDetailsDialog from "pages/requestLogs/components/RequestLogDetailsDialog";
import LoadingIcon from "assets/icons/loading-circle.svg?react";

import axiosClient from "utils/AxiosClient";
import { getApiErrorMessage } from "utils/errorMessages";
import useQueryParamsState from "hooks/useQueryParamsState";

const LOGS_PER_PAGE = 10;

const INITIAL_FILTERS = {
  userQuery: "",
  actionType: "",
  status: "",
  startDate: "",
  endDate: "",
};

const LOG_QUERY_DEFAULTS = {
  page: 1,
  sortOrder: "desc",
  ...INITIAL_FILTERS,
};

const ACTION_TYPE_LABELS = {
  login: "تسجيل دخول",
  signup: "تسجيل حساب",
  verification_code: "رمز التحقق",
  password_change: "تغيير كلمة المرور",
  checkout: "عملية شراء",
};

const ACTION_TYPE_STYLES = {
  login: "bg-sky-100 text-sky-800",
  signup: "bg-violet-100 text-violet-800",
  verification_code: "bg-amber-100 text-amber-800",
  password_change: "bg-orange-100 text-orange-700",
  checkout: "bg-emerald-100 text-emerald-800",
};

const LOG_FILTER_FIELDS = [
  {
    key: "userQuery",
    type: "text",
    label: "المستخدم",
    placeholder: "ابحث بالاسم أو الهاتف",
    colSpan: 2,
  },
  {
    key: "actionType",
    type: "select",
    label: "نوع الإجراء",
    options: [
      { value: "", label: "الكل" },
      ...Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    ],
  },
  {
    key: "status",
    type: "select",
    label: "الحالة",
    options: [
      { value: "", label: "الكل" },
      { value: "success", label: "نجاح" },
      { value: "failure", label: "فشل" },
    ],
  },
  { key: "startDate", type: "date", label: "من تاريخ" },
  { key: "endDate", type: "date", label: "إلى تاريخ" },
];

const LOG_SORT_OPTIONS = [
  { value: "createdAt:desc", label: "الأحدث" },
  { value: "createdAt:asc", label: "الأقدم" },
];

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

const RequestLogs = () => {
  const [queryState, updateQueryState] = useQueryParamsState(LOG_QUERY_DEFAULTS);
  const { page, sortOrder } = queryState;
  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(INITIAL_FILTERS).map((key) => [key, queryState[key]]),
      ),
    [
      queryState.userQuery,
      queryState.actionType,
      queryState.status,
      queryState.startDate,
      queryState.endDate,
    ],
  );
  const setPage = useCallback(
    (nextPage) => updateQueryState({ page: nextPage }),
    [updateQueryState],
  );
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
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
      limit: LOGS_PER_PAGE,
      sortOrder,
    };

    if (filters.userQuery) params.userQuery = filters.userQuery.trim();
    if (filters.actionType) params.actionType = filters.actionType;
    if (filters.status) params.status = filters.status;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;

    return params;
  };

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/request-logs", {
        params: buildParams(),
      });
      const payload = response.data ?? {};
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setTotalLogs(payload.pagination?.total ?? 0);
      setTotalPages(payload.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(getApiErrorMessage(err, "تعذر تحميل السجلات. حاول مرة أخرى."));
      setLogs([]);
      setTotalLogs(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortOrder, filters, reloadFlag]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, sortOrder, filters]);

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
    const [, direction] = event.target.value.split(":");
    updateQueryState({ sortOrder: direction || "desc", page: 1 });
  };

  const handleOpenDetails = (log) => {
    openDialog(
      <RequestLogDetailsDialog log={log} onClose={closeDialog} />,
    );
  };

  const logIdsOnPage = logs.map((log) => log._id).filter(Boolean);
  const isAllSelected =
    logIdsOnPage.length > 0 && logIdsOnPage.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        logIdsOnPage.forEach((id) => next.delete(id));
      } else {
        logIdsOnPage.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (logId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
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
          aria-label="تحديد جميع السجلات المعروضة"
        />
      ),
      width: "50px",
    },
    { key: "index", label: "ت", width: "50px", className: "text-center" },
    { key: "actionType", label: "الإجراء", width: "140px" },
    { key: "status", label: "الحالة", width: "90px" },
    { key: "user", label: "المستخدم", width: "200px" },
    { key: "ip", label: "عنوان IP", width: "130px" },
    { key: "location", label: "الموقع", width: "150px" },
    { key: "device", label: "الجهاز", width: "150px" },
    { key: "createdAt", label: "التاريخ", width: "160px" },
    { key: "details", label: "", width: "90px" },
  ];

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف السجلات
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          سيتم حذف {selectedIds.size} سجل. هل تريد المتابعة؟
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
                await axiosClient.delete("/request-logs", {
                  data: { ids: Array.from(selectedIds) },
                });
                closeDialog();
                setSelectedIds(new Set());
                setPage(1);
                setReloadFlag((prev) => prev + 1);
              } catch (err) {
                setError(
                  getApiErrorMessage(err, "تعذر حذف السجلات المحددة. حاول مرة أخرى."),
                );
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
              سجل النشاط
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              إجمالي السجلات: {totalLogs}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-label="تحديث"
              onClick={fetchLogs}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {isLoading ? <LoadingIcon height={18} /> : "تحديث"}
            </button>
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

        <FilterBar
          fields={LOG_FILTER_FIELDS}
          values={draftFilters}
          onChange={(key, value) =>
            setDraftFilters((prev) => ({ ...prev, [key]: value }))
          }
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          sort={{
            value: `createdAt:${sortOrder}`,
            onChange: handleSortChange,
            options: LOG_SORT_OPTIONS,
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
              جاري تحميل السجلات...
            </div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-600">
              لا توجد سجلات متاحة حاليا.
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
                {logs.map((log, index) => {
                  const isSelected = selectedIds.has(log._id);
                  const userName = log?.user?.name || "—";
                  const userPhone = log?.user?.phone || "";
                  const actionLabel =
                    ACTION_TYPE_LABELS[log.actionType] || log.actionType;
                  const actionClass =
                    ACTION_TYPE_STYLES[log.actionType] ||
                    "bg-slate-100 text-slate-700";
                  const location = [log?.location?.city, log?.location?.country]
                    .filter(Boolean)
                    .join(", ");
                  const device = [log?.device?.platform, log?.device?.deviceName]
                    .filter(Boolean)
                    .join(" — ");

                  return (
                    <TableRow
                      key={log._id}
                      className={isSelected ? "bg-slate-50" : ""}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(log._id)}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {index + 1 + (page - 1) * LOGS_PER_PAGE}
                      </TableCell>
                      <TableCell>
                        <Badge className={actionClass}>{actionLabel}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge tone={log.status === "success" ? "success" : "danger"}>
                          {log.status === "success" ? "نجاح" : "فشل"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.userId ? (
                          <Link
                            to={`/users/${log.userId}`}
                            className="text-slate-700 hover:text-primary"
                          >
                            <div className="font-semibold">{userName}</div>
                            {userPhone && (
                              <div className="text-xs text-slate-600">
                                {userPhone}
                              </div>
                            )}
                          </Link>
                        ) : log.phone || log.name ? (
                          <div>
                            <div className="font-semibold text-slate-700">
                              {log.name || "—"}
                            </div>
                            {log.phone && (
                              <div className="text-xs text-slate-600" dir="ltr">
                                {log.phone}
                              </div>
                            )}
                         
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <span dir="ltr">{log.ip || "—"}</span>
                      </TableCell>
                      <TableCell>{location || "—"}</TableCell>
                      <TableCell>{device || "—"}</TableCell>
                      <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(log)}
                          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
                        >
                          التفاصيل
                        </button>
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

export default RequestLogs;
