import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import CustomInput from "components/CustomInput";
import DateInput from "components/DateInput";
import PrimaryBtn from "components/PrimaryBtn";
import Badge from "components/Badge";
import SubmitBtn from "components/SubmitBtn";
import RedBtn from "components/RedBtn";
import FilterBar from "components/FilterBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components/Table";
import axiosClient from "utils/AxiosClient";
import { useDialog } from "components/dialog/DialogContext";
import { useBreadcrumb } from "components/breadcrumb/BreadcrumbContext";
import EyeIcon from "assets/icons/eye.svg?react";
import useQueryParamsState from "hooks/useQueryParamsState";

const getDisplayName = (name) => name?.ar || name?.en || "";

const FieldRow = ({ label, span2, children }) => (
  <div
    className={`rounded-2xl border border-slate-200 bg-white/80 p-4 ${
      span2 ? "lg:col-span-2" : ""
    }`}
  >
    <div className="mb-1.5 text-xs text-slate-600">{label}</div>
    <div className="text-sm text-slate-800">{children}</div>
  </div>
);

const CARD_TIER_INITIAL_FILTERS = {
  serialNumber: "",
  isSold: "",
  startDate: "",
  endDate: "",
};

const CARD_TIER_QUERY_DEFAULTS = {
  cardPage: 1,
  ...CARD_TIER_INITIAL_FILTERS,
};

const CARD_TIER_FILTER_FIELDS = [
  {
    key: "serialNumber",
    type: "text",
    label: "الرقم التسلسلي",
    placeholder: "ابحث بالرقم التسلسلي",
    colSpan: 2,
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
];

const CardTier = () => {
  const CARDS_PER_PAGE = 10;
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryState, updateQueryState] = useQueryParamsState(
    CARD_TIER_QUERY_DEFAULTS,
  );
  const cardTierId = searchParams.get("cardTierId");
  const cardTypeId = searchParams.get("cardTypeId");
  const [cardTierTitleAr, setCardTierTitleAr] = useState("");
  const [cardTierTitleEn, setCardTierTitleEn] = useState("");
  const cardTierTitle = cardTierTitleAr || cardTierTitleEn;
  const [cardTypeName, setCardTypeName] = useState("");
  const [cardTypeFulfillmentSource, setCardTypeFulfillmentSource] =
    useState("local");
  const [tier, setTier] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState([]);
  const [cardsTotal, setCardsTotal] = useState(0);
  const [cardsTotalPages, setCardsTotalPages] = useState(1);
  const [isCardsLoading, setIsCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState("");
  const cardsPage = queryState.cardPage;
  const setCardsPage = useCallback(
    (nextPage) => updateQueryState({ cardPage: nextPage }),
    [updateQueryState],
  );
  const [visibleCodes, setVisibleCodes] = useState({});
  const [cardActionId, setCardActionId] = useState(null);
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [isBulkDeletingCards, setIsBulkDeletingCards] = useState(false);
  const cardFilters = useMemo(
    () => ({
      serialNumber: queryState.serialNumber,
      isSold: queryState.isSold,
      startDate: queryState.startDate,
      endDate: queryState.endDate,
    }),
    [
      queryState.serialNumber,
      queryState.isSold,
      queryState.startDate,
      queryState.endDate,
    ],
  );
  const [draftCardFilters, setDraftCardFilters] = useState(cardFilters);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [draftTitleAr, setDraftTitleAr] = useState("");
  const [draftTitleEn, setDraftTitleEn] = useState("");
  const [draftBuyPrice, setDraftBuyPrice] = useState("");
  const [draftBuyPriceUsd, setDraftBuyPriceUsd] = useState("");
  const [draftSellPrice, setDraftSellPrice] = useState("");
  const [draftBambooProductId, setDraftBambooProductId] = useState("");
  const [draftBambooValue, setDraftBambooValue] = useState("");
  const [draftIsActive, setDraftIsActive] = useState(true);
  const { openDialog, closeDialog } = useDialog();
  const { setLevels } = useBreadcrumb();
  const cardIdsOnPage = cards.map((card) => card._id).filter(Boolean);
  const isAllCardsSelected =
    cardIdsOnPage.length > 0 &&
    cardIdsOnPage.every((id) => selectedCardIds.has(id));

  const toggleSelectAllCards = () => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (isAllCardsSelected) {
        cardIdsOnPage.forEach((id) => next.delete(id));
      } else {
        cardIdsOnPage.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectOneCard = (cardId) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const cardsTableColumns = [
    {
      key: "select",
      label: (
        <input
          type="checkbox"
          checked={isAllCardsSelected}
          onChange={toggleSelectAllCards}
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
    {
      key: "status",
      label: "الحالة",
      width: "140px",
      className: "text-center",
    },
    {
      key: "actions",
      label: "إجراءات",
      width: "170px",
      className: "text-left",
    },
  ];
  const soldLabels = {
    true: "مباع",
    false: "متاح",
  };
  const soldTones = {
    true: "danger",
    false: "success",
  };

  const toggleCodeVisibility = (cardId) => {
    setVisibleCodes((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const maskCode = (value) => {
    if (!value) return "-";
    const length = Math.max(6, Math.min(value.length, 16));
    return "*".repeat(length);
  };

  const renderSerialNumber = (value) => {
    if (!value) return "-";
    const groups = String(value)
      .replace(/\s+/g, "")
      .match(/.{1,4}/g);
    if (!groups) return "-";
    return (
      <span dir="ltr" className="inline-flex gap-1">
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
        return "تعذر إنشاء البطاقة. حاول مرة أخرى.";
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

  const fetchTier = useCallback(async () => {
    if (!cardTypeId) {
      setError("تعذر تحديد نوع البطاقة.");
      setTier(null);
      return;
    }
    if (!cardTierId) {
      setError("تعذر تحديد فئة البطاقة.");
      setTier(null);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const [tiersResponse, typeResponse] = await Promise.all([
        axiosClient.get("/card-tiers", {
          params: { typeId: cardTypeId },
        }),
        axiosClient.get("/card-types/get-one", {
          params: { id: cardTypeId },
        }),
      ]);
      const payload = tiersResponse.data ?? {};
      const typePayload = typeResponse.data ?? {};
      const list = Array.isArray(payload.tiers) ? payload.tiers : [];
      const found = list.find((item) => item._id === cardTierId);
      if (!found) {
        setError("تعذر العثور على فئة البطاقة المطلوبة.");
        setTier(null);
      } else {
        setTier(found);
        setCardTierTitleAr(found.title?.ar ?? "");
        setCardTierTitleEn(found.title?.en ?? "");
        setCardTypeName(
          getDisplayName(typePayload.name) || getDisplayName(payload.name),
        );
        setCardTypeFulfillmentSource(typePayload.fulfillmentSource ?? "local");
        setLevels([
          { key: "categories", label: "التصنيفات" },
          {
            key: "category",
            label: getDisplayName(payload.categoryName) || "تصنيف",
          },
          { key: "cardType", label: getDisplayName(payload.name) || "نوع بطاقة" },
          {
            key: "cardTier",
            label: getDisplayName(found.title) || "فئة بطاقة",
          },
        ]);
        if (!isEditing) {
          setDraftTitleAr(found.title?.ar ?? "");
          setDraftTitleEn(found.title?.en ?? "");
          setDraftBuyPrice(found.buyPrice ?? "");
          setDraftBuyPriceUsd(found.buyPriceUsd ?? "");
          setDraftSellPrice(found.sellPrice ?? "");
          setDraftBambooProductId(found.bambooProductId ?? "");
          setDraftBambooValue(found.value ?? "");
          setDraftIsActive(found.isActive ?? true);
        }
      }
    } catch (err) {
      setError("تعذر تحميل تفاصيل فئة البطاقة. حاول مرة أخرى.");
      setTier(null);
    } finally {
      setIsLoading(false);
    }
  }, [cardTierId, cardTypeId, isEditing]);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  const fetchCards = useCallback(async () => {
    if (!cardTierId) {
      setCards([]);
      setCardsTotal(0);
      setCardsTotalPages(1);
      return;
    }
    setIsCardsLoading(true);
    setCardsError("");
    try {
      const response = await axiosClient.get("/cards", {
        params: {
          tierId: cardTierId,
          page: cardsPage,
          limit: CARDS_PER_PAGE,
          ...(cardFilters.serialNumber
            ? { serialNumber: cardFilters.serialNumber.trim() }
            : {}),
          ...(cardFilters.isSold ? { isSold: cardFilters.isSold } : {}),
          ...(cardFilters.startDate
            ? { startDate: cardFilters.startDate }
            : {}),
          ...(cardFilters.endDate ? { endDate: cardFilters.endDate } : {}),
        },
      });
      const payload = response.data;
      if (Array.isArray(payload)) {
        setCards(payload);
        setCardsTotal(payload.length);
        setCardsTotalPages(
          Math.max(1, Math.ceil(payload.length / CARDS_PER_PAGE)),
        );
      } else {
        const list = Array.isArray(payload?.cards) ? payload.cards : [];
        setCards(list);
        const total = Number(payload?.total) || 0;
        const totalPages = Number(payload?.totalPages) || 1;
        setCardsTotal(total);
        setCardsTotalPages(Math.max(1, totalPages));
      }
    } catch (err) {
      setCardsError("تعذر تحميل البطاقات. حاول مرة أخرى.");
      setCards([]);
      setCardsTotal(0);
      setCardsTotalPages(1);
    } finally {
      setIsCardsLoading(false);
    }
  }, [cardTierId, cardsPage, cardFilters]);

  useEffect(() => {
    setDraftCardFilters(cardFilters);
  }, [
    cardFilters.serialNumber,
    cardFilters.isSold,
    cardFilters.startDate,
    cardFilters.endDate,
  ]);

  useEffect(() => {
    if (cardsPage > cardsTotalPages) {
      setCardsPage(cardsTotalPages);
    }
  }, [cardsPage, cardsTotalPages]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    setSelectedCardIds(new Set());
  }, [cardTierId, cardsPage, cardFilters]);

  const handleApplyCardFilters = (event) => {
    event?.preventDefault?.();
    updateQueryState({
      ...draftCardFilters,
      cardPage: 1,
      ...Object.fromEntries(
        Object.keys(draftCardFilters).map((key) => [`draft_${key}`, null]),
      ),
    });
  };

  const handleClearCardFilters = (draftKeys = []) => {
    setDraftCardFilters(CARD_TIER_INITIAL_FILTERS);
    updateQueryState({
      ...CARD_TIER_INITIAL_FILTERS,
      cardPage: 1,
      ...Object.fromEntries(draftKeys.map((key) => [`draft_${key}`, null])),
    });
  };

  const handleDeleteTier = useCallback(async () => {
    if (!cardTierId) {
      return { ok: false, error: "تعذر تحديد فئة البطاقة." };
    }
    try {
      await axiosClient.delete("/card-tiers", {
        params: { id: cardTierId },
      });
      setSearchParams((prev) => {
        prev.delete("cardTierId");
        return prev;
      });
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "CARD_TIER_HAS_CARDS") {
        return {
          ok: false,
          error: "لا يمكن حذف الفئة طالما تحتوي على بطاقات.",
        };
      }
      return { ok: false, error: "تعذر حذف فئة البطاقة. حاول مرة أخرى." };
    }
  }, [cardTierId, setSearchParams]);

  const handleEditTier = useCallback(
    async ({
      titleAr,
      titleEn,
      buyPrice,
      buyPriceUsd,
      sellPrice,
      bambooProductId,
      value,
      isActive,
    }) => {
      if (!cardTierId) {
        return { ok: false, error: "تعذر تحديد فئة البطاقة." };
      }
      if ((buyPrice === "" && buyPriceUsd === "") || sellPrice === "") {
        return {
          ok: false,
          error: "سعر الشراء (أو بالدولار) وسعر البيع مطلوبان.",
        };
      }
      const nextBambooProductId = bambooProductId?.trim() ?? "";
      const nextBambooValue =
        value === "" || value === null || value === undefined
          ? ""
          : Number(value);
      if (cardTypeFulfillmentSource === "bamboo") {
        if (!nextBambooProductId) {
          return { ok: false, error: "معرف منتج Bamboo مطلوب." };
        }
        if (
          nextBambooValue === "" ||
          Number.isNaN(nextBambooValue) ||
          nextBambooValue <= 0
        ) {
          return { ok: false, error: "قيمة Bamboo مطلوبة." };
        }
      }
      try {
        await axiosClient.patch(
          "/card-tiers",
          {
            titleAr: titleAr?.trim() ?? "",
            titleEn: titleEn?.trim() ?? "",
            buyPrice:
              buyPrice === "" || buyPrice === null ? null : Number(buyPrice),
            buyPriceUsd:
              buyPriceUsd === "" || buyPriceUsd === null
                ? null
                : Number(buyPriceUsd),
            sellPrice: Number(sellPrice),
            bambooProductId:
              cardTypeFulfillmentSource === "bamboo" ? nextBambooProductId : "",
            value:
              cardTypeFulfillmentSource === "bamboo" ? nextBambooValue : null,
            isActive,
          },
          { params: { id: cardTierId } },
        );
        await fetchTier();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: "تعذر تعديل فئة البطاقة. حاول مرة أخرى." };
      }
    },
    [cardTierId, cardTypeFulfillmentSource, fetchTier],
  );

  const DeleteTierDialog = ({ tierTitle, onDelete, onCancel }) => {
    const [dialogError, setDialogError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف فئة البطاقة
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          سيتم حذف جميع البطاقات المرتبطة بفئة
          <span className="font-semibold text-slate-800"> {tierTitle}</span>. هل
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

  const CreateCardDialog = ({ onCreate, onCancel }) => {
    const [serialNumber, setSerialNumber] = useState("");
    const [code, setCode] = useState("");
    const [pin, setPin] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [dialogError, setDialogError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          إنشاء بطاقة جديدة
        </h2>
        <div className="mt-4 space-y-3">
          <CustomInput
            autoFocus
            label="الرقم التسلسلي (اختياري)"
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
              const result = await onCreate({
                serialNumber,
                code,
                pin,
                expiryDate,
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
            إنشاء
          </SubmitBtn>
        </div>
      </div>
    );
  };

  const EditCardDialog = ({ card, onSave, onCancel }) => {
    const [serialNumber, setSerialNumber] = useState(card?.serialNumber ?? "");
    const [code, setCode] = useState(card?.code ?? "");
    const [pin, setPin] = useState(card?.pin ?? "");
    const [expiryDate, setExpiryDate] = useState(
      card?.expiryDate ? String(card.expiryDate).slice(0, 10) : "",
    );
    const [isAvailable, setIsAvailable] = useState(!card?.soldTo);
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

  const ImportCardsDialog = ({ onImport, onCancel }) => {
    const [file, setFile] = useState(null);
    const [dialogError, setDialogError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          استيراد بطاقات من Excel
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          يجب أن يحتوي الملف على عمود واحد للأكواد فقط.
        </p>
        <div className="mt-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-2 file:text-sm file:text-slate-600 hover:file:bg-slate-100"
          />
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
              const result = await onImport(file);
              if (result?.ok) {
                onCancel();
              } else if (result?.error) {
                setDialogError(result.error);
              }
              setIsSubmitting(false);
            }}
            disabled={isSubmitting}
          >
            استيراد
          </SubmitBtn>
        </div>
      </div>
    );
  };

  const handleEditStart = () => {
    if (!tier) return;
    setSuccessMessage("");
    setImportMessage("");
    setDraftTitleAr(tier.title?.ar ?? "");
    setDraftTitleEn(tier.title?.en ?? "");
    setDraftBuyPrice(tier.buyPrice ?? "");
    setDraftSellPrice(tier.sellPrice ?? "");
    setDraftBambooProductId(tier.bambooProductId ?? "");
    setDraftBambooValue(tier.value ?? "");
    setDraftIsActive(tier.isActive ?? true);
    setEditError("");
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    if (tier) {
      setDraftTitleAr(tier.title?.ar ?? "");
      setDraftTitleEn(tier.title?.en ?? "");
      setDraftBuyPrice(tier.buyPrice ?? "");
      setDraftSellPrice(tier.sellPrice ?? "");
      setDraftBambooProductId(tier.bambooProductId ?? "");
      setDraftBambooValue(tier.value ?? "");
      setDraftIsActive(tier.isActive ?? true);
    }
    setSuccessMessage("");
    setImportMessage("");
    setEditError("");
    setIsEditing(false);
  };

  const handleEditSave = async () => {
    setIsSaving(true);
    setEditError("");
    const result = await handleEditTier({
      titleAr: draftTitleAr,
      titleEn: draftTitleEn,
      buyPrice: draftBuyPrice,
      buyPriceUsd: draftBuyPriceUsd,
      sellPrice: draftSellPrice,
      bambooProductId: draftBambooProductId,
      value: draftBambooValue,
      isActive: draftIsActive,
    });
    if (result?.ok) {
      setIsEditing(false);
    } else if (result?.error) {
      setEditError(result.error);
    }
    setIsSaving(false);
  };

  const handleOpenDeleteDialog = () => {
    openDialog(
      <DeleteTierDialog
        tierTitle={getDisplayName(tier?.title) || "-"}
        onDelete={handleDeleteTier}
        onCancel={closeDialog}
      />,
    );
  };

  const handleOpenCreateCardDialog = () => {
    setSuccessMessage("");
    setImportMessage("");
    openDialog(
      <CreateCardDialog onCreate={handleCreateCard} onCancel={closeDialog} />,
    );
  };

  const handleOpenImportDialog = () => {
    setSuccessMessage("");
    setImportMessage("");
    openDialog(
      <ImportCardsDialog onImport={handleImportCards} onCancel={closeDialog} />,
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
        await fetchCards();
        return { ok: true };
      } catch (err) {
        const code = err?.response?.data?.code;
        return { ok: false, error: getCardUpdateErrorMessage(code) };
      } finally {
        setCardActionId(null);
      }
    },
    [fetchCards],
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
        await fetchCards();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: "تعذر حذف البطاقة. حاول مرة أخرى." };
      } finally {
        setCardActionId(null);
      }
    },
    [fetchCards],
  );

  const handleDeleteSelectedCards = () => {
    if (selectedCardIds.size === 0) return;

    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف البطاقات
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          سيتم حذف {selectedCardIds.size} بطاقة. هل تريد المتابعة؟
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
              setIsBulkDeletingCards(true);
              setCardsError("");
              try {
                await axiosClient.delete("/cards/bulk", {
                  data: { ids: Array.from(selectedCardIds) },
                });
                closeDialog();
                setSelectedCardIds(new Set());
                await fetchCards();
              } catch (err) {
                setCardsError("تعذر حذف البطاقات المحددة. حاول مرة أخرى.");
              } finally {
                setIsBulkDeletingCards(false);
              }
            }}
            disabled={isBulkDeletingCards}
          >
            حذف
          </RedBtn>
        </div>
      </div>,
    );
  };

  const handleCreateCard = useCallback(
    async ({ serialNumber, code, pin, expiryDate }) => {
      if (!cardTierId) {
        return { ok: false, error: "تعذر تحديد فئة البطاقة." };
      }
      if (!code?.trim()) {
        return { ok: false, error: "الكود مطلوب." };
      }
      if (serialNumber?.trim() && !/^\d{15}$/.test(serialNumber.trim())) {
        return { ok: false, error: "الرقم التسلسلي يجب أن يكون 15 رقما." };
      }

      const payload = {
        tierId: cardTierId,
        code: code.trim(),
        pin: pin?.trim() || null,
        expiryDate: expiryDate || null,
      };

      if (serialNumber?.trim()) {
        payload.serialNumber = serialNumber.trim();
      }

      try {
        await axiosClient.post("/cards", payload);
        setSuccessMessage("تم إنشاء البطاقة بنجاح.");
        await fetchCards();
        return { ok: true };
      } catch (err) {
        const errorCode = err?.response?.data?.code;
        return { ok: false, error: getCardErrorMessage(errorCode) };
      }
    },
    [cardTierId, fetchCards],
  );

  const handleImportCards = useCallback(
    async (file) => {
      if (!cardTierId) {
        return { ok: false, error: "تعذر تحديد فئة البطاقة." };
      }
      if (!file) {
        return { ok: false, error: "الرجاء اختيار ملف Excel." };
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("tierId", cardTierId);

      try {
        const response = await axiosClient.post("/cards/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const payload = response.data ?? {};
        setImportMessage(`تم استيراد ${payload.created ?? 0} بطاقة بنجاح.`);
        await fetchCards();
        return { ok: true };
      } catch (err) {
        const code = err?.response?.data?.code;
        if (code === "CARD_IMPORT_FILE_REQUIRED") {
          return { ok: false, error: "الرجاء اختيار ملف Excel." };
        }
        if (code === "CARD_IMPORT_EMPTY") {
          return { ok: false, error: "الملف لا يحتوي على أكواد صالحة." };
        }
        if (code === "CARD_TIER_ID_INVALID" || code === "CARD_TIER_NOT_FOUND") {
          return { ok: false, error: "تعذر العثور على فئة البطاقة." };
        }
        return { ok: false, error: "تعذر استيراد البطاقات. حاول مرة أخرى." };
      }
    },
    [cardTierId, fetchCards],
  );

  return (
    <div className="px-4 py-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            تفاصيل فئة البطاقة
          </h1>

          {cardTypeName && (
            <p className="my-2 text">
              {cardTypeName} - {cardTierTitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <SubmitBtn onClick={handleEditSave} disabled={isSaving}>
                حفظ
              </SubmitBtn>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                onClick={handleEditCancel}
                disabled={isSaving}
              >
                إلغاء
              </button>
            </>
          ) : (
            <>
              <PrimaryBtn onClick={handleOpenCreateCardDialog}>
                إنشاء بطاقة جديدة
              </PrimaryBtn>
              <PrimaryBtn onClick={handleOpenImportDialog}>
                استيراد من Excel
              </PrimaryBtn>
              <PrimaryBtn onClick={handleEditStart} disabled={!tier}>
                تعديل
              </PrimaryBtn>
              <RedBtn
                onClick={handleOpenDeleteDialog}
                title={
                  cardsTotal > 0
                    ? "لا يمكن حذف الفئة طالما تحتوي على بطاقات"
                    : undefined
                }
              >
                حذف
              </RedBtn>
            </>
          )}
        </div>
      </div>

      {editError && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {editError}
        </div>
      )}
      {successMessage && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}
      {importMessage && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {importMessage}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600">
          جاري تحميل التفاصيل...
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
          {error}
        </div>
      ) : !tier ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600">
          لا توجد تفاصيل للعرض
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FieldRow label="العنوان" span2>
                {isEditing ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <CustomInput
                      placeholder="عربي"
                      value={draftTitleAr}
                      onChange={(event) =>
                        setDraftTitleAr(event.target.value)
                      }
                    />
                    <CustomInput
                      placeholder="English"
                      value={draftTitleEn}
                      onChange={(event) =>
                        setDraftTitleEn(event.target.value)
                      }
                    />
                  </div>
                ) : (
                  getDisplayName(tier.title) || "-"
                )}
              </FieldRow>

              <FieldRow label="سعر الشراء">
                {isEditing ? (
                  <CustomInput
                    type="number"
                    value={draftBuyPrice}
                    onChange={(event) => setDraftBuyPrice(event.target.value)}
                  />
                ) : (
                  tier.buyPrice
                )}
              </FieldRow>

              <FieldRow label="سعر الشراء بالدولار">
                {isEditing ? (
                  <CustomInput
                    type="number"
                    value={draftBuyPriceUsd}
                    onChange={(event) =>
                      setDraftBuyPriceUsd(event.target.value)
                    }
                    placeholder="اتركه فارغًا إذا لم يكن مطلوبًا"
                  />
                ) : (
                  tier.buyPriceUsd || "-"
                )}
              </FieldRow>

              <FieldRow label="سعر البيع">
                {isEditing ? (
                  <CustomInput
                    type="number"
                    value={draftSellPrice}
                    onChange={(event) =>
                      setDraftSellPrice(event.target.value)
                    }
                  />
                ) : (
                  tier.sellPrice
                )}
              </FieldRow>

              {cardTypeFulfillmentSource === "bamboo" && (
                <>
                  <FieldRow label="Bamboo Product ID">
                    {isEditing ? (
                      <CustomInput
                        value={draftBambooProductId}
                        onChange={(event) =>
                          setDraftBambooProductId(event.target.value)
                        }
                      />
                    ) : (
                      tier.bambooProductId || "-"
                    )}
                  </FieldRow>

                  <FieldRow label="Bamboo Value">
                    {isEditing ? (
                      <CustomInput
                        type="number"
                        value={draftBambooValue}
                        onChange={(event) =>
                          setDraftBambooValue(event.target.value)
                        }
                      />
                    ) : (
                      tier.value ?? "-"
                    )}
                  </FieldRow>
                </>
              )}

              <FieldRow label="الحالة">
                {isEditing ? (
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={draftIsActive}
                      onChange={(event) =>
                        setDraftIsActive(event.target.checked)
                      }
                    />
                    مفعّل
                  </label>
                ) : (
                  <Badge tone={tier.isActive ? "success" : "neutral"}>
                    {tier.isActive ? "مفعّل" : "غير مفعّل"}
                  </Badge>
                )}
              </FieldRow>
            </div>
          </div>

          <FilterBar
            fields={CARD_TIER_FILTER_FIELDS}
            values={draftCardFilters}
            onChange={(key, value) =>
              setDraftCardFilters((prev) => ({ ...prev, [key]: value }))
            }
            onApply={handleApplyCardFilters}
            onClear={handleClearCardFilters}
            gridClassName="grid gap-4 lg:grid-cols-4"
          />

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span>بطاقات الفئة</span>
              <div className="flex flex-wrap items-center gap-3">
                <span>الإجمالي: {cardsTotal}</span>
                <span>المحدد: {selectedCardIds.size}</span>
                <button
                  type="button"
                  onClick={handleDeleteSelectedCards}
                  disabled={selectedCardIds.size === 0 || isBulkDeletingCards}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs text-white disabled:opacity-60"
                >
                  حذف المحدد
                </button>
              </div>
            </div>
            {isCardsLoading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-600">
                جاري تحميل البطاقات...
              </div>
            ) : cardsError ? (
              <div className="px-4 py-8 text-center text-sm text-rose-700">
                {cardsError}
              </div>
            ) : cards.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-600">
                لا توجد بطاقات للعرض
              </div>
            ) : (
              <>
                <Table
                  columns={cardsTableColumns}
                  pagination={{
                    page: cardsPage,
                    totalPages: cardsTotalPages,
                    onPageChange: setCardsPage,
                  }}
                >
                  <TableHead columns={cardsTableColumns} />
                  <TableBody>
                    {cards.map((card, index) => (
                      <TableRow key={card._id}>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={selectedCardIds.has(card._id)}
                            onChange={() => toggleSelectOneCard(card._id)}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                          />
                        </TableCell>
                        <TableCell className="text-center text-slate-600">
                          {(cardsPage - 1) * CARDS_PER_PAGE + index + 1}
                        </TableCell>
                        <TableCell className=" text-slate-700" dir="ltr">
                          {renderSerialNumber(card.serialNumber)}
                        </TableCell>
                        <TableCell className="flex justify-center">
                          <div className="flex items-center justify-between w-fit gap-2">
                            <span className="font-mono text-sm min-w-60 text-slate-700">
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
                        <TableCell className="text-center">
                          <Badge tone={soldTones[Boolean(card.soldTo)]}>
                            {soldLabels[Boolean(card.soldTo)]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center justify-end gap-2">
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
        </>
      )}
    </div>
  );
};

export default CardTier;
