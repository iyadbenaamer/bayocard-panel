import { Schema, model } from "mongoose";

const paymentMethodSchema = new Schema(
  {
    // Local payment-method key shown to the mobile app.
    name: { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    iconPath: { type: String, default: "" },
    provider: { type: String, enum: ["ezone"] },
    providerMethodId: { type: Number, min: 1 },
    isOnline: { type: Boolean },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    minDeposit: { type: Number, required: true, min: 0 },
    maxDeposit: { type: Number, default: null, min: 0 },
  },
  { timestamps: true },
);

paymentMethodSchema.index(
  { provider: 1, providerMethodId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerMethodId: { $type: "number" } },
  },
);

paymentMethodSchema.pre("validate", function () {
  if (
    this.minDeposit !== undefined &&
    this.maxDeposit !== undefined &&
    this.maxDeposit !== null &&
    this.maxDeposit <= this.minDeposit
  ) {
    throw new Error("PAYMENT_METHOD_MAX_MUST_EXCEED_MIN");
  }
});

const PaymentMethod = model(
  "PaymentMethod",
  paymentMethodSchema,
  "payment_methods",
);

export default PaymentMethod;
