import { Link, useLocation } from "react-router-dom";

const SidebarItem = (props) => {
  const { to, name, children, onClick } = props;
  const location = useLocation();

  const className =
    (location.pathname.startsWith(to) && to !== "/") ||
    (location.pathname === to && to === "/")
      ? "bg-gradient-to-r from-[#2E7BFF] to-[#A855F7] text-white font-semibold"
      : "";

  return (
    <li className="w-full transition">
      <Link
        onClick={() => {
          onClick?.();
          window.scrollTo({ top: 0 });
        }}
        to={to}
      >
        <div
          className={`flex gap-3 items-center px-3 py-2 rounded-xl max-w-70 transition hover:bg-white/10 ${className}`}
        >
          <span className="w-8">{children}</span>
          <div className={`flex-1 min-w-0 `}>
            <span className="block truncate" title={name}>
              {name}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
};

export default SidebarItem;
