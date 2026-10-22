import { useEffect, useId, useRef } from "react";

import HoverScrollContainer from "components/HoverScrollContainer";

import useCloseWidget from "hooks/useCloseWidget";

import CloseIcon from "assets/icons/cross.svg?react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Dialog = (props) => {
  const {
    isOpened,
    setIsOpened,
    children,
    preventClickOutside = false,
    title,
  } = props;
  const prompt = useRef(null);
  const closeButton = useRef(null);
  const previouslyFocused = useRef(null);
  const titleId = useId();

  useCloseWidget(prompt, setIsOpened, preventClickOutside);

  useEffect(() => {
    if (isOpened) {
      document.body.style.height = "100svh";
      document.body.style.overflow = "hidden";
    } else {
      document.body.style = null;
    }
  }, [isOpened]);

  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === "Escape") {
        setIsOpened(false);
      }
    };

    if (isOpened) {
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpened, setIsOpened]);

  // Move focus into the dialog on open, trap Tab inside it, and restore
  // focus to whatever triggered it once it closes.
  useEffect(() => {
    if (!isOpened) return undefined;

    previouslyFocused.current = document.activeElement;
    closeButton.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key !== "Tab" || !prompt.current) return;
      const focusable = prompt.current.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [isOpened]);

  if (!isOpened) return null;

  return (
    <div
      role="presentation"
      className="text-inherit fixed top-0 h-svh w-full z-1150 flex items-center justify-center bg-black/50 p-4"
    >
      <section
        ref={prompt}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="flex w-full max-h-[calc(100svh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-lg md:w-auto md:min-w-md md:max-w-2xl"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3">
          {title && (
            <h2
              id={titleId}
              className="truncate text-lg font-semibold text-slate-800"
            >
              {title}
            </h2>
          )}
          <button
            ref={closeButton}
            type="button"
            aria-label="إغلاق"
            onClick={() => setIsOpened(false)}
            className="ms-auto shrink-0 rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <HoverScrollContainer
          className="min-h-0 flex-1"
          style={{ height: "auto", maxHeight: "none" }}
        >
          <div className="px-4 py-4">{children}</div>
        </HoverScrollContainer>
      </section>
    </div>
  );
};

export default Dialog;
