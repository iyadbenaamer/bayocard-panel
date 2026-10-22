import { useDispatch } from "react-redux";

import SidebarItem from "./SidebarItem";

import { logout } from "state";

import logo from "assets/logo-full.png";
import HomeIcon from "assets/icons/home.svg?react";
import CategoriesIcon from "assets/icons/categories.svg?react";
import UsersIcon from "assets/icons/users.svg?react";
import CardIcon from "assets/icons/card.svg?react";
import OrdersIcon from "assets/icons/orders.svg?react";
import TransactionsIcon from "assets/icons/transactions.svg?react";
import LogsIcon from "assets/icons/logs.svg?react";
import SettingsIcon from "assets/icons/settings.svg?react";
import DealsIcon from "assets/icons/deals.svg?react";
import PaymentMethodsIcon from "assets/icons/payment-methods.svg?react";
import DiscountIcon from "assets/icons/discount.svg?react";
import NotificationsIcon from "assets/icons/notifications.svg?react";
import LogoutIcon from "assets/icons/logout.svg?react";

const Sidebar = ({ showLogo = true, onItemClick }) => {
  const dispatch = useDispatch();

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {showLogo && (
          <img src={logo} alt="Logo" className="w-70 mx-auto my-3" />
        )}
        <ul className="flex flex-col gap-3 px-4 w-full py-5">
          <SidebarItem to="/" name="الرئيسية" onClick={onItemClick}>
            <HomeIcon />
          </SidebarItem>
          <SidebarItem
            to="/users"
            name="إدارة المستخدمين"
            onClick={onItemClick}
          >
            <UsersIcon />
          </SidebarItem>
          <SidebarItem
            to="/manage-cards"
            name="إدارة البطاقات"
            onClick={onItemClick}
          >
            <CategoriesIcon />
          </SidebarItem>
          <SidebarItem to="/cards" name="جميع البطاقات" onClick={onItemClick}>
            <CardIcon />
          </SidebarItem>
          <SidebarItem to="/orders" name="جميع الطلبات" onClick={onItemClick}>
            <OrdersIcon />
          </SidebarItem>
          <SidebarItem
            to="/transactions"
            name="جميع المعاملات"
            onClick={onItemClick}
          >
            <TransactionsIcon fill="transparent" />
          </SidebarItem>
          <SidebarItem
            to="/request-logs"
            name="سجل النشاط"
            onClick={onItemClick}
          >
            <LogsIcon fill="transparent" />
          </SidebarItem>
          <SidebarItem
            to="/deals"
            name="العروض الترويجية"
            onClick={onItemClick}
          >
            <DealsIcon />
          </SidebarItem>
          <SidebarItem to="/discounts" name="التخفيضات" onClick={onItemClick}>
            <DiscountIcon />
          </SidebarItem>
          <SidebarItem
            to="/payment-methods"
            name="وسائل الدفع"
            onClick={onItemClick}
          >
            <PaymentMethodsIcon />
          </SidebarItem>
          <SidebarItem
            to="/notifications"
            name="الإشعارات"
            onClick={onItemClick}
          >
            <NotificationsIcon />
          </SidebarItem>
          <SidebarItem to="/settings" name="الإعدادات" onClick={onItemClick}>
            <SettingsIcon />
          </SidebarItem>
        </ul>
      </div>
      <div className="shrink-0 p-4">
        <button
          type="button"
          className="flex w-full gap-3 text-rose-300 p-2 items-center cursor-pointer rounded-xl hover:bg-white/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
          onClick={() => {
            dispatch(logout());
            onItemClick?.();
          }}
        >
          <LogoutIcon className="w-9 inline mr-2 -ml-1" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
