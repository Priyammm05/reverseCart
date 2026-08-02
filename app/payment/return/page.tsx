"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "pending" | "confirmed" | "failed" | "cancelled" | "configuration";

export default function PaymentReturnPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [details, setDetails] = useState<{ transactionId?: string; bookingReference?: string; message?: string }>({});
  const [returnHref, setReturnHref] = useState("/");

  useEffect(() => {
    const sessionId = window.localStorage.getItem("reversecart.pravaSessionId");
    const reservationId = window.localStorage.getItem("reversecart.reservationId");
    const requestId = window.localStorage.getItem("reversecart.requestId");
    const savedRequestId = window.localStorage.getItem("reversecart.requestId");
    if (savedRequestId) setReturnHref(`/market/${savedRequestId}`);
    if (!sessionId) { setStatus("failed"); setDetails({ message: "Payment session was not found on this device." }); return; }
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const response = await fetch(`/api/payment/status?sessionId=${encodeURIComponent(sessionId)}&reservationId=${encodeURIComponent(reservationId || "")}`, { cache: "no-store" });
      const body = await response.json();
      if (body.status === "confirmed") {
        setStatus("confirmed");
        setDetails(body);
        window.localStorage.setItem("reversecart.paymentResult", JSON.stringify({ sessionId, requestId, result: body, savedAt: Date.now() }));
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: "reversecart:payment-confirmed", result: body }, window.location.origin);
          window.setTimeout(() => window.close(), 900);
        }
        return;
      }
      if (body.status === "failed" || !response.ok) { setStatus("failed"); setDetails(body); return; }
      if (body.status === "merchant_checkout_required") { setStatus("configuration"); setDetails(body); return; }
      if (attempts < 20) { setStatus("pending"); window.setTimeout(poll, 1500); }
      else { setStatus("cancelled"); setDetails({ message: "Checkout was not completed and no booking was confirmed. You can safely return to your market and try again." }); }
    };
    void poll();
  }, []);

  return <main className="app-shell"><section className="content-page confirmation page-enter">
    <div className="success-orbit"><span>{status === "confirmed" ? "✓" : status === "failed" || status === "cancelled" ? "!" : "…"}</span></div>
    <span className="kicker">PRAVA PAYMENT</span>
    <h1>{status === "confirmed" ? "Your stay is confirmed." : status === "cancelled" ? "Checkout cancelled." : status === "failed" ? "Payment was not confirmed." : status === "configuration" ? "Merchant checkout needs configuration." : "Verifying your payment…"}</h1>
    <p>{details.message || (status === "confirmed" ? `Booking ${details.bookingReference} · Transaction ${details.transactionId}` : "Keep this page open while ReverseCart verifies the transaction server-side.")}</p>
    <div className="confirmation-actions"><a className="primary merchant-link" href={returnHref}>Return to your market</a></div>
  </section></main>;
}
