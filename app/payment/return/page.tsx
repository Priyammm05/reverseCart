"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "pending" | "confirmed" | "failed" | "configuration";

export default function PaymentReturnPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [details, setDetails] = useState<{ transactionId?: string; bookingReference?: string; message?: string }>({});

  useEffect(() => {
    const sessionId = window.localStorage.getItem("reversecart.pravaSessionId");
    const reservationId = window.localStorage.getItem("reversecart.reservationId");
    if (!sessionId) { setStatus("failed"); setDetails({ message: "Payment session was not found on this device." }); return; }
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const response = await fetch(`/api/payment/status?sessionId=${encodeURIComponent(sessionId)}&reservationId=${encodeURIComponent(reservationId || "")}`, { cache: "no-store" });
      const body = await response.json();
      if (body.status === "confirmed") { setStatus("confirmed"); setDetails(body); return; }
      if (body.status === "failed" || !response.ok) { setStatus("failed"); setDetails(body); return; }
      if (body.status === "merchant_checkout_required") { setStatus("configuration"); setDetails(body); return; }
      if (attempts < 20) { setStatus("pending"); window.setTimeout(poll, 1500); }
      else { setStatus("failed"); setDetails({ message: "Verification timed out. Check the Prava dashboard before retrying." }); }
    };
    void poll();
  }, []);

  return <main className="app-shell"><section className="content-page confirmation page-enter">
    <div className="success-orbit"><span>{status === "confirmed" ? "✓" : status === "failed" ? "!" : "…"}</span></div>
    <span className="kicker">PRAVA PAYMENT</span>
    <h1>{status === "confirmed" ? "Your stay is confirmed." : status === "failed" ? "Payment was not confirmed." : status === "configuration" ? "Merchant checkout needs configuration." : "Verifying your payment…"}</h1>
    <p>{details.message || (status === "confirmed" ? `Booking ${details.bookingReference} · Transaction ${details.transactionId}` : "Keep this page open while ReverseCart verifies the transaction server-side.")}</p>
    <div className="confirmation-actions"><a className="primary merchant-link" href="/">Return to ReverseCart</a></div>
  </section></main>;
}
