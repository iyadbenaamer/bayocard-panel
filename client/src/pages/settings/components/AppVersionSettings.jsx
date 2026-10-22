import { useEffect, useState } from "react";
import axiosClient from "utils/AxiosClient";
import { getApiErrorMessage } from "utils/errorMessages";
import CustomInput from "components/CustomInput";
import SubmitBtn from "components/SubmitBtn";
import LoadingIcon from "assets/icons/loading-circle.svg?react";

const EMPTY_PLATFORM = { minVersion: "", latestVersion: "", storeUrl: "" };

const PLATFORM_LABELS = {
  android: "أندرويد",
  ios: "iOS",
};

const AppVersionSettings = () => {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ android: EMPTY_PLATFORM, ios: EMPTY_PLATFORM });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const fetchAppVersion = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/app-version");
      setForm({
        android: { ...EMPTY_PLATFORM, ...res.data?.android },
        ios: { ...EMPTY_PLATFORM, ...res.data?.ios },
      });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "فشل تحميل إعدادات إصدار التطبيق" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppVersion();
  }, []);

  const handleFieldChange = (platform, field, value) => {
    setForm((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  };

  const handleSave = async () => {
    try {
      const res = await axiosClient.put("/app-version", form);
      setForm({
        android: { ...EMPTY_PLATFORM, ...res.data?.android },
        ios: { ...EMPTY_PLATFORM, ...res.data?.ios },
      });
      setMessage({ type: "success", text: "تم حفظ إعدادات إصدار التطبيق" });
    } catch (err) {
      setMessage({
        type: "error",
        text: getApiErrorMessage(err, "فشل حفظ إعدادات إصدار التطبيق"),
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-8 flex flex-col items-center py-12 gap-3 text-gray-500">
        <LoadingIcon className="animate-spin" height={40} />
        جاري تحميل إعدادات إصدار التطبيق...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
      <div className="flex justify-between items-start gap-6 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">إصدار التطبيق</h2>
          <p className="mt-1 text-sm text-gray-500">
            الحد الأدنى لإصدار مسموح باستخدامه، وأحدث إصدار متاح، لكل منصة.
            المستخدمون على إصدار أقل من الحد الأدنى سيُطالَبون بالتحديث إجباريًا.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-5 p-4 rounded-xl text-sm font-medium shadow ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {["android", "ios"].map((platform) => (
          <div
            key={platform}
            className="rounded-xl border border-gray-200 p-4"
          >
            <div className="text-base font-semibold text-gray-700 mb-3">
              {PLATFORM_LABELS[platform]}
            </div>
            <div className="grid gap-3">
              <CustomInput
                label="الحد الأدنى للإصدار"
                placeholder="مثال: 2.0.0"
                value={form[platform].minVersion}
                onChange={(e) =>
                  handleFieldChange(platform, "minVersion", e.target.value)
                }
              />
              <CustomInput
                label="أحدث إصدار"
                placeholder="مثال: 2.1.0"
                value={form[platform].latestVersion}
                onChange={(e) =>
                  handleFieldChange(platform, "latestVersion", e.target.value)
                }
              />
              <CustomInput
                label="رابط المتجر"
                placeholder="رابط متجر التطبيقات"
                dir="ltr"
                maxLength={500}
                value={form[platform].storeUrl}
                onChange={(e) =>
                  handleFieldChange(platform, "storeUrl", e.target.value)
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <SubmitBtn onClick={handleSave}>حفظ إعدادات الإصدار</SubmitBtn>
      </div>
    </div>
  );
};

export default AppVersionSettings;
