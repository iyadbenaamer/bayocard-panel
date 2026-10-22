import { useCallback, useEffect, useMemo, useState } from "react";

import Layout from "layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components/Table";
import CustomInput from "components/CustomInput";
import DateInput from "components/DateInput";
import Badge from "components/Badge";
import SubmitBtn from "components/SubmitBtn";
import RedBtn from "components/RedBtn";
import FilterBar from "components/FilterBar";
import OrderDetailsDialog from "pages/orders/components/OrderDetailsDialog";

import axiosClient from "utils/AxiosClient";
import { useDialog } from "components/dialog/DialogContext";
import useQueryParamsState from "hooks/useQueryParamsState";

import EyeIcon from "assets/icons/eye.svg?react";

const getDisplayName = (name) => name?.ar || name?.en || "";

const CARD_INITIAL_FILTERS = {
  searchType: "serialNumber",
  searchQuery: "",
  typeId: "",
  isSold: "",
  startDate: "",
  endDate: "",
};

const CARD_QUERY_DEFAULTS = {
  categoryId: "",
  page: 1,
  sortBy: "serialNumber",
  sortOrder: "asc",
  ...CARD_INITIAL_FILTERS,
};

const CARD_SEARCH_TYPE_OPTIONS = [
  { value: "serialNumber", label: "الرقم التسلسلي" },
  { value: "orderNumber", label: "رقم الطلب" },
  { value: "pin", label: "الرقم السري" },
  { value: "code", label: "الكود" },
];

const CARD_SEARCH_TYPE_PLACEHOLDERS = {
  serialNumber: "ابحث بالرقم التسلسلي",
  orderNumber: "ابحث برقم الطلب الذي بيعت فيه البطاقة",
  pin: "ابحث بالرقم السري للبطاقة",
  code: "ابحث بكود البطاقة",
};

const Cards = () => {
  const CARDS_PER_PAGE = 10;
  const [queryState, updateQueryState] =
    useQueryParamsState(CARD_QUERY_DEFAULTS);
  const activeCategoryId = queryState.categoryId;
  const cardsPage = queryState.page;
  const { sortBy, sortOrder } = queryState;
  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(CARD_INITIAL_FILTERS).map((key) => [key, queryState[key]]),
      ),
    [
      queryState.searchType,
      queryState.searchQuery,
      queryState.typeId,
      queryState.isSold,
      queryState.startDate,
      queryState.endDate,
    ],
  );
  const setCardsPage = useCallback(
    (nextPage) => updateQueryState({ page: nextPage }),
    [updateQueryState],
  );
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [cards, setCards] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [error, setError] = useState("");
  const [visibleCodes, setVisibleCodes] = useState({});
  const [totalCards, setTotalCards] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [cardActionId, setCardActionId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const { openDialog, closeDialog } = useDialog();

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const soldTones = {
    true: "danger",
    false: "success",
  };
  const soldLabels = {
    true: "مباع",
    false: "متاح",
  };

  const cardIdsOnPage = cards.map((card) => card._id).filter(Boolean);
  const isAllSelected =
    cardIdsOnPage.length > 0 &&
    cardIdsOnPage.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        cardIdsOnPage.forEach((id) => next.delete(id));
      } else {
        cardIdsOnPage.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (cardId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
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
          aria-label="تحديد جميع البطاقات المعروضة"
        />
      ),
      width: "50px",
    },
    { key: "order", label: "ت", width: "70px", className: "text-center" },
    {
      key: "serial",
      label: "الرقم التسلسلي",
      width: "200px",
      className: "",
    },
    { key: "code", label: "الكود", className: "" },
    { key: "type", label: "نوع البطاقة" },
    {
      key: "status",
      label: "الحالة",
      width: "140px",
      className: "text-center",
    },
    { key: "tier", label: "الفئة", width: "180px" },
    { key: "buyer", label: "المشتري", width: "180px" },
    {
      key: "actions",
      label: "إجراءات",
      width: "230px",
      className: "text-left",
    },
  ];

  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setError("");
    try {
      const response = await axiosClient.get("/card-categories");
      const list = Array.isArray(response.data) ? response.data : [];
      setCategories(list);
    } catch (err) {
      setError("تعذر تحميل التصنيفات. حاول مرة أخرى.");
      setCategories([]);
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  const fetchTypes = useCallback(async () => {
    if (!activeCategoryId) {
      setTypes([]);
      return;
    }
    try {
      const response = await axiosClient.get("/card-types/by-category", {
        params: { categoryId: activeCategoryId },
      });
      const payload = response.data ?? {};
      setTypes(Array.isArray(payload.cardTypes) ? payload.cardTypes : []);
    } catch (err) {
      setTypes([]);
    }
  }, [activeCategoryId]);

  const fetchCardsByCategory = useCallback(async () => {
    if (!activeCategoryId) {
      setCards([]);
      return;
    }
    setIsLoadingCards(true);
    setError("");
    try {
      const response = await axiosClient.get("/cards/by-category", {
        params: {
          categoryId: activeCategoryId,
          page: cardsPage,
          limit: CARDS_PER_PAGE,
          sortBy,
          sortOrder,
          ...(filters.searchQuery
            ? {
                searchType: filters.searchType || "serialNumber",
                searchQuery: filters.searchQuery.trim(),
              }
            : {}),
          ...(filters.typeId ? { typeId: filters.typeId } : {}),
          ...(filters.isSold ? { isSold: filters.isSold } : {}),
          ...(filters.startDate ? { startDate: filters.startDate } : {}),
          ...(filters.endDate ? { endDate: filters.endDate } : {}),
        },
      });
      const payload = response.data ?? {};
      setCards(Array.isArray(payload.cards) ? payload.cards : []);
      setTotalCards(payload.total ?? 0);
      setTotalPages(payload.totalPages ?? 1);
    } catch (err) {
      setError("تعذر تحميل البطاقات. حاول مرة أخرى.");
      setCards([]);
      setTotalCards(0);
      setTotalPages(1);
    } finally {
      setIsLoadingCards(false);
    }
  }, [activeCategoryId, cardsPage, sortBy, sortOrder, filters]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!categories.length) return;
    const stillExists = categories.some(
      (category) => category._id === activeCategoryId,
    );
    if (!activeCategoryId || !stillExists) {
      updateQueryState({
        categoryId: categories[0]._id,
        page: 1,
        ...CARD_INITIAL_FILTERS,
      });
    }
  }, [activeCategoryId, categories, updateQueryState]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  useEffect(() => {
    fetchCardsByCategory();
  }, [fetchCardsByCategory]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeCategoryId, cardsPage, sortBy, sortOrder, filters]);

  useEffect(() => {
    if (cardsPage > totalPages) {
      setCardsPage(totalPages);
    }
  }, [cardsPage, totalPages]);

  const handleCategorySelect = (categoryId) => {
    updateQueryState({
      categoryId,
      page: 1,
      ...CARD_INITIAL_FILTERS,
    });
    setVisibleCodes({});
    setDraftFilters(CARD_INITIAL_FILTERS);
  };

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
    setDraftFilters(CARD_INITIAL_FILTERS);
    updateQueryState({
      ...CARD_INITIAL_FILTERS,
      page: 1,
      ...Object.fromEntries(draftKeys.map((key) => [`draft_${key}`, null])),
    });
  };

  const toggleCodeVisibility = (cardId) => {
    setVisibleCodes((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const maskCode = (value) => {
    if (!value) return "-";
    const length = Math.max(6, Math.min(value.length, 12));
    return "*".repeat(length);
  };

  const renderSerialNumber = (value) => {
    if (!value) return "-";
    const groups = String(value)
      .replace(/\s+/g, "")
      .match(/.{1,4}/g);
    if (!groups) return "-";
    return (
      <span className="inline-flex gap-1">
        {groups.map((group, index) => (
          <span key={`${group}-${index}`}>{group}</span>
        ))}
      </span>
    );
  };

  const getCardErrorMessage = (code) => {
    switch (code) {
      case "CARD_REQUIRED_FIELDS_MISSING":
        return "الرجاء إدخال البيانات المطلوبة.";
      case "CARD_SERIAL_NUMBER_REQUIRED":
        return "الرقم التسلسلي مطلوب.";
      case "CARD_TIER_ID_INVALID":
      case "CARD_TIER_NOT_FOUND":
        return "تعذر العثور على فئة البطاقة.";
      case "CARD_SERIAL_NUMBER_INVALID":
        return "الرقم التسلسلي يجب أن يكون 15 رقما.";
      case "CARD_SERIAL_NUMBER_TAKEN":
        return "الرقم التسلسلي مستخدم بالفعل.";
      case "CARD_CODE_REQUIRED":
        return "الكود مطلوب.";
      case "CARD_CODE_DUPLICATE":
        return "لا يمكن تكرار الكود لنفس النوع.";
      case "CARD_EXPIRY_DATE_INVALID":
        return "تاريخ انتهاء الصلاحية غير صالح.";
      default:
        return "تعذر تنفيذ العملية. حاول مرة أخرى.";
    }
  };

  const getCardUpdateErrorMessage = (code) => {
    if (!code) {
      return "تعذر تعديل البطاقة. حاول مرة أخرى.";
    }
    if (code === "CARD_NOT_FOUND") {
      return "تعذر العثور على البطاقة المطلوبة.";
    }
    return getCardErrorMessage(code);
  };

  const EditCardDialog = ({ card, onSave, onCancel }) => {
    const [serialNumber, setSerialNumber] = useState(card?.serialNumber ?? "");
    const [code, setCode] = useState(card?.code ?? "");
    const [pin, setPin] = useState(card?.pin ?? "");
    const [expiryDate, setExpiryDate] = useState(
      card?.expiryDate ? String(card.expiryDate).slice(0, 10) : "",
    );
    const [isAvailable, setIsAvailable] = useState(!card?.isSold);
    const [dialogError, setDialogError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تعديل بيانات البطاقة
        </h2>
        <div className="mt-4 space-y-3">
          <CustomInput
            label="الرقم التسلسلي"
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
          />
          <CustomInput
            label="الكود"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <CustomInput
            label="PIN (اختياري)"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
          <DateInput
            label="تاريخ انتهاء الصلاحية (اختياري)"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={isAvailable}
              onChange={(event) => setIsAvailable(event.target.checked)}
            />
            متاح
          </label>
        </div>
        {dialogError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {dialogError}
          </div>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            إلغاء
          </button>
          <SubmitBtn
            onClick={async () => {
              setIsSubmitting(true);
              setDialogError("");
              const result = await onSave({
                serialNumber,
                code,
                pin,
                expiryDate,
                isAvailable,
              });
              if (result?.ok) {
                onCancel();
              } else if (result?.error) {
                setDialogError(result.error);
              }
              setIsSubmitting(false);
            }}
            disabled={isSubmitting}
          >
            حفظ
          </SubmitBtn>
        </div>
      </div>
    );
  };

  const DeleteCardDialog = ({ cardCode, onDelete, onCancel }) => {
    const [dialogError, setDialogError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف البطاقة
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          سيتم حذف البطاقة
          <span className="font-semibold text-slate-800"> {cardCode}</span>. هل
          تريد المتابعة؟
        </p>
        {dialogError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {dialogError}
          </div>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            إلغاء
          </button>
          <RedBtn
            onClick={async () => {
              setIsSubmitting(true);
              setDialogError("");
              const result = await onDelete();
              if (result?.ok) {
                onCancel();
              } else if (result?.error) {
                setDialogError(result.error);
              }
              setIsSubmitting(false);
            }}
            disabled={isSubmitting}
          >
            حذف
          </RedBtn>
        </div>
      </div>
    );
  };

  const CardDetailsDialog = ({ card, onCancel }) => {
    const [details, setDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dialogError, setDialogError] = useState("");
    const [isCodeVisible, setIsCodeVisible] = useState(false);
    const [isOrderLoading, setIsOrderLoading] = useState(false);

    useEffect(() => {
      let isMounted = true;
      const fetchDetails = async () => {
        setIsLoading(true);
        setDialogError("");
        try {
          const response = await axiosClient.get("/cards/get-one", {
            params: { id: card._id },
          });
          if (isMounted) setDetails(response.data);
        } catch (err) {
          if (isMounted) setDialogError("تعذر تحميل تفاصيل البطاقة.");
        } finally {
          if (isMounted) setIsLoading(false);
        }
      };
      fetchDetails();
      return () => {
        isMounted = false;
      };
    }, [card?._id]);

    const handleOpenOrder = async () => {
      if (!details?.orderId) return;
      setIsOrderLoading(true);
      setDialogError("");
      try {
        const response = await axiosClient.get("/orders/one", {
          params: { id: details.orderId },
        });
        const order = response.data ?? null;
        if (!order?._id) throw new Error("ORDER_NOT_FOUND");
        openDialog(<OrderDetailsDialog order={order} onClose={closeDialog} />);
      } catch (err) {
        setDialogError("تعذر تحميل الطلب المرتبط بهذه البطاقة.");
      } finally {
        setIsOrderLoading(false);
      }
    };

    const isSold = details ? Boolean(details.soldTo) : Boolean(card?.isSold);

    return (
      <div className="min-w-80 max-w-md p-2" dir="rtl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-800">
            تفاصيل البطاقة
          </h2>
          <Badge tone={soldTones[isSold]}>{soldLabels[isSold]}</Badge>
        </div>

        {isLoading ? (
          <div className="mt-6 py-6 text-center text-sm text-slate-600">
            جاري تحميل التفاصيل...
          </div>
        ) : !details ? (
          <div className="mt-6 py-6 text-center text-sm text-rose-500">
            {dialogError || "تعذر تحميل تفاصيل البطاقة."}
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-600">الرقم التسلسلي</span>
              <span className="font-mono text-slate-800" dir="ltr">
                {renderSerialNumber(details.serialNumber)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-600">الكود</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-800" dir="ltr">
                  {isCodeVisible
                    ? renderSerialNumber(details.code) || "-"
                    : maskCode(details.code)}
                </span>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
                  onClick={() => setIsCodeVisible((prev) => !prev)}
                  aria-label={isCodeVisible ? "إخفاء الكود" : "إظهار الكود"}
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-600">الرقم السري (PIN)</span>
              <span className="text-slate-800">{details.pin || "-"}</span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-600">نوع البطاقة</span>
              <span className="text-slate-800">
                {getDisplayName(details.typeName) || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-600">الفئة</span>
              <span className="text-slate-800">
                {getDisplayName(details.tierTitle) || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-600">تاريخ انتهاء الصلاحية</span>
              <span className="text-slate-800">
                {details.expiryDate
                  ? String(details.expiryDate).slice(0, 10)
                  : "-"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-600">تاريخ الإضافة</span>
              <span className="text-slate-800">
                {details.createdAt
                  ? String(details.createdAt).slice(0, 10)
                  : "-"}
              </span>
            </div>

            {isSold && (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-600">المشتري</span>
                  <div className="text-left">
                    <div className="text-slate-800">
                      {details.buyerName || "-"}
                    </div>
                    {details.buyerPhone && (
                      <div className="text-xs text-slate-600" dir="ltr">
                        {details.buyerPhone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-600">تاريخ البيع</span>
                  <span className="text-slate-800">
                    {details.soldAt
                      ? String(details.soldAt).slice(0, 10)
                      : "-"}
                  </span>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleOpenOrder}
                    disabled={!details.orderId || isOrderLoading}
                    className="w-full rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isOrderLoading
                      ? "جاري تحميل الطلب..."
                      : details.orderId
                        ? "عرض الطلب"
                        : "لا يوجد طلب مرتبط بهذه البطاقة"}
                  </button>
                </div>
              </>
            )}

            {dialogError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {dialogError}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={onCancel}
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  };

  const handleEditCard = useCallback(
    async (cardId, payload) => {
      if (!cardId) {
        return { ok: false, error: "تعذر تحديد البطاقة." };
      }
      setCardActionId(cardId);
      try {
        const body = {
          serialNumber: payload.serialNumber?.trim(),
          code: payload.code?.trim(),
          pin: payload.pin?.trim() || null,
          expiryDate: payload.expiryDate || null,
        };

        if (!body.serialNumber || !/^[0-9]{15}$/.test(body.serialNumber)) {
          return { ok: false, error: "الرقم التسلسلي يجب أن يكون 15 رقما." };
        }
        if (!body.code) {
          return { ok: false, error: "الكود مطلوب." };
        }

        if (payload.isAvailable) {
          body.soldTo = null;
          body.soldAt = null;
        }

        await axiosClient.patch("/cards", body, {
          params: { id: cardId },
        });
        await fetchCardsByCategory();
        return { ok: true };
      } catch (err) {
        const code = err?.response?.data?.code;
        return { ok: false, error: getCardUpdateErrorMessage(code) };
      } finally {
        setCardActionId(null);
      }
    },
    [fetchCardsByCategory],
  );

  const handleDeleteCard = useCallback(
    async (cardId) => {
      if (!cardId) {
        return { ok: false, error: "تعذر تحديد البطاقة." };
      }
      setCardActionId(cardId);
      try {
        await axiosClient.delete("/cards", {
          params: { id: cardId },
        });
        await fetchCardsByCategory();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: "تعذر حذف البطاقة. حاول مرة أخرى." };
      } finally {
        setCardActionId(null);
      }
    },
    [fetchCardsByCategory],
  );

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف البطاقات
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          سيتم حذف {selectedIds.size} بطاقة. هل تريد المتابعة؟
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
              setIsBulkDeleting(true);
              setError("");
              try {
                await axiosClient.delete("/cards/bulk", {
                  data: { ids: Array.from(selectedIds) },
                });
                closeDialog();
                setSelectedIds(new Set());
                await fetchCardsByCategory();
              } catch (err) {
                setError("تعذر حذف البطاقات المحددة. حاول مرة أخرى.");
              } finally {
                setIsBulkDeleting(false);
              }
            }}
            disabled={isBulkDeleting}
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">البطاقات</h1>
            <p className="mt-1 text-sm text-slate-600">
              جميع البطاقات المتاحة حسب التصنيف
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">
              المحدد: {selectedIds.size}
            </span>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || isBulkDeleting}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              حذف المحدد
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-4 px-1">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">الفرز حسب</span>
            <select
              className="rounded-xl border border-slate-200 px-2 py-1 text-xs"
              value={sortBy}
              onChange={(event) => {
                updateQueryState({ sortBy: event.target.value, page: 1 });
              }}
            >
              <option value="serialNumber">الرقم التسلسلي</option>
              <option value="isSold">الحالة</option>
              <option value="typeName">نوع البطاقة</option>
              <option value="tierTitle">الفئة</option>
              <option value="createdAt">تاريخ الإنشاء</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">الترتيب</span>
            <select
              className="rounded-xl border border-slate-200 px-2 py-1 text-xs"
              value={sortOrder}
              onChange={(event) => {
                updateQueryState({ sortOrder: event.target.value, page: 1 });
              }}
            >
              <option value="asc">تصاعدي</option>
              <option value="desc">تنازلي</option>
            </select>
          </div>
          <div className="text-sm text-slate-600">
            إجمالي البطاقات: {totalCards}
          </div>
        </div>

        <FilterBar
          fields={[
            {
              key: "searchType",
              type: "select",
              label: "نوع البحث",
              options: CARD_SEARCH_TYPE_OPTIONS,
            },
            {
              key: "searchQuery",
              type: "text",
              label: "بحث",
              placeholder:
                CARD_SEARCH_TYPE_PLACEHOLDERS[draftFilters.searchType] ||
                CARD_SEARCH_TYPE_PLACEHOLDERS.serialNumber,
              colSpan: 2,
            },
            {
              key: "typeId",
              type: "select",
              label: "نوع البطاقة",
              options: [
                { value: "", label: "الكل" },
                ...types.map((type) => ({
                  value: type._id,
                  label: getDisplayName(type.name),
                })),
              ],
            },
            {
              key: "isSold",
              type: "select",
              label: "الحالة",
              options: [
                { value: "", label: "الكل" },
                { value: "false", label: "متاح" },
                { value: "true", label: "مباع" },
              ],
            },
            { key: "startDate", type: "date", label: "من تاريخ" },
            { key: "endDate", type: "date", label: "إلى تاريخ" },
          ]}
          values={draftFilters}
          onChange={(key, value) =>
            setDraftFilters((prev) => ({ ...prev, [key]: value }))
          }
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
        />

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50 px-4 py-3">
            {isLoadingCategories ? (
              <span className="text-sm text-slate-600">
                جاري تحميل التصنيفات...
              </span>
            ) : categories.length === 0 ? (
              <span className="text-sm text-slate-600">لا توجد تصنيفات</span>
            ) : (
              categories.map((category) => (
                <button
                  key={category._id}
                  type="button"
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
                    activeCategoryId === category._id
                      ? "border-primary bg-primary text-white"
                      : "border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                  onClick={() => handleCategorySelect(category._id)}
                >
                  {getDisplayName(category.name)}
                </button>
              ))
            )}
          </div>

          {error ? (
            <div className="px-4 py-10 text-center text-sm text-red-500">
              {error}
            </div>
          ) : isLoadingCards ? (
            <div className="px-4 py-10 text-center text-sm text-slate-600">
              جاري تحميل البطاقات...
            </div>
          ) : cards.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-600">
              لا توجد بطاقات للعرض
            </div>
          ) : (
            <>
              <Table
                columns={tableColumns}
                pagination={{
                  page: cardsPage,
                  totalPages,
                  onPageChange: setCardsPage,
                }}
              >
                <TableHead columns={tableColumns} />
                <TableBody>
                  {cards.map((card, index) => (
                    <TableRow key={card._id}>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(card._id)}
                          onChange={() => toggleSelectOne(card._id)}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                        />
                      </TableCell>
                      <TableCell className="text-center text-slate-600">
                        {(cardsPage - 1) * CARDS_PER_PAGE + index + 1}
                      </TableCell>
                      <TableCell className=" text-slate-600" dir="ltr">
                        {renderSerialNumber(card.serialNumber)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between w-fit gap-2">
                          <span
                            className="font-mono text-sm min-w-60 text-slate-700"
                            dir="ltr"
                          >
                            {visibleCodes[card._id]
                              ? renderSerialNumber(card.code) || "-"
                              : maskCode(card.code)}
                          </span>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
                            onClick={() => toggleCodeVisibility(card._id)}
                            aria-label={
                              visibleCodes[card._id]
                                ? "إخفاء الكود"
                                : "إظهار الكود"
                            }
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {getDisplayName(card.typeName) || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge tone={soldTones[Boolean(card.isSold)]}>
                          {soldLabels[Boolean(card.isSold)]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {getDisplayName(card.tierTitle) || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {card.buyerName ? (
                          <div>
                            <div className="font-semibold">
                              {card.buyerName}
                            </div>
                            {card.buyerPhone && (
                              <div className="text-xs text-slate-600">
                                {card.buyerPhone}
                              </div>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            onClick={() =>
                              openDialog(
                                <CardDetailsDialog
                                  card={card}
                                  onCancel={closeDialog}
                                />,
                              )
                            }
                          >
                            تفاصيل
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            onClick={() =>
                              openDialog(
                                <EditCardDialog
                                  card={card}
                                  onSave={(payload) =>
                                    handleEditCard(card._id, payload)
                                  }
                                  onCancel={closeDialog}
                                />,
                              )
                            }
                            disabled={cardActionId === card._id}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                            onClick={() =>
                              openDialog(
                                <DeleteCardDialog
                                  cardCode={card.serialNumber || card.code}
                                  onDelete={() => handleDeleteCard(card._id)}
                                  onCancel={closeDialog}
                                />,
                              )
                            }
                            disabled={cardActionId === card._id}
                          >
                            حذف
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Cards;
