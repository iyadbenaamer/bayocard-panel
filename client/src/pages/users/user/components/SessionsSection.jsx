import { useCallback, useEffect, useState } from "react";

import axiosClient from "utils/AxiosClient";
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

const translateSessionError = (code, fallback) => {
  const map = {
    CHECK_INVALID_USER_ID: "تعذر تحديد المستخدم.",
    CHECK_INVALID_SESSION_ID: "تعذر تحديد الجهاز المطلوب.",
    AUTH_SESSION_NOT_FOUND: "الجهاز غير موجود أو تم تسجيل الخروج منه بالفعل.",
  };
  return map[code] || fallback || code || "حدث خطأ. حاول مرة أخرى.";
};

const platformLabel = (platform) => {
  if (platform === "android") return "أندرويد";
  if (platform === "ios") return "آيفون";
  return "—";
};

const sessionColumns = [
  { key: "platform", label: "نظام التشغيل" },
  { key: "device", label: "الجهاز" },
  { key: "appVersion", label: "إصدار التطبيق" },
  { key: "createdAt", label: "تاريخ تسجيل الدخول" },
  { key: "lastUsedAt", label: "آخر نشاط" },
  { key: "actions", label: "إجراءات", className: "text-left" },
];

const SessionsSection = ({ userId }) => {
  const { openDialog, closeDialog } = useDialog();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revokingId, setRevokingId] = useState(null);

  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/user/sessions", {
        params: { userId },
      });
      setSessions(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const code = err?.response?.data?.code;
      setError(
        translateSessionError(code, "تعذر تحميل الأجهزة. حاول مرة أخرى."),
      );
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = async (sessionId) => {
    setRevokingId(sessionId);
    setError("");
    setSuccess("");
    try {
      await axiosClient.delete("/user/sessions", { params: { id: sessionId } });
      await fetchSessions();
      setSuccess("تم تسجيل الخروج من هذا الجهاز بنجاح.");
    } catch (err) {
      const code = err?.response?.data?.code;
      setError(
        translateSessionError(code, "تعذر تسجيل الخروج من الجهاز. حاول مرة أخرى."),
      );
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeRequest = (session) => {
    openDialog(
      <div className="min-w-70 p-2">
        <h2 className="text-base font-semibold text-slate-800">
          تأكيد تسجيل الخروج
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          هل أنت متأكد أنك تريد تسجيل خروج المستخدم من هذا الجهاز؟ سيحتاج إلى
          تسجيل الدخول مرة أخرى من هذا الجهاز لاستخدام التطبيق.
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
              await handleRevoke(session._id);
            }}
            disabled={revokingId === session?._id}
          >
            تسجيل الخروج
          </RedBtn>
        </div>
      </div>,
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">
          أجهزة تسجيل الدخول
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          الأجهزة التي سجل المستخدم الدخول منها عبر تطبيق الجوال
        </p>
      </div>

      {success && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {success}
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
          جاري تحميل الأجهزة...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
          لا يوجد جهاز مسجل دخول لهذا المستخدم حاليًا.
        </div>
      ) : (
        <div className="mt-4">
          <Table columns={sessionColumns}>
            <TableHead columns={sessionColumns} />
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session._id}>
                  <TableCell>{platformLabel(session.platform)}</TableCell>
                  <TableCell>{session.deviceName || "—"}</TableCell>
                  <TableCell dir="ltr">{session.appVersion || "—"}</TableCell>
                  <TableCell>
                    {session.createdAt
                      ? formatArabicDateTime(session.createdAt)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {session.lastUsedAt
                      ? formatArabicDateTime(session.lastUsedAt)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-left">
                    <RedBtn
                      onClick={() => handleRevokeRequest(session)}
                      disabled={revokingId === session._id}
                    >
                      تسجيل الخروج
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

export default SessionsSection;
