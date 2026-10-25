import { useCallback, useEffect, useState } from "react";

import Layout from "layout";
import axiosClient from "utils/AxiosClient";
import CustomInput from "components/CustomInput";
import ImageUpload from "components/ImageUpload";
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

const safeValue = (value, fallback = "—") =>
  value === null || value === undefined || value === "" ? fallback : value;

const paymentMethodColumns = [
  { key: "order", label: "الترتيب", width: "80px" },
  { key: "icon", label: "الأيقونة", width: "80px" },
  { key: "label", label: "الاسم المعروض" },
  { key: "name", label: "المعرّف" },
  { key: "deposit", label: "حدود الشحن" },
  { key: "status", label: "الحالة" },
  { key: "createdAt", label: "التاريخ" },
  { key: "actions", label: "إجراءات", className: "text-left" },
];

const translatePaymentMethodError = (code, fallback) => {
  const map = {
    PAYMENT_METHOD_NAME_REQUIRED: "المعرّف مطلوب.",
    PAYMENT_METHOD_NAME_TAKEN: "هذا المعرّف مستخدم من قبل.",
    PAYMENT_METHOD_LABEL_REQUIRED: "الاسم المعروض مطلوب.",
    PAYMENT_METHOD_ICON_REQUIRED: "أيقونة وسيلة الدفع مطلوبة.",
    PAYMENT_METHOD_MIN_DEPOSIT_INVALID: "الحد الأدنى للشحن غير صالح.",
    PAYMENT_METHOD_MAX_DEPOSIT_INVALID:
      "الحد الأقصى للشحن يجب أن يكون أكبر من الحد الأدنى.",
    PAYMENT_METHOD_DAILY_LIMIT_INVALID: "حد اليوم للمستخدم غير صالح.",
    PAYMENT_METHOD_FEE_INVALID: "قيمة الرسوم غير صالحة.",
    PAYMENT_METHOD_NOT_FOUND: "وسيلة الدفع غير موجودة.",
  };
  return map[code] || fallback || code || "حدث خطأ. حاول مرة أخرى.";
};

const PaymentMethodForm = ({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}) => {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [label, setLabel] = useState(initialValues?.label ?? "");
  const [icon, setIcon] = useState(null);
  const [minDeposit, setMinDeposit] = useState(
    initialValues?.minDeposit?.toString() ?? "",
  );
  const [maxDeposit, setMaxDeposit] = useState(
    initialValues?.maxDeposit?.toString() ?? "",
  );
  const [dailyLimit, setDailyLimit] = useState(
    initialValues?.dailyLimit?.toString() ?? "",
  );
  const [note, setNote] = useState(initialValues?.note ?? "");
  const [fee, setFee] = useState(initialValues?.fee?.toString() ?? "");
  const [active, setActive] = useState(initialValues?.active ?? true);
  const [dialogError, setDialogError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="min-w-70 p-2">
      <h2 className="text-base font-semibold text-slate-800">
        {initialValues ? "تعديل وسيلة الدفع" : "إنشاء وسيلة دفع جديدة"}
      </h2>
      <div className="mt-4 space-y-3">
        <ImageUpload
          label="الأيقونة"
          value={icon}
          onChange={setIcon}
          existingUrl={initialValues?.iconPath ?? ""}
        />
        <CustomInput
          label="معرّف وسيلة الدفع"
          dir="ltr"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="edfali"
        />
        <CustomInput
          label="الاسم المعروض"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="مثال: إدفعلي"
        />
        <CustomInput
          label="حد اليوم لكل مستخدم (اختياري)"
          dir="ltr"
          type="number"
          min="0"
          value={dailyLimit}
          onChange={(event) => setDailyLimit(event.target.value)}
          placeholder="200"
        />
        <CustomInput
          label="ملاحظة الوسيلة (اختياري)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="مثال: يتم خصم 5% عند الشحن"
          maxLength={200}
        />
        <div className="flex gap-3">
          <CustomInput
            label="الحد الأدنى للشحن"
            dir="ltr"
            type="number"
            value={minDeposit}
            onChange={(event) => setMinDeposit(event.target.value)}
            placeholder="1"
          />
          <CustomInput
            label="الحد الأقصى للشحن"
            dir="ltr"
            type="number"
            value={maxDeposit}
            onChange={(event) => setMaxDeposit(event.target.value)}
            placeholder="5000"
          />
        </div>
        <CustomInput
          label="نسبة الرسوم (0.05 = 5%)"
          dir="ltr"
          type="number"
          step="0.01"
          min="0"
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          placeholder="0.05"
        />
        <ToggleSwitch label="مفعّل" checked={active} onChange={setActive} />
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
            if (!name.trim()) {
              setDialogError("المعرّف مطلوب.");
              return;
            }
            if (!label.trim()) {
              setDialogError("الاسم المعروض مطلوب.");
              return;
            }
            if (!initialValues && !icon) {
              setDialogError("أيقونة وسيلة الدفع مطلوبة.");
              return;
            }
            const parsedMin = Number(minDeposit);
            const parsedMax = Number(maxDeposit);
            const parsedFee = Number(fee);
            const parsedDailyLimit =
              dailyLimit.trim() === "" ? null : Number(dailyLimit);
            if (!Number.isFinite(parsedMin) || parsedMin < 0) {
              setDialogError("الحد الأدنى للشحن غير صالح.");
              return;
            }
            if (
              maxDeposit.trim() &&
              (!Number.isFinite(parsedMax) || parsedMax <= parsedMin)
            ) {
              setDialogError(
                "الحد الأقصى للشحن يجب أن يكون أكبر من الحد الأدنى.",
              );
              return;
            }
            if (fee.trim() && (!Number.isFinite(parsedFee) || parsedFee < 0)) {
              setDialogError("قيمة الرسوم غير صالحة.");
              return;
            }
            if (
              dailyLimit.trim() &&
              (!Number.isFinite(parsedDailyLimit) || parsedDailyLimit < 0)
            ) {
              setDialogError("حد اليوم للمستخدم غير صالح.");
              return;
            }
            setIsSubmitting(true);
            setDialogError("");
            const result = await onSubmit({
              name,
              label,
              icon,
              minDeposit: parsedMin,
              maxDeposit: maxDeposit.trim() ? parsedMax : null,
              dailyLimit: dailyLimit.trim() ? parsedDailyLimit : null,
              note: note.trim() || null,
              fee: fee.trim() ? parsedFee : 0,
              active,
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

const PaymentMethods = () => {
  const { openDialog, closeDialog } = useDialog();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [draftPaymentMethods, setDraftPaymentMethods] = useState([]);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchPaymentMethods = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/payment-methods");
      const payload = response.data ?? {};
      setPaymentMethods(
        Array.isArray(payload.paymentMethods) ? payload.paymentMethods : [],
      );
      return true;
    } catch (err) {
      setError("تعذر تحميل وسائل الدفع. حاول مرة أخرى.");
      setPaymentMethods([]);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isEditingOrder) {
      setDraftPaymentMethods(paymentMethods);
    }
  }, [paymentMethods, isEditingOrder]);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  const handleSyncEzone = async () => {
    setIsSyncing(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await axiosClient.post("/payment-methods/sync-ezone");
      const refreshed = await fetchPaymentMethods();
      if (refreshed) {
        setSuccessMessage(
          `تمت إضافة ${response.data?.createdCount ?? 0} وتحديث ${
            response.data?.updatedCount ?? response.data?.syncedCount ?? 0
          } وسيلة دفع من Ezone Pay.`,
        );
      }
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "EZONE_API_KEY_MISSING") {
        setError("مفتاح Ezone Pay API غير مضبوط على الخادم.");
      } else if (code === "EZONE_API_REQUEST_FAILED") {
        setError(
          "رفض Ezone Pay الطلب. تحقق من المفتاح وصلاحية الوصول إلى وسائل الدفع.",
        );
      } else if (code === "EZONE_API_RESPONSE_INVALID") {
        setError("استجابة وسائل الدفع من Ezone Pay غير صالحة.");
      } else {
        setError("تعذر تحديث وسائل الدفع من Ezone Pay. حاول مرة أخرى.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOrderEditStart = () => {
    setDraftPaymentMethods(paymentMethods);
    setIsEditingOrder(true);
    setError("");
    setSuccessMessage("");
  };

  const handleOrderEditCancel = () => {
    setDraftPaymentMethods(paymentMethods);
    setIsEditingOrder(false);
    setError("");
    setSuccessMessage("");
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (index) => {
    if (dragIndex === null || dragIndex === index) return;
    setDraftPaymentMethods((previous) => {
      const next = [...previous];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next.map((paymentMethod, itemIndex) => ({
        ...paymentMethod,
        order: itemIndex + 1,
      }));
    });
    setDragIndex(null);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await axiosClient.patch("/payment-methods/order", {
        paymentMethods: draftPaymentMethods.map((paymentMethod, index) => ({
          id: paymentMethod._id,
          order: index + 1,
        })),
      });
      const updatedPaymentMethods = Array.isArray(response.data)
        ? response.data
        : draftPaymentMethods;
      setPaymentMethods(updatedPaymentMethods);
      setIsEditingOrder(false);
      setSuccessMessage("تم حفظ ترتيب وسائل الدفع بنجاح.");
    } catch (err) {
      setError("تعذر حفظ الترتيب. حاول مرة أخرى.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const buildFormData = ({
    name,
    label,
    icon,
    minDeposit,
    maxDeposit,
    dailyLimit,
    note,
    fee,
    active,
  }) => {
    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("label", label.trim());
    formData.append("minDeposit", String(minDeposit));
    formData.append("maxDeposit", String(maxDeposit ?? ""));
    formData.append("dailyLimit", String(dailyLimit ?? ""));
    formData.append("note", note ?? "");
    formData.append("fee", String(fee ?? 0));
    formData.append("active", String(active));
    if (icon) {
      formData.append("icon", icon);
    }
    return formData;
  };

  const handleCreate = async (values) => {
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.post("/payment-methods", buildFormData(values));
      await fetchPaymentMethods();
      setSuccessMessage("تم إنشاء وسيلة الدفع بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      return {
        ok: false,
        error: translatePaymentMethodError(
          code,
          "تعذر إنشاء وسيلة الدفع. حاول مرة أخرى.",
        ),
      };
    }
  };

  const handleUpdate = async (id, values) => {
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.patch("/payment-methods", buildFormData(values), {
        params: { id },
      });
      await fetchPaymentMethods();
      setSuccessMessage("تم تعديل وسيلة الدفع بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      return {
        ok: false,
        error: translatePaymentMethodError(
          code,
          "تعذر تعديل وسيلة الدفع. حاول مرة أخرى.",
        ),
      };
    }
  };

  const handleDelete = async (id) => {
    setDeleteId(id);
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.delete("/payment-methods", { params: { id } });
      await fetchPaymentMethods();
      setSuccessMessage("تم حذف وسيلة الدفع بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      const translated = translatePaymentMethodError(
        code,
        "تعذر حذف وسيلة الدفع. حاول مرة أخرى.",
      );
      setError(translated);
      return { ok: false, error: translated };
    } finally {
      setDeleteId(null);
    }
  };

  const handleOpenCreateDialog = () => {
    openDialog(
      <PaymentMethodForm
        onSubmit={handleCreate}
        onCancel={closeDialog}
        submitLabel="إنشاء"
      />,
    );
  };

  const handleOpenEditDialog = (paymentMethod) => {
    openDialog(
      <PaymentMethodForm
        initialValues={paymentMethod}
        onSubmit={(values) => handleUpdate(paymentMethod._id, values)}
        onCancel={closeDialog}
        submitLabel="حفظ"
      />,
    );
  };

  const handleOpenDeleteDialog = (paymentMethod) => {
    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف وسيلة الدفع
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          هل أنت متأكد أنك تريد حذف هذه الوسيلة؟ لا يمكن التراجع عن ذلك.
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
              await handleDelete(paymentMethod._id);
            }}
            disabled={deleteId === paymentMethod._id}
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
              وسائل الدفع
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isEditingOrder
                ? "اسحب وسائل الدفع لتغيير ترتيب ظهورها."
                : "وسائل شحن الرصيد المتاحة لحسابات الأفراد عبر Ezone Pay"}
            </p>
          </div>
          {isEditingOrder ? (
            <div className="flex items-center gap-2">
              <SubmitBtn onClick={handleSaveOrder} disabled={isSavingOrder}>
                حفظ الترتيب
              </SubmitBtn>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                onClick={handleOrderEditCancel}
                disabled={isSavingOrder}
              >
                إلغاء
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <PrimaryBtn
                onClick={handleSyncEzone}
                disabled={isSyncing || isLoading}
              >
                {isSyncing
                  ? "جاري التحديث من Ezone Pay..."
                  : "تحديث من Ezone Pay"}
              </PrimaryBtn>
              <PrimaryBtn onClick={handleOpenCreateDialog}>
                إنشاء وسيلة دفع جديدة
              </PrimaryBtn>
              <PrimaryBtn
                onClick={handleOrderEditStart}
                disabled={isLoading || paymentMethods.length < 2}
              >
                تعديل الترتيب
              </PrimaryBtn>
            </div>
          )}
        </div>

        {successMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        {error && isEditingOrder && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-6">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
              جاري تحميل وسائل الدفع...
            </div>
          ) : error && !isEditingOrder ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
              لا توجد وسائل دفع حتى الآن.
            </div>
          ) : (
            <Table columns={paymentMethodColumns}>
              <TableHead columns={paymentMethodColumns} />
              <TableBody>
                {(isEditingOrder ? draftPaymentMethods : paymentMethods).map(
                  (paymentMethod, index) => (
                    <TableRow
                      key={paymentMethod._id}
                      className={isEditingOrder ? "cursor-move" : undefined}
                      draggable={isEditingOrder}
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={isEditingOrder ? handleDragOver : undefined}
                      onDrop={
                        isEditingOrder ? () => handleDrop(index) : undefined
                      }
                      onDragEnd={() => setDragIndex(null)}
                    >
                      <TableCell className="text-slate-600">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        {paymentMethod.iconPath ? (
                          <img
                            src={paymentMethod.iconPath}
                            alt={paymentMethod.label}
                            className="mx-auto h-10 w-10 rounded-lg object-contain"
                          />
                        ) : (
                          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                            {paymentMethod.label?.slice(0, 2) || "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{safeValue(paymentMethod.label)}</TableCell>
                      <TableCell dir="ltr">
                        {safeValue(paymentMethod.name)}
                      </TableCell>
                      <TableCell dir="ltr">
                        <div>
                          {paymentMethod.maxDeposit == null
                            ? `الحد الأدنى ${safeValue(
                                paymentMethod.minDeposit,
                              )}`
                            : `${safeValue(
                                paymentMethod.minDeposit,
                              )} - ${safeValue(paymentMethod.maxDeposit)}`}
                        </div>
                        {paymentMethod.dailyLimit != null &&
                        paymentMethod.dailyLimit !== "" ? (
                          <div className="mt-1 text-xs text-amber-700">
                            حد اليوم: {safeValue(paymentMethod.dailyLimit)}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          tone={paymentMethod.active ? "success" : "danger"}
                        >
                          {paymentMethod.active ? "مفعّل" : "غير مفعّل"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {paymentMethod.createdAt
                          ? formatArabicDate(paymentMethod.createdAt)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-left">
                        {isEditingOrder ? (
                          <span className="cursor-move select-none text-slate-500">
                            ⋮⋮
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                              onClick={() =>
                                handleOpenEditDialog(paymentMethod)
                              }
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                              onClick={() =>
                                handleOpenDeleteDialog(paymentMethod)
                              }
                              disabled={deleteId === paymentMethod._id}
                            >
                              حذف
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PaymentMethods;
