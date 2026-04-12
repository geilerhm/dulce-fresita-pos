/** Centralized status/type constants — single source of truth */

export const OrderStatus = {
  PENDING: "pending",
  PREPARING: "preparing",
  READY: "ready",
  DELIVERING: "delivering",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;
export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderType = {
  LOCAL: "local",
  DELIVERY: "delivery",
} as const;
export type OrderTypeValue = (typeof OrderType)[keyof typeof OrderType];

export const PaymentMethod = {
  EFECTIVO: "efectivo",
  NEQUI: "nequi",
} as const;
export type PaymentMethodType = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const RegisterStatus = {
  OPEN: "open",
  CLOSED: "closed",
} as const;

export const SaleStatus = {
  COMPLETED: "completed",
  VOIDED: "voided",
} as const;

export const CategoryType = {
  PRODUCT: "product",
  INGREDIENT: "ingredient",
} as const;
