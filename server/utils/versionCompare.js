// Compares two dotted-numeric version strings (e.g. "2.1.0"). Returns a
// negative number if `a` < `b`, positive if `a` > `b`, 0 if equal. Missing
// segments are treated as 0, so "2.1" and "2.1.0" compare equal.
export const compareVersions = (a, b) => {
  const partsA = String(a ?? "0")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const partsB = String(b ?? "0")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
};

export const isValidVersionString = (value) =>
  typeof value === "string" && /^\d+(\.\d+){0,3}$/.test(value.trim());
