import { useCallback, useEffect, useState } from "react";

import Layout from "layout";
import axiosClient from "utils/AxiosClient";
import CustomInput from "components/CustomInput";
import ToggleSwitch from "components/ToggleSwitch";
import Badge from "components/Badge";
import PrimaryBtn from "components/PrimaryBtn";
import SubmitBtn from "components/SubmitBtn";
import RedBtn from "components/RedBtn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components/Table";
import { useDialog } from "components/dialog/DialogContext";
import formatArabicDate from "utils/formatArabicDate";

const getDisplayName = (name) => name?.ar || name?.en || "";

const selectClassName =
  "rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400";

const translateDiscountError = (code, fallback) => {
  const map = {
    DISCOUNT_TIER_ID_REQUIRED: "يجب اختيار فئة البطاقة.",
    DISCOUNT_PERCENTAGE_INVALID: "نسبة التخفيض يجب أن تكون بين 1 و 100.",
    CARD_TIER_NOT_FOUND: "فئة البطاقة غير موجودة.",
    DISCOUNT_TIER_ALREADY_EXISTS: "يوجد تخفيض مسجل مسبقًا لهذه الفئة.",
    DISCOUNT_NOT_FOUND: "التخفيض غير موجود.",
  };
  return map[code] || fallback || code || "حدث خطأ. حاول مرة أخرى.";
};

const TierPicker = ({
  categoryId,
  typeId,
  tierId,
  onCategoryChange,
  onTypeChange,
  onTierChange,
}) => {
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);

  useEffect(() => {
    axiosClient
      .get("/card-categories")
      .then((response) => setCategories(response.data ?? []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setTypes([]);
      return;
    }
    setIsLoadingTypes(true);
    axiosClient
      .get("/card-types/by-category", { params: { categoryId } })
      .then((response) => setTypes(response.data?.cardTypes ?? []))
      .catch(() => setTypes([]))
      .finally(() => setIsLoadingTypes(false));
  }, [categoryId]);

  useEffect(() => {
    if (!typeId) {
      setTiers([]);
      return;
    }
    setIsLoadingTiers(true);
    axiosClient
      .get("/card-tiers", { params: { typeId } })
      .then((response) => setTiers(response.data?.tiers ?? []))
      .catch(() => setTiers([]))
      .finally(() => setIsLoadingTiers(false));
  }, [typeId]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        <span>الفئة</span>
        <select
          className={selectClassName}
          value={categoryId ?? ""}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">اختر الفئة</option>
          {categories.map((category) => (
            <option key={category._id} value={category._id}>
              {getDisplayName(category.name)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm text-slate-600">
        <span>النوع</span>
        <select
          className={selectClassName}
          value={typeId ?? ""}
          onChange={(event) => onTypeChange(event.target.value)}
          disabled={!categoryId || isLoadingTypes}
        >
          <option value="">اختر النوع</option>
          {types.map((type) => (
            <option key={type._id} value={type._id}>
              {getDisplayName(type.name)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm text-slate-600">
        <span>الفئة السعرية</span>
        <select
          className={selectClassName}
          value={tierId ?? ""}
          onChange={(event) => onTierChange(event.target.value)}
          disabled={!typeId || isLoadingTiers}
        >
          <option value="">اختر الفئة السعرية</option>
          {tiers.map((tier) => (
            <option key={tier._id} value={tier._id}>
              {getDisplayName(tier.title)} ({tier.sellPrice})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};

const DiscountForm = ({ initialValues, onSubmit, onCancel, submitLabel }) => {
  const isEditing = Boolean(initialValues);
  const tier = initialValues?.tierId;

  const [categoryId, setCategoryId] = useState(
    tier?.typeId?.categoryId ?? "",
  );
  const [typeId, setTypeId] = useState(tier?.typeId?._id ?? "");
  const [tierId, setTierId] = useState(tier?._id ?? "");
  const [percentage, setPercentage] = useState(
    initialValues?.percentage ?? "",
  );
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [dialogError, setDialogError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="min-w-80 p-2">
      <h2 className="text-base font-semibold text-slate-800">
        {isEditing ? "تعديل التخفيض" : "إنشاء تخفيض جديد"}
      </h2>
      <div className="mt-4 space-y-3">
        {isEditing ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {getDisplayName(tier?.typeId?.name)} — {getDisplayName(tier?.title)}
          </div>
        ) : (
          <TierPicker
            categoryId={categoryId}
            typeId={typeId}
            tierId={tierId}
            onCategoryChange={(value) => {
              setCategoryId(value);
              setTypeId("");
              setTierId("");
            }}
            onTypeChange={(value) => {
              setTypeId(value);
              setTierId("");
            }}
            onTierChange={setTierId}
          />
        )}
        <CustomInput
          label="نسبة التخفيض (%)"
          type="number"
          min="1"
          max="100"
          value={percentage}
          onChange={(event) => setPercentage(event.target.value)}
          placeholder="مثال: 15"
        />
        <ToggleSwitch label="مفعّل" checked={isActive} onChange={setIsActive} />
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
            if (!isEditing && !tierId) {
              setDialogError("يجب اختيار الفئة السعرية.");
              return;
            }
            const parsedPercentage = Number(percentage);
            if (
              !percentage ||
              Number.isNaN(parsedPercentage) ||
              parsedPercentage < 1 ||
              parsedPercentage > 100
            ) {
              setDialogError("نسبة التخفيض يجب أن تكون بين 1 و 100.");
              return;
            }
            setIsSubmitting(true);
            setDialogError("");
            const result = await onSubmit({
              tierId,
              percentage: parsedPercentage,
              isActive,
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
          {submitLabel}
        </SubmitBtn>
      </div>
    </div>
  );
};

const discountColumns = [
  { key: "type", label: "النوع" },
  { key: "tier", label: "الفئة السعرية" },
  { key: "price", label: "السعر الأصلي" },
  { key: "percentage", label: "نسبة التخفيض" },
  { key: "discounted", label: "السعر بعد التخفيض" },
  { key: "status", label: "الحالة" },
  { key: "createdAt", label: "التاريخ" },
  { key: "actions", label: "إجراءات", className: "text-left" },
];

const Discounts = () => {
  const { openDialog, closeDialog } = useDialog();
  const [discounts, setDiscounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  const fetchDiscounts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/discounts");
      const payload = response.data ?? {};
      setDiscounts(Array.isArray(payload.discounts) ? payload.discounts : []);
    } catch (err) {
      setError("تعذر تحميل التخفيضات. حاول مرة أخرى.");
      setDiscounts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscounts();
  }, [fetchDiscounts]);

  const handleCreate = async ({ tierId, percentage, isActive }) => {
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.post("/discounts", { tierId, percentage, isActive });
      await fetchDiscounts();
      setSuccessMessage("تم إنشاء التخفيض بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      return {
        ok: false,
        error: translateDiscountError(code, "تعذر إنشاء التخفيض. حاول مرة أخرى."),
      };
    }
  };

  const handleUpdate = async (discountId, { percentage, isActive }) => {
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.patch(
        "/discounts",
        { percentage, isActive },
        { params: { id: discountId } },
      );
      await fetchDiscounts();
      setSuccessMessage("تم تعديل التخفيض بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      return {
        ok: false,
        error: translateDiscountError(code, "تعذر تعديل التخفيض. حاول مرة أخرى."),
      };
    }
  };

  const handleDelete = async (discountId) => {
    setDeleteId(discountId);
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.delete("/discounts", { params: { id: discountId } });
      await fetchDiscounts();
      setSuccessMessage("تم حذف التخفيض بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      const translated = translateDiscountError(
        code,
        "تعذر حذف التخفيض. حاول مرة أخرى.",
      );
      setError(translated);
      return { ok: false, error: translated };
    } finally {
      setDeleteId(null);
    }
  };

  const handleOpenCreateDialog = () => {
    openDialog(
      <DiscountForm
        onSubmit={handleCreate}
        onCancel={closeDialog}
        submitLabel="إنشاء"
      />,
    );
  };

  const handleOpenEditDialog = (discount) => {
    openDialog(
      <DiscountForm
        initialValues={discount}
        onSubmit={(values) => handleUpdate(discount._id, values)}
        onCancel={closeDialog}
        submitLabel="حفظ"
      />,
    );
  };

  const handleOpenDeleteDialog = (discount) => {
    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف التخفيض
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          هل أنت متأكد أنك تريد حذف هذا التخفيض؟ لا يمكن التراجع عن ذلك.
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
              await handleDelete(discount._id);
            }}
            disabled={deleteId === discount._id}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              التخفيضات
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              تخفيضات على أسعار فئات البطاقات لحسابات الأفراد فقط - لا تؤثر
              على أسعار حسابات الأعمال.
            </p>
          </div>
          <PrimaryBtn onClick={handleOpenCreateDialog}>
            إنشاء تخفيض جديد
          </PrimaryBtn>
        </div>

        {successMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        <div className="mt-6">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
              جاري تحميل التخفيضات...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : discounts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
              لا توجد تخفيضات حتى الآن.
            </div>
          ) : (
            <Table columns={discountColumns}>
              <TableHead columns={discountColumns} />
              <TableBody>
                {discounts.map((discount) => {
                  const tier = discount.tierId;
                  const sellPrice = Number(tier?.sellPrice) || 0;
                  const discountedPrice =
                    Math.round(
                      (sellPrice * (1 - discount.percentage / 100) +
                        Number.EPSILON) *
                        100,
                    ) / 100;
                  return (
                    <TableRow key={discount._id}>
                      <TableCell>
                        {getDisplayName(tier?.typeId?.name) || "—"}
                      </TableCell>
                      <TableCell>{getDisplayName(tier?.title) || "—"}</TableCell>
                      <TableCell>{sellPrice}</TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                          -{discount.percentage}%
                        </span>
                      </TableCell>
                      <TableCell>{discountedPrice}</TableCell>
                      <TableCell>
                        <Badge tone={discount.isActive ? "success" : "danger"}>
                          {discount.isActive ? "مفعّل" : "غير مفعّل"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {discount.createdAt
                          ? formatArabicDate(discount.createdAt)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            onClick={() => handleOpenEditDialog(discount)}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                            onClick={() => handleOpenDeleteDialog(discount)}
                            disabled={deleteId === discount._id}
                          >
                            حذف
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Discounts;
