export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo-lockup" aria-label="ReverseCart">
      <svg className="logo-symbol" viewBox="0 0 44 44" aria-hidden="true">
        <path className="logo-tile" d="M7 4h30a3 3 0 0 1 3 3v30a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
        <path className="logo-arrow" d="M11 15h15l-4-4m4 4-4 4M33 29H18l4 4m-4-4 4-4" />
        <path className="logo-cut" d="M29 11v22" />
      </svg>
      {!compact && <span className="logo-word">Reverse<span>Cart</span></span>}
    </span>
  );
}
