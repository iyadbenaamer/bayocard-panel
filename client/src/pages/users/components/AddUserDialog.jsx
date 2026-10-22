import { useState } from "react";
import CustomInput from "components/CustomInput";
import SubmitBtn from "components/SubmitBtn";
import axiosClient from "utils/AxiosClient";
import { getApiErrorMessage } from "utils/errorMessages";

const AddUserDialog = ({ onAdded, onClose }) => {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    role: "business",
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    setError("");
    const name = (form.name || "").toString().trim();
    const phone = (form.phone || "").toString().trim();
    const password = (form.password || "").toString();
    const role = (form.role || "").toString().trim();

    if (!name) {
      setError("الاسم مطلوب.");
      return;
    }
    if (!phone) {
      setError("رقم الهاتف مطلوب.");
      return;
    }
    if (!password) {
      setError("كلمة المرور مطلوبة.");
      return;
    }
    if (!["business", "individual"].includes(role)) {
      setError("يرجى اختيار نوع الحساب.");
      return;
    }

    setIsSaving(true);
    try {
      await axiosClient.post("/user", { name, phone, password, role });
      if (onAdded) onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "خطأ أثناء إنشاء المستخدم"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-80 p-4 text-right" dir="rtl">
      <h2 className="text-lg font-semibold text-slate-800">
        إنشاء مستخدم جديد
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        أدخل الاسم، رقم الهاتف وكلمة المرور للمستخدم.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4">
        <CustomInput
          label="الاسم"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoFocus
        />
        <CustomInput
          label="رقم الهاتف"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <CustomInput
          label="كلمة المرور"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <div>
          <label className="text-xs text-slate-600">نوع الحساب</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="business">تجاري</option>
            <option value="individual">فردي</option>
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
          onClick={onClose}
          disabled={isSaving}
        >
          إلغاء
        </button>
        <SubmitBtn onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "جاري الحفظ..." : "إنشاء"}
        </SubmitBtn>
      </div>
    </div>
  );
};

export default AddUserDialog;
