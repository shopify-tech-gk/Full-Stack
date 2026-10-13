// The `razorpay` npm package ships no bundled TypeScript types and there is
// no `@types/razorpay` package - this is a minimal ambient declaration
// covering only the surface this service actually uses (order creation).
declare module 'razorpay' {
  interface RazorpayOrder {
    id: string;
    amount: number;
    currency: string;
    receipt?: string;
    status: string;
  }

  interface RazorpayOrdersCreateParams {
    amount: number;
    currency: string;
    receipt?: string;
    notes?: Record<string, string>;
  }

  interface RazorpayRefund {
    id: string;
    entity: string;
    amount: number;
    currency: string;
    payment_id: string;
    status: string;
  }

  /** W9: the fields read when verifying a Checkout payment server-side. */
  interface RazorpayPayment {
    id: string;
    entity: string;
    order_id: string;
    amount: number;
    currency: string;
    /** created | authorized | captured | refunded | failed */
    status: string;
  }

  interface RazorpayRefundParams {
    amount?: number;
    notes?: Record<string, string>;
  }

  interface RazorpayOptions {
    key_id: string;
    key_secret: string;
  }

  class Razorpay {
    constructor(options: RazorpayOptions);
    orders: {
      create(params: RazorpayOrdersCreateParams): Promise<RazorpayOrder>;
    };
    payments: {
      refund(paymentId: string, params: RazorpayRefundParams): Promise<RazorpayRefund>;
      fetch(paymentId: string): Promise<RazorpayPayment>;
      capture(paymentId: string, amount: number, currency: string): Promise<RazorpayPayment>;
    };
  }

  export = Razorpay;
}
