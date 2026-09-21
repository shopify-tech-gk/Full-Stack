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

  interface RazorpayOptions {
    key_id: string;
    key_secret: string;
  }

  class Razorpay {
    constructor(options: RazorpayOptions);
    orders: {
      create(params: RazorpayOrdersCreateParams): Promise<RazorpayOrder>;
    };
  }

  export = Razorpay;
}
