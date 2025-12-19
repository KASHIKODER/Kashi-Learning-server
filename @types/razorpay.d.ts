declare module "razorpay" {
  export interface RazorpayOptions {
    key_id: string;
    key_secret: string;
  }

  export interface OrderOptions {
    amount: number;
    currency: string;
    receipt?: string;
    notes?: Record<string, any>;
  }

  export interface RazorpayOrder {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string;
    offer_id: string | null;
    status: string;
    attempts: number;
    created_at: number;
  }

  export default class Razorpay {
    constructor(options: RazorpayOptions);
    orders: {
      create(params: OrderOptions): Promise<RazorpayOrder>;
    };
  }
}
