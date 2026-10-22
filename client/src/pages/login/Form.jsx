import { useRef, useState } from "react";
import { useDispatch } from "react-redux";

import CustomInput from "components/CustomInput";
import SubmitBtn from "components/SubmitBtn";
import Alert from "components/Alert";

import axiosClient from "utils/AxiosClient";
import { getApiErrorMessage } from "utils/errorMessages";
import { setAdmin } from "state";

import ShowPasswordIcon from "assets/icons/eye.svg?react";
import HidePasswordIcon from "assets/icons/hide.svg?react";

const Form = () => {
  const [data, setData] = useState({ username: "", password: "" });
  const [touched, setTouched] = useState({ username: false, password: false });
  const [message, setMessage] = useState("");
  const dispatch = useDispatch();
  const submitButton = useRef(null);
  const [passwordInputType, setPasswordInputType] = useState("password");

  const errors = {
    username: touched.username && !data.username ? "مطلوب" : "",
    password: touched.password && !data.password ? "مطلوب" : "",
  };

  const handleEnterSubmit = (e) => {
    if (e.key === "Enter") {
      submitButton.current.click();
    }
  };

  const submit = async () => {
    setTouched({ username: true, password: true });
    if (!data.username || !data.password) return;

    await axiosClient
      .post(`/login`, data)
      .then((response) => {
        const { admin } = response.data;
        dispatch(setAdmin(admin));
        if (admin?.username) {
          localStorage.setItem("adminName", admin.username);
        }
      })
      .catch((error) => {
        setMessage(
          getApiErrorMessage(error, "حدث خطأ غير متوقع، يرجى المحاولة لاحقًا"),
        );
      });
  };

  return (
    <section className="flex flex-col gap-4 w-full max-w-md center">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CustomInput
          label="اسم المستخدم"
          name="username"
          autoFocus
          value={data.username}
          onChange={(e) => {
            setData({ ...data, username: e.target.value });
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
          onKeyDown={handleEnterSubmit}
          aria-invalid={Boolean(errors.username)}
          aria-describedby="username-error"
        />
        <div>
          <label className="cool-input cool-input--md">
            <span className="cool-input__label">كلمة المرور</span>
            <span className="cool-input__shell relative block">
              <input
                className="custom-input pe-8"
                autoComplete="off"
                type={passwordInputType}
                name="password"
                value={data.password}
                onChange={(e) => {
                  setData({ ...data, password: e.target.value });
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                onKeyDown={handleEnterSubmit}
                aria-invalid={Boolean(errors.password)}
                aria-describedby="password-error"
              />
              <button
                type="button"
                className="absolute w-5 left-2 top-1/2 -translate-y-1/2 text-primary"
                aria-label={
                  passwordInputType === "password"
                    ? "إظهار كلمة المرور"
                    : "إخفاء كلمة المرور"
                }
                onClick={() =>
                  setPasswordInputType(
                    passwordInputType === "password" ? "text" : "password",
                  )
                }
              >
                {passwordInputType === "password" ? (
                  <ShowPasswordIcon />
                ) : (
                  <HidePasswordIcon />
                )}
              </button>
            </span>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 -mt-2 text-xs text-rose-700">
        <div id="username-error">{errors.username}</div>
        <div id="password-error">{errors.password}</div>
      </div>
      <Alert tone="error">{message}</Alert>
      <div className="self-center">
        <SubmitBtn
          ref={submitButton}
          onClick={async () => {
            await submit();
          }}
        >
          تسجيل الدخول
        </SubmitBtn>
      </div>
    </section>
  );
};
export default Form;
