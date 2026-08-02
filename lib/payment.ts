export type PaymentResult = {
  transactionId: string;
  bookingReference: string;
  status: "confirmed";
  confirmedAt: string;
};

export interface PaymentGateway {
  confirmPayment(input: { amount: number; merchant: string }): Promise<PaymentResult>;
}

/**
 * Demo gateway used until Prava sandbox credentials are configured. The UI labels
 * this path clearly; it must be replaced by the documented Prava adapter before submission.
 */
export class DemoPaymentGateway implements PaymentGateway {
  async confirmPayment(_input: { amount: number; merchant: string }): Promise<PaymentResult> {
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return {
      transactionId: `DEMO-TXN-${suffix}`,
      bookingReference: `RC-${suffix}`,
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
    };
  }
}
