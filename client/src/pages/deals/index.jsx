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

const dealColumns = [
  { key: "background", label: "الصورة", width: "100px" },
  { key: "badge", label: "الشارة" },
  { key: "link", label: "الرابط" },
  { key: "status", label: "الحالة" },
  { key: "createdAt", label: "التاريخ" },
  { key: "actions", label: "إجراءات", className: "text-left" },
];

const translateDealError = (code, fallback) => {
  const map = {
    DEAL_BADGE_REQUIRED: "الشارة مطلوبة.",
    DEAL_BACKGROUND_REQUIRED: "صورة الخلفية مطلوبة.",
    DEAL_NOT_FOUND: "العرض غير موجود.",
  };
  return map[code] || fallback || code || "حدث خطأ. حاول مرة أخرى.";
};

const DealForm = ({ initialValues, onSubmit, onCancel, submitLabel }) => {
  const [badge, setBadge] = useState(initialValues?.badge ?? "");
  const [link, setLink] = useState(initialValues?.link ?? "");
  const [background, setBackground] = useState(null);
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [dialogError, setDialogError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="min-w-70 p-2">
      <h2 className="text-base font-semibold text-slate-800">
        {initialValues ? "تعديل العرض" : "إنشاء عرض جديد"}
      </h2>
      <div className="mt-4 space-y-3">
        <ImageUpload
          label="صورة الخلفية"
          value={background}
          onChange={setBackground}
          existingUrl={initialValues?.background ?? ""}
        />
        <CustomInput
          label="الشارة"
          value={badge}
          onChange={(event) => setBadge(event.target.value)}
          placeholder="مثال: عروض اليوم"
        />
        <CustomInput
          label="الرابط (اختياري)"
          dir="ltr"
          maxLength={300}
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="اتركه فارغًا إذا لم يكن العرض يفتح رابطًا"
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
            if (!badge.trim()) {
              setDialogError("الشارة مطلوبة.");
              return;
            }
            if (!initialValues && !background) {
              setDialogError("صورة الخلفية مطلوبة.");
              return;
            }
            setIsSubmitting(true);
            setDialogError("");
            const result = await onSubmit({ badge, link, background, isActive });
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

const Deals = () => {
  const { openDialog, closeDialog } = useDialog();
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  const fetchDeals = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/deals");
      const payload = response.data ?? {};
      setDeals(Array.isArray(payload.deals) ? payload.deals : []);
    } catch (err) {
      setError("تعذر تحميل العروض. حاول مرة أخرى.");
      setDeals([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleCreate = async ({ badge, link, background, isActive }) => {
    setError("");
    setSuccessMessage("");
    try {
      const formData = new FormData();
      formData.append("badge", badge.trim());
      formData.append("link", link.trim());
      formData.append("isActive", String(isActive));
      if (background) {
        formData.append("media", background);
      }
      await axiosClient.post("/deals", formData);
      await fetchDeals();
      setSuccessMessage("تم إنشاء العرض بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      return { ok: false, error: translateDealError(code, "تعذر إنشاء العرض. حاول مرة أخرى.") };
    }
  };

  const handleUpdate = async (dealId, { badge, link, background, isActive }) => {
    setError("");
    setSuccessMessage("");
    try {
      const formData = new FormData();
      formData.append("badge", badge.trim());
      formData.append("link", link.trim());
      formData.append("isActive", String(isActive));
      if (background) {
        formData.append("media", background);
      }
      await axiosClient.patch("/deals", formData, { params: { id: dealId } });
      await fetchDeals();
      setSuccessMessage("تم تعديل العرض بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      return { ok: false, error: translateDealError(code, "تعذر تعديل العرض. حاول مرة أخرى.") };
    }
  };

  const handleDelete = async (dealId) => {
    setDeleteId(dealId);
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.delete("/deals", { params: { id: dealId } });
      await fetchDeals();
      setSuccessMessage("تم حذف العرض بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      const translated = translateDealError(code, "تعذر حذف العرض. حاول مرة أخرى.");
      setError(translated);
      return { ok: false, error: translated };
    } finally {
      setDeleteId(null);
    }
  };

  const handleOpenCreateDialog = () => {
    openDialog(
      <DealForm onSubmit={handleCreate} onCancel={closeDialog} submitLabel="إنشاء" />,
    );
  };

  const handleOpenEditDialog = (deal) => {
    openDialog(
      <DealForm
        initialValues={deal}
        onSubmit={(values) => handleUpdate(deal._id, values)}
        onCancel={closeDialog}
        submitLabel="حفظ"
      />,
    );
  };

  const handleOpenDeleteDialog = (deal) => {
    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف العرض
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          هل أنت متأكد أنك تريد حذف هذا العرض؟ لا يمكن التراجع عن ذلك.
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
              await handleDelete(deal._id);
            }}
            disabled={deleteId === deal._id}
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
              العروض الترويجية
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              العروض الترويجية المعروضة في الصفحة الرئيسية للتطبيق (لحسابات
              الأفراد فقط)
            </p>
          </div>
          <PrimaryBtn onClick={handleOpenCreateDialog}>
            إنشاء عرض جديد
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
              جاري تحميل العروض...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : deals.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
              لا توجد عروض حتى الآن.
            </div>
          ) : (
            <Table columns={dealColumns}>
              <TableHead columns={dealColumns} />
              <TableBody>
                {deals.map((deal) => (
                  <TableRow key={deal._id}>
                    <TableCell>
                      <img
                        src={deal.background}
                        alt={deal.badge}
                        className="mx-auto h-12 w-20 rounded-lg object-cover"
                      />
                    </TableCell>
                    <TableCell>{safeValue(deal.badge)}</TableCell>
                    <TableCell dir="ltr">{safeValue(deal.link)}</TableCell>
                    <TableCell>
                      <Badge tone={deal.isActive ? "success" : "danger"}>
                        {deal.isActive ? "مفعّل" : "غير مفعّل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {deal.createdAt ? formatArabicDate(deal.createdAt) : "—"}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          onClick={() => handleOpenEditDialog(deal)}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                          onClick={() => handleOpenDeleteDialog(deal)}
                          disabled={deleteId === deal._id}
                        >
                          حذف
                        </button>
                      </div>
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

export default Deals;
