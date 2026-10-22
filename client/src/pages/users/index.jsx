import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import Layout from "layout";
import PrimaryBtn from "components/PrimaryBtn";
import FilterBar from "components/FilterBar";
import Badge from "components/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components/Table";
import { useDialog } from "components/dialog/DialogContext";
import AddUserDialog from "./components/AddUserDialog";
import axiosClient from "utils/AxiosClient";
import formatArabicDate from "utils/formatArabicDate";
import useQueryParamsState from "hooks/useQueryParamsState";

const USERS_PER_PAGE = 20;

const INITIAL_FILTERS = {
  query: "",
  status: "",
  startDate: "",
  endDate: "",
};

const USER_QUERY_DEFAULTS = {
  page: 1,
  sortBy: "name",
  sortOrder: "asc",
  role: "business",
  ...INITIAL_FILTERS,
};

const USER_FILTER_FIELDS = [
  {
    key: "query",
    type: "text",
    label: "بحث",
    placeholder: "ابحث بالاسم أو رقم الهاتف",
    colSpan: 2,
  },
  {
    key: "status",
    type: "select",
    label: "الحالة",
    options: [
      { value: "", label: "الكل" },
      { value: "active", label: "مفعّل" },
      { value: "inactive", label: "معطّل" },
    ],
  },
  { key: "startDate", type: "date", label: "من تاريخ" },
  { key: "endDate", type: "date", label: "إلى تاريخ" },
];

const ROLE_TABS = [
  { key: "business", label: "تجاري" },
  { key: "individual", label: "فردي" },
];

const USER_SORT_OPTIONS = [
  { value: "name:asc", label: "الاسم (أ-ي)" },
  { value: "name:desc", label: "الاسم (ي-أ)" },
  { value: "status:desc", label: "الحالة" },
];

const Users = () => {
  const navigate = useNavigate();
  const [queryState, updateQueryState] =
    useQueryParamsState(USER_QUERY_DEFAULTS);
  const { page, sortBy, sortOrder, role: roleTab } = queryState;
  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(INITIAL_FILTERS).map((key) => [key, queryState[key]]),
      ),
    [
      queryState.query,
      queryState.status,
      queryState.startDate,
      queryState.endDate,
    ],
  );
  const [draftFilters, setDraftFilters] = useState(filters);
  const setPage = useCallback(
    (nextPage) => updateQueryState({ page: nextPage }),
    [updateQueryState],
  );
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadFlag, setReloadFlag] = useState(0); // used to trigger refetch when user added

  const { openDialog, closeDialog } = useDialog();
  const location = useLocation();

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/user/many", {
        params: {
          page,
          limit: USERS_PER_PAGE,
          sortBy,
          sortOrder,
          role: roleTab,
          ...(filters.query ? { query: filters.query.trim() } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.startDate ? { startDate: filters.startDate } : {}),
          ...(filters.endDate ? { endDate: filters.endDate } : {}),
        },
      });
      setUsers(response.data?.users ?? []);
      setTotalUsers(response.data?.total ?? 0);
      setTotalPages(response.data?.totalPages ?? 1);
    } catch (err) {
      setError("تعذر تحميل المستخدمين. حاول مرة أخرى.");
      setUsers([]);
      setTotalUsers(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortOrder, roleTab, filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, reloadFlag]);

  const handleUserAdded = () => {
    // after a new user is created refresh list and reset paging
    setPage(1);
    setReloadFlag((f) => f + 1);
  };

  const openCreateDialog = () => {
    openDialog(
      <AddUserDialog
        onAdded={handleUserAdded}
        onClose={() => {
          closeDialog();
          const params = new URLSearchParams(location.search);
          params.delete("create");
          navigate(
            { pathname: "/users", search: params.toString() },
            { replace: true },
          );
        }}
      />,
    );
  };

  // open dialog if query param present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("create") === "true") {
      openCreateDialog();
    }
  }, [location.search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
      sortBy: field || "name",
      sortOrder: direction || "asc",
      page: 1,
    });
  };

  const handleRoleTabSelect = (tabKey) => {
    updateQueryState({ role: tabKey, page: 1 });
  };

  const statusTones = {
    true: "success",
    false: "danger",
  };
  const statusLabels = {
    true: "مفعّل",
    false: "معطّل",
  };
  const tableColumns = [
    { key: "name", label: "الاسم", width: "220px" },
    { key: "role", label: "النوع", width: "120px" },
    { key: "phone", label: "رقم الهاتف", width: "180px" },
    { key: "created", label: "تاريخ الإنشاء", width: "170px" },
    { key: "status", label: "الحالة", width: "130px" },
  ];

  return (
    <Layout>
      <div className="px-4 py-6" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              إدارة المستخدمين
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              إجمالي المستخدمين: {totalUsers}
            </p>
          </div>
          <PrimaryBtn onClick={openCreateDialog}>إنشاء مستخدم جديد</PrimaryBtn>
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
          fields={USER_FILTER_FIELDS}
          values={draftFilters}
          onChange={(key, value) =>
            setDraftFilters((prev) => ({ ...prev, [key]: value }))
          }
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          sort={{
            value: `${sortBy}:${sortOrder}`,
            onChange: handleSortChange,
            options: USER_SORT_OPTIONS,
          }}
        />

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-600">
              جاري تحميل المستخدمين...
            </div>
          ) : error ? (
            <div className="px-4 py-10 text-center text-sm text-red-500">
              {error}
            </div>
          ) : users.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-600">
              لا يوجد مستخدمون للعرض
            </div>
          ) : (
            <Table
              columns={tableColumns}
              pagination={{
                page,
                totalPages,
                onPageChange: setPage,
              }}
            >
              <TableHead columns={tableColumns} />
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user._id}
                    className="cursor-pointer transition hover:bg-slate-50"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/users/${user._id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/users/${user._id}`);
                      }
                    }}
                  >
                    <TableCell>
                      <div className="font-medium text-slate-800">
                        {user.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge tone={user.role === "individual" ? "info" : "warning"}>
                        {user.role === "individual" ? "فردي" : "تجاري"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600" dir="ltr">
                      {user.phone}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {user.createdAt ? formatArabicDate(user.createdAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={statusTones[String(user.isActive)]}>
                        {statusLabels[String(user.isActive)]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Users;
