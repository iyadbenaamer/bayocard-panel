import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

const useQueryParamsState = (defaults) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(defaults).map(([key, defaultValue]) => {
          const value = searchParams.get(key);
          if (value === null) return [key, defaultValue];
          if (typeof defaultValue === "number") {
            const parsedValue = Number(value);
            return [
              key,
              Number.isSafeInteger(parsedValue) && parsedValue > 0
                ? parsedValue
                : defaultValue,
            ];
          }
          return [key, value];
        }),
      ),
    [defaults, searchParams],
  );

  const updateValues = useCallback(
    (updates) => {
      setSearchParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams);
          Object.entries(updates).forEach(([key, value]) => {
            if (
              value === undefined ||
              value === null ||
              value === defaults[key]
            ) {
              nextParams.delete(key);
            } else {
              nextParams.set(key, String(value));
            }
          });
          return nextParams;
        },
        { replace: true },
      );
    },
    [defaults, setSearchParams],
  );

  return [values, updateValues];
};

export default useQueryParamsState;
