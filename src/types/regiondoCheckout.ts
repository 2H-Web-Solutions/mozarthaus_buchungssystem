/**
 * Regiondo Checkout API — subset used for hold / purchase flows.
 * @see https://sandbox-api.regiondo.com/docs/
 */

/**
 * Line item for checkout/totals and checkout/purchase.
 */
export interface RegiondoCartItem {
  product_id: number;
  option_id?: number;
  value?: number;
  value_from?: number;
  value_to?: number;
  value_message?: number;
  /** Y-m-d H:i:s */
  date_time?: string;
  qty: number;
  reservation_code?: string;
  external_item_id?: string;
  source_type?: number;
  as_gift?: number;
}

export interface RegiondoContactDataPurchase {
  firstname?: string;
  lastname?: string;
  email?: string;
  telephone?: string;
  comment?: string;
}

export interface RegiondoBuyerFieldValue {
  title?: string;
  field_id?: number | string;
  required?: boolean;
  type?: string;
  view_type?: string;
  value?: string;
  available_value_ids?: { id: number; title: string }[];
}

export interface RegiondoPaymentOptionEntry {
  name: string;
  value?: string | number;
}

export interface RegiondoPaymentBlock {
  code: string;
  options?: RegiondoPaymentOptionEntry[];
}

/** POST /checkout/purchase body */
export interface RegiondoPurchaseInput {
  items: RegiondoCartItem[];
  contact_data: RegiondoContactDataPurchase;
  buyer_data?: RegiondoBuyerFieldValue[];
  attendee_data?: unknown[];
  assignees?: number[];
  skip_customer_validation?: boolean;
  sub_id?: string;
  source_type?: number;
  coupon_code?: string;
  printer_html?: string;
  payment?: RegiondoPaymentBlock;
}

export interface RegiondoPurchaseResponse {
  order_number?: string;
  order_id?: string;
  purchased_at?: string;
  info_generated_at?: string;
  grand_total?: number;
  currency?: string;
  message?: string;
  items?: unknown[];
  [key: string]: unknown;
}
