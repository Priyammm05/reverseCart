import { Logo } from "./Logo";

export function SiteFooter({ merchant = false }: { merchant?: boolean }) {
  return <footer className="site-footer">
    <div className="footer-brand">
      <Logo />
      <p>{merchant ? "Merchant-side proof of a buyer-led market." : "Your request. Their best offer. One guarded checkout."}</p>
    </div>
    <nav className="footer-links" aria-label="Footer navigation">
      <a href="/">New market</a>
      <a href="/history">My requests</a>
      <a href="/merchant/luma">Merchant demo</a>
    </nav>
    <div className="footer-status">
      <span><i /> DEMO ENVIRONMENT</span>
      <small>Inventory simulated · Prava adapter ready</small>
    </div>
  </footer>;
}
