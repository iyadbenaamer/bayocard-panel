import axios from "axios";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const getClient = () => {
  const apiKey = process.env.EZONE_API_KEY;
  if (!apiKey || apiKey === "REPLACE_ME") {
    const error = new Error("EZONE_API_KEY_MISSING");
    error.code = "EZONE_API_KEY_MISSING";
    throw error;
  }

  return axios.create({
    baseURL: trimTrailingSlash(
      process.env.EZONE_API_BASE_URL || "https://test.ezonepay.ly",
    ),
    headers: {
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
    timeout: Number(process.env.EZONE_API_TIMEOUT_MS || 30000),
  });
};

export const getPaymentMethods = async () => {
  let response;
  try {
    response = await getClient().get("/LookUp/paymentMethods");
  } catch (error) {
    if (error.code === "EZONE_API_KEY_MISSING") throw error;
    const transformed = new Error(
      error?.response ? "EZONE_API_REQUEST_FAILED" : "EZONE_API_UNAVAILABLE",
    );
    transformed.code = error?.response
      ? "EZONE_API_REQUEST_FAILED"
      : "EZONE_API_UNAVAILABLE";
    transformed.status = error?.response?.status;
    throw transformed;
  }

  const findMethods = (value, depth = 0) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object" || depth >= 4) return null;

    for (const key of [
      "paymentMethods",
      "PaymentMethods",
      "items",
      "Items",
      "data",
      "Data",
      "result",
      "Result",
    ]) {
      const result = findMethods(value[key], depth + 1);
      if (result) return result;
    }
    return null;
  };
  const methods = findMethods(response.data);
  if (!Array.isArray(methods)) {
    const error = new Error("EZONE_API_RESPONSE_INVALID");
    error.code = "EZONE_API_RESPONSE_INVALID";
    throw error;
  }
  return methods;
};

export const getDepositLimits = (method) => {
  const pick = (...values) => values.find((value) => value !== undefined);
  const rawMinimum = pick(
    method?.minPayment,
    method?.MinPayment,
    method?.minAmount,
    method?.MinAmount,
    method?.minimumAmount,
    method?.MinimumAmount,
    method?.amountMin,
    method?.AmountMin,
    method?.minDeposit,
    method?.MinDeposit,
    method?.minimum,
    method?.Minimum,
  );
  const rawMaximum = pick(
    method?.maxPayment,
    method?.MaxPayment,
    method?.maxAmount,
    method?.MaxAmount,
    method?.maximumAmount,
    method?.MaximumAmount,
    method?.amountMax,
    method?.AmountMax,
    method?.maxDeposit,
    method?.MaxDeposit,
    method?.maximum,
    method?.Maximum,
  );
  const minDeposit = rawMinimum == null ? 0 : Number(rawMinimum);
  if (!Number.isFinite(minDeposit) || minDeposit < 0) {
    const error = new Error("EZONE_API_RESPONSE_INVALID");
    error.code = "EZONE_API_RESPONSE_INVALID";
    throw error;
  }

  let maxDeposit = null;
  if (rawMaximum !== undefined && rawMaximum !== null && rawMaximum !== "") {
    maxDeposit = Number(rawMaximum);
    if (!Number.isFinite(maxDeposit) || maxDeposit <= minDeposit) {
      const error = new Error("EZONE_API_RESPONSE_INVALID");
      error.code = "EZONE_API_RESPONSE_INVALID";
      throw error;
    }
  }

  return { minDeposit, maxDeposit };
};
