import { useCallback, useEffect, useState } from "react";

import Layout from "layout";
import axiosClient from "utils/AxiosClient";
import CustomInput from "components/CustomInput";
import ImageUpload from "components/ImageUpload";
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

const DEFAULT_TITLE = "Bayo Card";

const AUDIENCE_OPTIONS = [
  { value: "all", label: "الجميع" },
  { value: "authorized", label: "المستخدمون المسجلون (أفراد / نشاط تجاري)" },
  { value: "individual", label: "الأفراد" },
  { value: "business", label: "حسابات الأعمال" },
  { value: "unauthorized", label: "من لم يسجلوا الدخول بعد" },
];

const audienceLabel = (value) =>
  AUDIENCE_OPTIONS.find((option) => option.value === value)?.label ?? value;

const notificationColumns = [
  { key: "image", label: "الصورة", width: "80px" },
  { key: "title", label: "العنوان" },
  { key: "text", label: "النص" },
  { key: "audience", label: "الفئة المستهدفة" },
  { key: "createdAt", label: "التاريخ" },
  { key: "actions", label: "إجراءات", className: "text-left" },
];

const translateNotificationError = (code, fallback) => {
  const map = {
    NOTIFICATION_TEXT_REQUIRED: "نص الإشعار مطلوب.",
    NOTIFICATION_INVALID_AUDIENCE: "الفئة المستهدفة غير صالحة.",
    NOTIFICATION_NOT_FOUND: "الإشعار غير موجود.",
  };
  return map[code] || fallback || code || "حدث خطأ. حاول مرة أخرى.";
};

const NotificationForm = ({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
}) => {
  const [title, setTitle] = useState(initialValues?.title ?? DEFAULT_TITLE);
  const [text, setText] = useState(initialValues?.text ?? "");
  const [image, setImage] = useState(null);
  const [link, setLink] = useState(initialValues?.link ?? "");
  const [audience, setAudience] = useState(initialValues?.audience ?? "all");
  const [dialogError, setDialogError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="min-w-70 p-2">
      <h2 className="text-base font-semibold text-slate-800">
        {initialValues ? "تعديل الإشعار" : "إرسال إشعار جديد"}
      </h2>
      <div className="mt-4 space-y-3">
        <ImageUpload
          label="الصورة (اختياري)"
          value={image}
          onChange={setImage}
          existingUrl={initialValues?.image ?? ""}
        />
        <CustomInput
          label="العنوان"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={DEFAULT_TITLE}
        />
        <label className="cool-input cool-input--md">
          <span className="cool-input__label">النص</span>
          <span className="cool-input__shell">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="محتوى الإشعار"
              maxLength={500}
              rows={4}
              className="custom-input"
            />
          </span>
        </label>
        <CustomInput
          label="الرابط (اختياري)"
          dir="ltr"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="/cards/... أو رابط خارجي"
        />
        <label className="cool-input cool-input--md">
          <span className="cool-input__label">الفئة المستهدفة</span>
          <span className="cool-input__shell">
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className="custom-input"
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
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
            if (!text.trim()) {
              setDialogError("نص الإشعار مطلوب.");
              return;
            }

            setIsSubmitting(true);
            setDialogError("");
            const result = await onSubmit({
              title,
              text,
              image,
              link,
              audience,
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

const Notifications = () => {
  const { openDialog, closeDialog } = useDialog();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [resendId, setResendId] = useState(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/notifications");
      const payload = response.data ?? {};
      setNotifications(
        Array.isArray(payload.notifications) ? payload.notifications : [],
      );
    } catch (err) {
      setError("تعذر تحميل الإشعارات. حاول مرة أخرى.");
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const buildFormData = ({ title, text, image, link, audience }) => {
    const formData = new FormData();
    formData.append("title", title.trim() || DEFAULT_TITLE);
    formData.append("text", text.trim());
    formData.append("link", link.trim());
    formData.append("audience", audience);
    if (image) {
      formData.append("media", image);
    }
    return formData;
  };

  const handleCreate = async (values) => {
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.post("/notifications", buildFormData(values));
      await fetchNotifications();
      setSuccessMessage("تم إرسال الإشعار بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      return {
        ok: false,
        error: translateNotificationError(
          code,
          "تعذر إرسال الإشعار. حاول مرة أخرى.",
        ),
      };
    }
  };

  const handleUpdate = async (id, values) => {
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.patch("/notifications", buildFormData(values), {
        params: { id },
      });
      await fetchNotifications();
      setSuccessMessage("تم تعديل الإشعار بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      return {
        ok: false,
        error: translateNotificationError(
          code,
          "تعذر تعديل الإشعار. حاول مرة أخرى.",
        ),
      };
    }
  };

  const handleDelete = async (id) => {
    setDeleteId(id);
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.delete("/notifications", { params: { id } });
      await fetchNotifications();
      setSuccessMessage("تم حذف الإشعار بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      const translated = translateNotificationError(
        code,
        "تعذر حذف الإشعار. حاول مرة أخرى.",
      );
      setError(translated);
      return { ok: false, error: translated };
    } finally {
      setDeleteId(null);
    }
  };

  const handleResend = async (id) => {
    setResendId(id);
    setError("");
    setSuccessMessage("");
    try {
      await axiosClient.post("/notifications/resend", null, { params: { id } });
      setSuccessMessage("تم إعادة إرسال الإشعار بنجاح.");
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      const translated = translateNotificationError(
        code,
        "تعذر إعادة إرسال الإشعار. حاول مرة أخرى.",
      );
      setError(translated);
      return { ok: false, error: translated };
    } finally {
      setResendId(null);
    }
  };

  const handleOpenCreateDialog = () => {
    openDialog(
      <NotificationForm
        onSubmit={handleCreate}
        onCancel={closeDialog}
        submitLabel="إرسال"
      />,
    );
  };

  const handleOpenEditDialog = (notification) => {
    openDialog(
      <NotificationForm
        initialValues={notification}
        onSubmit={(values) => handleUpdate(notification._id, values)}
        onCancel={closeDialog}
        submitLabel="حفظ"
      />,
    );
  };

  const handleOpenDeleteDialog = (notification) => {
    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف الإشعار
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          هل أنت متأكد أنك تريد حذف هذا الإشعار؟ لا يمكن التراجع عن ذلك.
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
              await handleDelete(notification._id);
            }}
            disabled={deleteId === notification._id}
          >
            حذف
          </RedBtn>
        </div>
      </div>,
    );
  };

  const handleOpenResendDialog = (notification) => {
    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          إعادة إرسال الإشعار
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          سيتم إرسال هذا الإشعار مرة أخرى لكل المستخدمين المستهدفين حاليًا.
          متابعة؟
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={closeDialog}
          >
            إلغاء
          </button>
          <PrimaryBtn
            onClick={async () => {
              closeDialog();
              await handleResend(notification._id);
            }}
            disabled={resendId === notification._id}
          >
            إعادة الإرسال
          </PrimaryBtn>
        </div>
      </div>,
    );
  };

  return (
    <Layout>
      <div className="px-4 py-6" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">الإشعارات</h1>
            <p className="mt-1 text-sm text-slate-600">
              إشعارات مخصصة تُرسل لحسابات المستخدمين (الأعمال أو الأفراد)
            </p>
          </div>
          <PrimaryBtn onClick={handleOpenCreateDialog}>
            إرسال إشعار جديد
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
              جاري تحميل الإشعارات...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
              لا توجد إشعارات حتى الآن.
            </div>
          ) : (
            <Table columns={notificationColumns}>
              <TableHead columns={notificationColumns} />
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification._id}>
                    <TableCell>
                      {notification.image ? (
                        <img
                          src={notification.image}
                          alt={notification.title}
                          className="mx-auto h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{safeValue(notification.title)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {safeValue(notification.text)}
                    </TableCell>
                    <TableCell>
                      {audienceLabel(notification.audience)}
                    </TableCell>
                    <TableCell>
                      {notification.createdAt
                        ? formatArabicDate(notification.createdAt)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          onClick={() => handleOpenEditDialog(notification)}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          onClick={() => handleOpenResendDialog(notification)}
                          disabled={resendId === notification._id}
                        >
                          إعادة الإرسال
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                          onClick={() => handleOpenDeleteDialog(notification)}
                          disabled={deleteId === notification._id}
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

export default Notifications;
