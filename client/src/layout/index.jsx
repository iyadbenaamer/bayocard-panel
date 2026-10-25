import { useEffect, useState } from "react";

import Sidebar from "./sidebar";

import { useWindowWidth } from "hooks/useWindowWidth";

import logo from "assets/logo-full.png";

const Layout = ({ children }) => {
  const windowWidth = useWindowWidth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (windowWidth >= 1024 && isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [windowWidth, isMenuOpen]);

  return (
    <>
      <div className="sticky top-0 z-40 bg-[#242342] text-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <img src={logo} className="w-28" />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10 transition"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span className="sr-only">Toggle menu</span>
            <span className="flex flex-col gap-1">
              <span className="block h-0.5 w-6 bg-white" />
              <span className="block h-0.5 w-6 bg-white" />
              <span className="block h-0.5 w-6 bg-white" />
            </span>
          </button>
        </div>
        <div
          className={`border-t border-white/10 overflow-hidden transition-all duration-200 ease-out ${
            isMenuOpen
              ? "max-h-[calc(100svh-4rem)] opacity-100 overflow-y-auto"
              : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <Sidebar showLogo={false} onItemClick={() => setIsMenuOpen(false)} />
        </div>
      </div>
      <div className="flex min-h-svh bg-slate-50">
        <aside className="sticky top-0 hidden h-svh shrink-0 overflow-hidden bg-[#242342] text-white lg:flex lg:w-70 2xl:w-[320px]">
          <Sidebar />
        </aside>
        <main className="min-w-0 flex-1 pt-2 lg:pt-0">{children}</main>
      </div>
    </>
  );
};

export default Layout;
