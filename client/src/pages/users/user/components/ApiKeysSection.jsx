import { useCallback, useEffect, useState } from "react";

import axiosClient from "utils/AxiosClient";
import CustomInput from "components/CustomInput";
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
import { formatArabicDateTime } from "../utils";

const translateApiKeyError = (code, fallback) => {
  const map = {
    CHECK_INVALID_USER_ID: "تعذر تحديد المستخدم.",
    CHECK_INVALID_API_KEY_ID: "تعذر تحديد المفتاح المطلوب.",
    USER_NOT_FOUND: "المستخدم غير موجود.",
    API_KEY_NAME_REQUIRED: "اسم المفتاح مطلوب.",
    API_KEY_NOT_ELIGIBLE_FOR_ROLE:
      "مفاتيح API متاحة فقط لحسابات الأعمال التجارية.",
    API_KEY_LIMIT_REACHED: "تم الوصول للحد الأقصى من المفاتيح لهذا المستخدم.",
    API_KEY_NOT_FOUND: "المفتاح غير موجود.",
  };
  return map[code] || fallback || code || "حدث خطأ. حاول مرة أخرى.";
};

// Two-stage dialog: enter a name and create, then show the raw secret
// exactly once - the server never returns it again after this response.
const CreateApiKeyDialog = ({ userId, onCreate, onCancel }) => {
  const [name, setName] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  if (createdKey) {
    return (
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تم إنشاء المفتاح
        </h2>
        <p className="mt-2 text-sm text-rose-700">
          انسخ المفتاح الآن - لن يتم عرضه مرة أخرى بعد إغلاق هذه النافذة.
        </p>
        <div
          dir="ltr"
          className="mt-3 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left font-mono text-xs text-slate-700"
        >
          {createdKey}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={async () => {
              await navigator.clipboard.writeText(createdKey);
              setIsCopied(true);
            }}
          >
            {isCopied ? "تم النسخ" : "نسخ المفتاح"}
          </button>
          <SubmitBtn onClick={onCancel}>تم</SubmitBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-70 p-2">
      <h2 className="text-base font-semibold text-slate-800">
        إنشاء مفتاح API
      </h2>
      <div className="mt-4">
        <CustomInput
          label="اسم المفتاح"
          placeholder="مثال: تكامل المتجر الإلكتروني"
          value={name}
          onChange={(event) => setName(event.target.value)}
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
            if (!name.trim()) {
              setDialogError("اسم المفتاح مطلوب.");
              return;
            }
            setIsSubmitting(true);
            setDialogError("");
            const result = await onCreate({ name: name.trim() });
            if (result?.ok) {
              setCreatedKey(result.secret);
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

const apiKeyColumns = [
  { key: "name", label: "الاسم" },
  { key: "keyPrefix", label: "المفتاح" },
  { key: "createdByType", label: "أُنشئ بواسطة" },
  { key: "createdAt", label: "تاريخ الإنشاء" },
  { key: "lastUsedAt", label: "آخر استخدام" },
  { key: "actions", label: "إجراءات", className: "text-left" },
];

const ApiKeysSection = ({ userId }) => {
  const { openDialog, closeDialog } = useDialog();
  const [apiKeys, setApiKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const fetchApiKeys = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/user/api-keys", {
        params: { userId },
      });
      setApiKeys(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const code = err?.response?.data?.code;
      setError(
        translateApiKeyError(code, "تعذر تحميل مفاتيح API. حاول مرة أخرى."),
      );
      setApiKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreate = async ({ name }) => {
    if (!userId) {
      return { ok: false, error: "تعذر تحديد المستخدم." };
    }
    setError("");
    setSuccess("");
    try {
      const response = await axiosClient.post("/user/api-keys", {
        userId,
        name,
      });
      await fetchApiKeys();
      return { ok: true, secret: response.data?.secret };
    } catch (err) {
      const code = err?.response?.data?.code;
      return {
        ok: false,
        error: translateApiKeyError(
          code,
          "تعذر إنشاء المفتاح. حاول مرة أخرى.",
        ),
      };
    }
  };

  const handleDelete = async (keyId) => {
    setDeletingId(keyId);
    setError("");
    setSuccess("");
    try {
      await axiosClient.delete(`/user/api-keys/${keyId}`);
      setApiKeys((prev) => prev.filter((item) => item._id !== keyId));
      setSuccess("تم حذف المفتاح بنجاح.");
    } catch (err) {
      const code = err?.response?.data?.code;
      setError(translateApiKeyError(code, "تعذر حذف المفتاح. حاول مرة أخرى."));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteRequest = (apiKey) => {
    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد حذف المفتاح
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          هل أنت متأكد أنك تريد حذف المفتاح "{apiKey.name}" نهائيًا؟ لا يمكن
          التراجع عن ذلك، ولن يظهر المفتاح في السجل بعد الآن.
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
              await handleDelete(apiKey._id);
            }}
            disabled={deletingId === apiKey?._id}
          >
            حذف نهائي
          </RedBtn>
        </div>
      </div>,
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">مفاتيح API</h2>
          <p className="mt-1 text-xs text-slate-600">
            مفاتيح للوصول البرمجي المباشر - لا يمكن استخدامها من تطبيق الجوال
          </p>
        </div>
        <PrimaryBtn
          onClick={() =>
            openDialog(
              <CreateApiKeyDialog
                userId={userId}
                onCreate={handleCreate}
                onCancel={closeDialog}
              />,
            )
          }
        >
          إنشاء مفتاح
        </PrimaryBtn>
      </div>

      {success && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {success}
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
          جاري تحميل مفاتيح API...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
          لا يوجد مفاتيح API لهذا المستخدم حتى الآن.
        </div>
      ) : (
        <div className="mt-4">
          <Table columns={apiKeyColumns}>
            <TableHead columns={apiKeyColumns} />
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey._id}>
                  <TableCell>{apiKey.name}</TableCell>
                  <TableCell dir="ltr">{apiKey.keyPrefix}…</TableCell>
                  <TableCell>
                    <span
                      className={
                        apiKey.createdByType === "user"
                          ? "rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-800"
                          : "rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
                      }
                    >
                      {apiKey.createdByType === "user" ? "المستخدم" : "الإدارة"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {apiKey.createdAt
                      ? formatArabicDateTime(apiKey.createdAt)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {apiKey.lastUsedAt
                      ? formatArabicDateTime(apiKey.lastUsedAt)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-left">
                    <RedBtn
                      onClick={() => handleDeleteRequest(apiKey)}
                      disabled={deletingId === apiKey._id}
                    >
                      حذف
                    </RedBtn>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ApiKeysSection;
