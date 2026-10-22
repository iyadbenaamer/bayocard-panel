import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Layout from "layout";
import axiosClient from "utils/AxiosClient";
import CustomInput from "components/CustomInput";
import PrimaryBtn from "components/PrimaryBtn";
import Alert from "components/Alert";
import SubmitBtn from "components/SubmitBtn";
import RedBtn from "components/RedBtn";
import { useDialog } from "components/dialog/DialogContext";
import ArrowRightIcon from "assets/icons/arrow-right.svg?react";
import CustomPricingSection from "./components/CustomPricingSection";
import FavoritesSection from "./components/FavoritesSection";
import SessionsSection from "./components/SessionsSection";
import ApiKeysSection from "./components/ApiKeysSection";
import UserInfoGrid from "./components/UserInfoGrid";
import TransactionsSection from "./components/TransactionsSection";
import DepositDialog from "./components/DepositDialog";
import { getApiErrorMessage } from "utils/errorMessages";
import {
  formatAmount,
  formatArabicDateTime,
  formatTransactionType,
  resolveBoolean,
  safeValue,
} from "./utils";

const buildFormState = (user) => ({
  name: user?.name ?? "",
  phone: user?.phone ?? "",
  role: user?.role ?? "business",
  balance: user?.balance ?? 0,
  password: "",
  isActive: resolveBoolean(user?.isActive, false),
  canBuy: resolveBoolean(user?.canBuy, false),
  canSendCode: resolveBoolean(user?.canSendCode, false),
  canManageApiKeys: resolveBoolean(user?.canManageApiKeys, false),
  isVerified: resolveBoolean(user?.verificationStatus?.isVerified, false),
});

const User = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { openDialog, closeDialog } = useDialog();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formState, setFormState] = useState(buildFormState(null));
  const [transactions, setTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [isTransactionsLoadingMore, setIsTransactionsLoadingMore] =
    useState(false);
  const [transactionsError, setTransactionsError] = useState("");
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsHasMore, setTransactionsHasMore] = useState(false);
  const transactionsLoadMoreRef = useRef(null);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    try {
      const response = await axiosClient.get("/user", {
        params: { id },
      });
      setUser(response.data.profile);
      setError("");
    } catch (err) {
      setError(
        getApiErrorMessage(err, "تعذر تحميل بيانات المستخدم. حاول مرة أخرى."),
      );
      setUser(null);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      await fetchUser();
      if (isMounted) setIsLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, [fetchUser]);

  useEffect(() => {
    if (!user || isEditing) return;
    setFormState(buildFormState(user));
  }, [user, isEditing]);

  const fetchTransactions = useCallback(
    async (pageToLoad = 1) => {
      if (!user?._id) return;

      const isFirstPage = pageToLoad === 1;
      if (isFirstPage) {
        setIsTransactionsLoading(true);
        setTransactionsError("");
      } else {
        setIsTransactionsLoadingMore(true);
      }

      try {
        const response = await axiosClient.get("/transactions", {
          params: { userId: user._id, page: pageToLoad, limit: 20 },
        });

        const fetchedTransactions = Array.isArray(response.data?.transactions)
          ? response.data.transactions
          : [];
        const pagination = response.data?.pagination ?? {};

        setTransactions((currentTransactions) =>
          isFirstPage
            ? fetchedTransactions
            : [...currentTransactions, ...fetchedTransactions],
        );
        setTransactionsPage(pagination.page ?? pageToLoad);
        setTransactionsHasMore(Boolean(pagination.hasMore));
      } catch (err) {
        if (isFirstPage) {
          setTransactionsError(
            getApiErrorMessage(err, "تعذر تحميل سجل المعاملات. حاول مرة أخرى."),
          );
          setTransactions([]);
          setTransactionsHasMore(false);
        }
      } finally {
        if (isFirstPage) {
          setIsTransactionsLoading(false);
        } else {
          setIsTransactionsLoadingMore(false);
        }
      }
    },
    [user?._id],
  );

  useEffect(() => {
    setTransactions([]);
    setTransactionsPage(1);
    setTransactionsHasMore(false);
    setTransactionsError("");
    setIsTransactionsLoadingMore(false);
    if (user?._id) {
      fetchTransactions(1);
    }
  }, [user?._id, fetchTransactions]);

  useEffect(() => {
    const sentinel = transactionsLoadMoreRef.current;
    if (!sentinel || !transactionsHasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry?.isIntersecting &&
          !isTransactionsLoading &&
          !isTransactionsLoadingMore &&
          transactionsHasMore &&
          user?._id
        ) {
          fetchTransactions(transactionsPage + 1);
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [
    fetchTransactions,
    isTransactionsLoading,
    isTransactionsLoadingMore,
    transactionsHasMore,
    transactionsPage,
    user?._id,
  ]);

  const infoItems = useMemo(() => {
    if (!user) return [];
    return [
      { label: "الاسم", value: safeValue(user.name) },
      {
        label: "نوع الحساب",
        value: user.role === "individual" ? "فردي" : "تجاري",
        badge: true,
        badgeVariant: "role",
      },
      { label: "رقم الهاتف", value: safeValue(user.phone) },
      { label: "الرصيد", value: safeValue(user.balance) },
      {
        label: "حالة الحساب",
        value: user.isActive ? "مفعّل" : "معطّل",
        badge: true,
      },
      {
        label: "حالة التحقق من الحساب",
        value: user.verificationStatus?.isVerified
          ? "تم التحقق"
          : "لم يتم التحقق ",
        badge: true,
      },
      {
        label: "يمكنه الشراء",
        value: user.canBuy ? "نعم" : "لا",
        badge: true,
      },
      {
        label: "يمكنه إرسال رموز التحقق",
        value: user.canSendCode ? "نعم" : "لا",
        badge: true,
      },
      ...(user.role === "business"
        ? [
            {
              label: "يمكنه إدارة مفاتيح API الخاصة به",
              value: user.canManageApiKeys ? "نعم" : "لا",
              badge: true,
            },
          ]
        : []),
      {
        label: "تاريخ الإنشاء",
        value: user.createdAt ? formatArabicDateTime(user.createdAt) : "—",
      },
      {
        label: "آخر تحديث",
        value: user.updatedAt ? formatArabicDateTime(user.updatedAt) : "—",
      },
    ];
  }, [user]);

  const transactionColumns = useMemo(
    () => [
      { key: "type", label: "النوع" },
      { key: "amount", label: "المبلغ" },
      { key: "balanceBefore", label: "الرصيد قبل" },
      { key: "balanceAfter", label: "الرصيد بعد" },
      { key: "createdAt", label: "التاريخ" },
    ],
    [],
  );

  const handleEditStart = () => {
    setFormState(buildFormState(user));
    setIsEditing(true);
    setError("");
    setSuccessMessage("");
  };

  const handleCancel = () => {
    setFormState(buildFormState(user));
    setIsEditing(false);
    setError("");
    setSuccessMessage("");
  };

  const handleSave = async () => {
    if (!user?._id) return;
    setIsSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const payload = {
        name: formState.name,
        phone: formState.phone,
        role: formState.role,
        balance: formState.balance,
        isActive: formState.isActive,
        canBuy: formState.canBuy,
        canSendCode: formState.canSendCode,
        canManageApiKeys: formState.canManageApiKeys,
        verificationStatus: { isVerified: formState.isVerified },
        ...(formState.password ? { password: formState.password } : {}),
      };
      const response = await axiosClient.patch("/user", payload, {
        params: { id: user._id },
      });
      setUser(response.data);
      setIsEditing(false);
      setSuccessMessage("تم تحديث بيانات المستخدم بنجاح.");
    } catch (err) {
      setError(
        getApiErrorMessage(err, "تعذر تحديث بيانات المستخدم. حاول مرة أخرى."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const performDelete = async () => {
    if (!user?._id) return;
    setIsDeleting(true);
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.delete("/user", {
        params: { id: user._id },
      });
      navigate("/users");
    } catch (err) {
      setError(getApiErrorMessage(err, "تعذر حذف المستخدم. حاول مرة أخرى."));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDepositRequest = () => {
    openDialog(
      <DepositDialog
        userId={user?._id}
        onBalanceUpdate={(newBalance) => {
          setUser((prev) => ({ ...prev, balance: newBalance }));
          setSuccessMessage("تمت عملية الإيداع بنجاح.");
          fetchTransactions();
        }}
        onClose={closeDialog}
      />,
    );
  };

  const handleDeleteRequest = () => {
    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف المستخدم
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          هل أنت متأكد أنك تريد حذف هذا المستخدم؟ لا يمكن التراجع عن ذلك.
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
              closeDialog();
              await performDelete();
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
      <div className="px-4 py-6" dir="rtl">
        {(error || successMessage) && (
          <div className="mb-5 space-y-3">
            <Alert tone="error">{error}</Alert>
            <Alert tone="success">{successMessage}</Alert>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              aria-label="العودة"
              className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              onClick={() => navigate(-1)}
            >
              <ArrowRightIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                تفاصيل المستخدم
              </h1>
              <p className="mt-1 text-sm text-slate-600">{user?.name || "—"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <>
                <SubmitBtn onClick={handleSave} disabled={isSaving}>
                  حفظ
                </SubmitBtn>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  إلغاء
                </button>
              </>
            ) : (
              <>
                <PrimaryBtn onClick={handleDepositRequest}>إيداع</PrimaryBtn>
                <PrimaryBtn onClick={handleEditStart}>تعديل</PrimaryBtn>
                <RedBtn onClick={handleDeleteRequest} disabled={isDeleting}>
                  حذف
                </RedBtn>
              </>
            )}
          </div>
        </div>

        {isLoading && !user ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
            جاري تحميل بيانات المستخدم...
          </div>
        ) : !user ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
            لا يوجد بيانات لعرضها.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {isEditing && (
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700">
                  تعديل بيانات المستخدم
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <CustomInput
                    label="الاسم"
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                  <CustomInput
                    dir="ltr"
                    label="رقم الهاتف"
                    value={formState.phone}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                  />
                  <CustomInput
                    label="الرصيد"
                    type="number"
                    value={formState.balance}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        balance: event.target.value,
                      }))
                    }
                  />
                  <CustomInput
                    label="كلمة المرور الجديدة"
                    type="password"
                    value={formState.password}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                  />
                  <div>
                    <label className="text-xs text-slate-600">نوع الحساب</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      value={formState.role}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          role: event.target.value,
                        }))
                      }
                    >
                      <option value="business">تجاري</option>
                      <option value="individual">فردي</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">
                      حالة التحقق من الحساب
                    </label>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      value={formState.isVerified ? "true" : "false"}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          isVerified: event.target.value === "true",
                        }))
                      }
                    >
                      <option value="true">تم التحقق</option>
                      <option value="false">لم يتم التحقق</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">
                      حالة الحساب
                    </label>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      value={formState.isActive ? "true" : "false"}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          isActive: event.target.value === "true",
                        }))
                      }
                    >
                      <option value="true">مفعّل</option>
                      <option value="false">معطّل</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">
                      يمكنه الشراء
                    </label>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      value={formState.canBuy ? "true" : "false"}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          canBuy: event.target.value === "true",
                        }))
                      }
                    >
                      <option value="true">نعم</option>
                      <option value="false">لا</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">
                      يمكنه إرسال رموز التحقق
                    </label>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      value={formState.canSendCode ? "true" : "false"}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          canSendCode: event.target.value === "true",
                        }))
                      }
                    >
                      <option value="true">نعم</option>
                      <option value="false">لا</option>
                    </select>
                  </div>
                  {user.role === "business" && (
                    <div>
                      <label className="text-xs text-slate-600">
                        يمكنه إدارة مفاتيح API الخاصة به
                      </label>
                      <select
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        value={formState.canManageApiKeys ? "true" : "false"}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            canManageApiKeys: event.target.value === "true",
                          }))
                        }
                      >
                        <option value="true">نعم</option>
                        <option value="false">لا</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            <UserInfoGrid infoItems={infoItems} />

            {user.role !== "individual" && (
              <CustomPricingSection userId={user?._id} />
            )}

            <SessionsSection userId={user?._id} />

            {user.role === "business" && (
              <ApiKeysSection userId={user?._id} />
            )}

            <FavoritesSection userId={user?._id} />

            <TransactionsSection
              transactionColumns={transactionColumns}
              transactions={transactions}
              isLoading={isTransactionsLoading}
              isLoadingMore={isTransactionsLoadingMore}
              error={transactionsError}
              hasMore={transactionsHasMore}
              loadMoreRef={transactionsLoadMoreRef}
              formatTransactionType={formatTransactionType}
              formatAmount={formatAmount}
              formatArabicDateTime={formatArabicDateTime}
              safeValue={safeValue}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};
export default User;
