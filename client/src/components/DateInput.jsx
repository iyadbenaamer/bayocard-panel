import { useEffect, useRef, useState } from "react";

import CrossIcon from "assets/icons/cross.svg?react";
import ArrowLeftIcon from "assets/icons/arrow-left.svg?react";
import ArrowRightIcon from "assets/icons/arrow-right.svg?react";

const WEEKDAY_LABELS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const MONTH_LABELS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const sizeClasses = {
  sm: "cool-input--sm",
  md: "cool-input--md",
  lg: "cool-input--lg",
};

const pad2 = (value) => String(value).padStart(2, "0");

const toIsoDate = (year, month, day) =>
  `${year}-${pad2(month + 1)}-${pad2(day)}`;

const parseIsoDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month) - 1, day: Number(day) };
};

/**
 * Self-rendered date picker. Native <input type="date"> mirrors its
 * placeholder/segment glyphs under this app's dir="rtl" lang="ar" root
 * (a Chromium quirk with no reliable CSS/attribute fix), so this draws the
 * calendar itself instead of delegating to the OS/browser widget. The value
 * stays a plain "yyyy-mm-dd" string and onChange keeps the same
 * `(event) => event.target.value` shape as a native input so call sites
 * don't need to change.
 */
const DateInput = ({
  label,
  value = "",
  onChange,
  placeholder = "اختر تاريخ",
  size = "md",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const today = new Date();
  const parsed = parseIsoDate(value);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const emitChange = (nextValue) => {
    onChange?.({ target: { value: nextValue } });
  };

  const openCalendar = () => {
    const current = parseIsoDate(value);
    setViewYear(current?.year ?? today.getFullYear());
    setViewMonth(current?.month ?? today.getMonth());
    setIsOpen((prev) => !prev);
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
    } else {
      setViewMonth((month) => month - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
    } else {
      setViewMonth((month) => month + 1);
    }
  };

  const handleSelectDay = (day) => {
    emitChange(toIsoDate(viewYear, viewMonth, day));
    setIsOpen(false);
  };

  const handleClear = (event) => {
    event.stopPropagation();
    emitChange("");
  };

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  const isSelected = (day) =>
    parsed &&
    parsed.year === viewYear &&
    parsed.month === viewMonth &&
    parsed.day === day;
  const isToday = (day) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className={`cool-input ${sizeClasses[size] || sizeClasses.md}`}>
        {label && <span className="cool-input__label">{label}</span>}
        <span className="cool-input__shell">
          <button
            type="button"
            onClick={openCalendar}
            className="custom-input flex w-full items-center justify-between gap-2"
          >
            <span dir="ltr" className={value ? "text-[#0b1b2b]" : "text-slate-600"}>
              {value || placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {value && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleClear(event);
                    }
                  }}
                  className="rounded-full p-0.5 text-slate-600 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="مسح التاريخ"
                >
                  <CrossIcon className="h-3.5 w-3.5" />
                </span>
              )}
              <svg
                className="h-4 w-4 text-slate-600"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </span>
      </label>

      {isOpen && (
        <div
          className="absolute z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
          dir="rtl"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="الشهر السابق"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-700">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="الشهر التالي"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-slate-600">
            {WEEKDAY_LABELS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, index) =>
              day === null ? (
                <span key={`empty-${index}`} />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 rounded-lg text-sm transition ${
                    isSelected(day)
                      ? "bg-primary text-white"
                      : isToday(day)
                        ? "border border-primary/40 text-primary"
                        : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {day}
                </button>
              ),
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                emitChange(
                  toIsoDate(now.getFullYear(), now.getMonth(), now.getDate()),
                );
                setIsOpen(false);
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => {
                emitChange("");
                setIsOpen(false);
              }}
              className="text-xs text-slate-600 hover:underline"
            >
              مسح
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateInput;
