import { useEffect } from "react";
import { Navigate, Route, Routes, BrowserRouter } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";

import Home from "pages/home";
import Login from "pages/login";
import NotFound from "pages/NotFound";
import Users from "pages/users";
import Orders from "pages/orders";
import Transactions from "pages/transactions";
import RequestLogs from "pages/requestLogs";

import PopupMessage from "components/popup-message";
import { DialogProvider } from "components/dialog/DialogContext";
import { BreadcrumbProvider } from "components/breadcrumb/BreadcrumbContext";
import User from "pages/users/user";
import ManageCards from "pages/manage-cards";
import Cards from "pages/cards";
import Settings from "pages/settings";
import Deals from "pages/deals";
import PaymentMethods from "pages/payment-methods";
import Discounts from "pages/discounts";
import Notifications from "pages/notifications";

const App = () => {
  //if user is stored in redux state, then the user is logged in
  const admin = useSelector((state) => state.admin);
  const isLoggedin = Boolean(admin);

  useEffect(() => {
    /*
      the app's loading effect dependes on this variable, when the app
      loads for the first time then the loading effect will be triggered 
      after that it won't be triggered because of this variable.
    */
    if (isLoggedin) {
      sessionStorage.setItem("isLoaded", true);
    }
  }, [isLoggedin]);

  return (
    <DialogProvider>
      <BreadcrumbProvider>
        <div className="App">
          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "linear" }}
          >
            <BrowserRouter>
              <Routes>
                <Route
                  path="/"
                  element={
                    isLoggedin ? <Home /> : <Navigate to="/login" replace />
                  }
                />
                <Route
                  path="/users"
                  element={
                    isLoggedin ? <Users /> : <Navigate to="/login" replace />
                  }
                />
                <Route
                  path="/users/:id"
                  element={
                    isLoggedin ? <User /> : <Navigate to="/login" replace />
                  }
                />
                <Route
                  path="/cards"
                  element={
                    isLoggedin ? <Cards /> : <Navigate to="/login" replace />
                  }
                />
                <Route
                  path="/orders"
                  element={
                    isLoggedin ? <Orders /> : <Navigate to="/login" replace />
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    isLoggedin ? (
                      <Transactions />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  }
                />
                <Route
                  path="/request-logs"
                  element={
                    isLoggedin ? (
                      <RequestLogs />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  }
                />
                <Route
                  path="/manage-cards"
                  element={
                    isLoggedin ? (
                      <ManageCards />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  }
                />

                <Route
                  path="/settings"
                  element={
                    isLoggedin ? (
                      <Settings />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  }
                />
                <Route
                  path="/deals"
                  element={
                    isLoggedin ? <Deals /> : <Navigate to="/login" replace />
                  }
                />
                <Route
                  path="/payment-methods"
                  element={
                    isLoggedin ? (
                      <PaymentMethods />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  }
                />
                <Route
                  path="/discounts"
                  element={
                    isLoggedin ? (
                      <Discounts />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    isLoggedin ? (
                      <Notifications />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  }
                />
                <Route
                  path="/login"
                  element={
                    !isLoggedin ? <Login /> : <Navigate to="/" replace />
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            <PopupMessage />
          </motion.main>
        </div>
      </BreadcrumbProvider>
    </DialogProvider>
  );
};
export default App;
