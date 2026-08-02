import { formatINR } from "@/lib/domain";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

type MerchantPageProps = {
  searchParams: { booking?: string; transaction?: string; amount?: string };
};

export default function MerchantOrderPage({ searchParams }: MerchantPageProps) {
  const booking = searchParams.booking || "RC-DEMO01";
  const transaction = searchParams.transaction || "DEMO-TXN-DEMO01";
  const amount = Number(searchParams.amount || 7600);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand merchant-link" href="/"><Logo /></a>
        <span className="kicker">MERCHANT CONSOLE</span>
        <div className="sandbox-pill"><span /> Payment demo</div>
      </header>
      <section className="merchant-shell page-enter">
        <div className="merchant-header">
          <div><span className="kicker">LUMA BENGALURU</span><h1>Orders</h1><p>One new reservation won through ReverseCart.</p></div>
          <span className="merchant-status">● CONFIRMED</span>
        </div>
        <div className="merchant-grid">
          <article className="merchant-order card">
            <div className="order-title"><div className="hotel-mark" style={{ background: "#6C5CE7" }}>L</div><div><h2>Tonight · 1 room</h2><p>Late arrival · 1 guest · Breakfast included</p></div><strong>{formatINR(amount)}</strong></div>
            <div className="order-details">
              <div><small>BOOKING REFERENCE</small><b>{booking}</b></div><div><small>ORDER STATUS</small><b className="status-confirmed">CONFIRMED</b></div>
              <div><small>PAYMENT REFERENCE</small><b>{transaction}</b></div><div><small>PAYMENT STATUS</small><b className="status-confirmed">VERIFIED</b></div>
              <div><small>CHECK-IN</small><b>After 10:00 PM</b></div><div><small>CHECK-OUT</small><b>Tomorrow · 12:00 PM</b></div>
            </div>
            <div className="demo-warning"><b>Hackathon test merchant.</b> Hotel inventory and fulfilment are simulated. The current development gateway does not represent a real Prava transaction.</div>
          </article>
          <aside className="merchant-audit card">
            <span className="mini-label">ORDER TIMELINE</span><h3>From bid to booking</h3>
            <div className="merchant-event"><span /><p><b>Request received</b><br /><small>Eligible purchase mandate · max ₹8,000</small></p></div>
            <div className="merchant-event"><span /><p><b>Final offer submitted</b><br /><small>{formatINR(amount)} · breakfast + late checkout</small></p></div>
            <div className="merchant-event"><span /><p><b>Offer selected</b><br /><small>Inventory held pending payment</small></p></div>
            <div className="merchant-event"><span /><p><b>Payment confirmed</b><br /><small>{transaction}</small></p></div>
            <div className="merchant-event"><span /><p><b>Reservation issued</b><br /><small>{booking}</small></p></div>
          </aside>
        </div>
        <a className="ghost solid back-market" href="/">← Back to buyer experience</a>
      </section>
      <SiteFooter merchant />
    </main>
  );
}
