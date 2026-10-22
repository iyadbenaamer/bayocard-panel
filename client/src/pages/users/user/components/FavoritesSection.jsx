import { useCallback, useEffect, useState } from "react";

import axiosClient from "utils/AxiosClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components/Table";
import { formatArabicDateTime, safeValue } from "../utils";

const getDisplayName = (name) => name?.ar || name?.en || "";

const favoriteColumns = [
  { key: "image", label: "الصورة" },
  { key: "type", label: "نوع البطاقة" },
  { key: "category", label: "التصنيف" },
  { key: "createdAt", label: "تاريخ الإضافة" },
];

const FavoritesSection = ({ userId }) => {
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchFavorites = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await axiosClient.get("/user/favorites", {
        params: { userId },
      });
      const list = Array.isArray(response.data) ? response.data : [];
      setFavorites(list);
    } catch (err) {
      const code = err?.response?.data?.code;
      setError(
        code === "FAVORITE_USER_ID_INVALID"
          ? "تعذر تحديد المستخدم."
          : "تعذر تحميل المفضلة. حاول مرة أخرى.",
      );
      setFavorites([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">
          البطاقات المفضلة
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          أنواع البطاقات التي اختارها هذا المستخدم كمفضلة من التطبيق
        </p>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
          جاري تحميل المفضلة...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : favorites.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
          لا توجد بطاقات مفضلة لهذا المستخدم حتى الآن.
        </div>
      ) : (
        <div className="mt-4">
          <Table columns={favoriteColumns}>
            <TableHead columns={favoriteColumns} />
            <TableBody>
              {favorites.map((favorite) => (
                <TableRow key={favorite._id}>
                  <TableCell>
                    <div className="mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                      {favorite.cardTypeImage ? (
                        <img
                          src={favorite.cardTypeImage}
                          alt={getDisplayName(favorite.cardTypeName)}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {safeValue(getDisplayName(favorite.cardTypeName) || null)}
                  </TableCell>
                  <TableCell>
                    {safeValue(getDisplayName(favorite.categoryName) || null)}
                  </TableCell>
                  <TableCell>
                    {favorite.createdAt
                      ? formatArabicDateTime(favorite.createdAt)
                      : "—"}
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

export default FavoritesSection;
