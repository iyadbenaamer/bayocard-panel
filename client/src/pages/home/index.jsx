import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import Layout from "layout";
import Badge from "components/Badge";
import Alert from "components/Alert";
import axiosClient from "utils/AxiosClient";

const getDisplayName = (name) => name?.ar || name?.en || "";

const Home = () => {
  const admin = useSelector((state) => state.admin);
  const [statsResponse, setStatsResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadFlag, setReloadFlag] = useState(0);
  const adminName =
    admin?.username || localStorage.getItem("adminName") || "المدير";

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const response = await axiosClient.get("/admin/stats");
        if (isMounted) {
          setStatsResponse(response.data);
        }
      } catch (error) {
        if (isMounted) {
          setStatsResponse(null);
          setHasError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      isMounted = false;
    };
  }, [reloadFlag]);

  const stats = statsResponse?.stats || null;
  const serverTime = statsResponse?.serverTime || null;

  const formatNumber = (value) => {
    if (typeof value !== "number") return "—";
    return value.toLocaleString("en-LY");
  };

  const percentOfTotal = (part, total) => {
    if (!total || typeof part !== "number") return 0;
    return Math.round((part / total) * 100);
  };

  const topSoldCards = stats?.topSoldCards || [];

  const availablePercent = percentOfTotal(
    stats?.availableCards,
    stats?.totalCards,
  );
  const soldPercent = percentOfTotal(stats?.soldCards, stats?.totalCards);
  const weeklySales = stats?.purchasesLast7Days ?? 0;
  const weeklyProgress = percentOfTotal(weeklySales, stats?.totalCards || 0);

  const statCards = useMemo(
    () => [
      {
        title: "البطاقات المتاحة",
        value: formatNumber(stats?.availableCards),
        badge: stats ? `${availablePercent}%` : "—",
        note: "من إجمالي البطاقات",
        tone: "sky",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            strokeWidth="2"
          >
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="3"
              stroke="currentColor"
            />
            <path d="M3 10h18" stroke="currentColor" />
          </svg>
        ),
      },
      {
        title: "البطاقات المباعة",
        value: formatNumber(stats?.soldCards),
        badge: stats ? `${soldPercent}%` : "—",
        note: "من إجمالي البطاقات",
        tone: "emerald",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            strokeWidth="2"
          >
            <path d="M6 4h12l-1 14H7L6 4z" stroke="currentColor" />
            <path d="M9 8h6" stroke="currentColor" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        title: "إجمالي البطاقات",
        value: formatNumber(stats?.totalCards),
        badge: formatNumber(stats?.soldCards),
        note: "بطاقات مباعة",
        tone: "amber",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            strokeWidth="2"
          >
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="3"
              stroke="currentColor"
            />
            <path d="M3 10h18" stroke="currentColor" />
          </svg>
        ),
      },
      {
        title: "إجمالي الأنواع",
        value: formatNumber(stats?.totalCardTypes),
        badge: formatNumber(stats?.activeCardTypes),
        note: "أنواع مفعلة",
        tone: "violet",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            strokeWidth="2"
          >
            <path d="M4 7h16" stroke="currentColor" strokeLinecap="round" />
            <path d="M4 12h16" stroke="currentColor" strokeLinecap="round" />
            <path d="M4 17h16" stroke="currentColor" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        title: "النوع الأكثر مبيعا",
        value: getDisplayName(stats?.topSoldType?.name) || "—",
        badge: formatNumber(stats?.topSoldType?.soldCount),
        note: "بطاقات مباعة",
        tone: "rose",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            strokeWidth="2"
          >
            <path
              d="M12 2l3 6 6 .8-4.4 4.3 1 6-5.6-3-5.6 3 1-6L3 8.8 9 8z"
              stroke="currentColor"
            />
          </svg>
        ),
      },
      {
        title: "إجمالي المستخدمين",
        value: formatNumber(stats?.totalUsers),
        badge: formatNumber(stats?.newUsersLast7Days),
        note: "مستخدم جديد آخر 7 أيام",
        tone: "sky",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            strokeWidth="2"
          >
            <path
              d="M16 11a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"
              stroke="currentColor"
            />
            <path
              d="M4 20c1.8-3 4.6-4 8-4s6.2 1 8 4"
              stroke="currentColor"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
    ],
    [
      availablePercent,
      soldPercent,
      stats?.availableCards,
      stats?.totalCards,
      stats?.soldCards,
      stats?.totalCardTypes,
      stats?.activeCardTypes,
      stats?.topSoldType?.name,
      stats?.topSoldType?.soldCount,
      stats?.totalUsers,
      stats?.newUsersLast7Days,
    ],
  );

  const badgeTones = {
    sky: "info",
    emerald: "success",
    amber: "warning",
    violet: "violet",
    rose: "danger",
  };

  const formattedServerTime = serverTime
    ? new Date(serverTime).toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <Layout>
      <section
        dir="rtl"
        className="relative overflow-hidden px-4 py-8  sm:px-6 lg:px-10 min-h-svh"
      >
        <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-linear-to-br from-[#2E7BFF]/15 to-[#A855F7]/10 blur-3xl" />
        <div className="absolute -bottom-28 left-0 h-72 w-72 rounded-full bg-linear-to-tr from-[#A855F7]/10 to-[#2E7BFF]/15 blur-3xl" />

        <div className="relative mx-auto w-full max-w-6xl">
          <header className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/20 bg-linear-to-l from-[#2E7BFF] to-[#A855F7] p-6 text-white shadow-[0_16px_40px_rgba(46,123,255,0.2)]">
            <div className="pointer-events-none absolute -left-12 -top-20 h-48 w-48 rounded-full border border-white/15" />
            <div className="pointer-events-none absolute -left-4 -top-12 h-32 w-32 rounded-full border border-white/15" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">
                  لوحة التحكم
                </p>
                <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                  مرحبا بعودتك، {adminName}
                </h1>
                <p className="mt-2 text-sm text-white/85 sm:text-base">
                  لمحة سريعة عن الأداء والمخزون ونشاط المستخدمين.
                </p>
              </div>
            </div>
          </header>

          {hasError && (
            <Alert tone="error" className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>تعذر تحميل بيانات لوحة التحكم. تحقق من الاتصال وحاول مرة أخرى.</span>
                <button
                  type="button"
                  onClick={() => setReloadFlag((flag) => flag + 1)}
                  className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  إعادة المحاولة
                </button>
              </div>
            </Alert>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="grid gap-6 sm:grid-cols-2">
              {statCards.map((item, index) => (
                <article
                  key={item.title}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-1 hover:border-[#2E7BFF]/30 hover:shadow-[0_18px_38px_rgba(46,123,255,0.12)]"
                >
                  <div className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-linear-to-l from-[#2E7BFF] to-[#A855F7] opacity-60 transition-opacity group-hover:opacity-100" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">
                        {item.title}
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-slate-900">
                        {item.value}
                      </h3>
                    </div>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        index % 2 === 0
                          ? "bg-[#2E7BFF]/10 text-[#2E7BFF]"
                          : "bg-[#A855F7]/10 text-[#A855F7]"
                      }`}
                    >
                      {item.icon}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <Badge tone={badgeTones[item.tone] || "info"}>
                      {item.badge}
                    </Badge>
                    <span className="text-slate-600">{item.note}</span>
                  </div>
                </article>
              ))}
            </div>

            <aside className="flex flex-col gap-6">
              <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-linear-to-br from-[#2E7BFF] to-[#A855F7] p-6 text-white shadow-[0_18px_40px_rgba(108,77,230,0.3)]">
                <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full border border-white/15" />
                <div className="pointer-events-none absolute -left-4 -top-4 h-24 w-24 rounded-full border border-white/15" />
                <div className="relative">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
                    مبيعات آخر 7 أيام
                  </p>
                  <h2 className="mt-3 text-4xl font-bold tracking-tight">
                    {isLoading ? "—" : `${weeklyProgress}%`}
                  </h2>
                  <p className="mt-2 text-sm text-white/80">
                    {isLoading
                      ? "جارٍ تحميل البيانات من قاعدة البيانات."
                      : `${weeklySales} من أصل ${
                          stats?.totalCards ?? 0
                        } بطاقة مباعة خلال 7 أيام.`}
                  </p>
                  <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-black/15">
                    <div
                      className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)] transition-all duration-500"
                      style={{ width: `${Math.min(weeklyProgress, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  أفضل 10 بطاقات مبيعا
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  الترتيب حسب إجمالي عدد البطاقات المباعة منذ البداية
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              {isLoading ? (
                <p className="py-6 text-center text-sm text-slate-600">
                  جارٍ تحميل البيانات...
                </p>
              ) : topSoldCards.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-600">
                  لا توجد بيانات مبيعات بعد
                </p>
              ) : (
                <table className="w-full min-w-[360px] text-right text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="py-2 pr-2 font-semibold">#</th>
                      <th className="py-2 font-semibold">النوع</th>
                      <th className="py-2 pl-2 font-semibold">عدد المبيعات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSoldCards.map((card, index) => (
                      <tr
                        key={card.typeId}
                        className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80"
                      >
                        <td className="py-3 pr-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-l from-[#2E7BFF]/10 to-[#A855F7]/10 text-xs font-bold text-[#2E7BFF]">
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3 font-medium text-slate-900">
                          {getDisplayName(card.typeName)}
                        </td>
                        <td className="py-3 pl-2 font-semibold text-slate-900">
                          {formatNumber(card.soldCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;
