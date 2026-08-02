"use client";

import { useClerk, useUser } from "@clerk/nextjs";

export function UserMenu() {
  const bypass = process.env.NEXT_PUBLIC_PLAYWRIGHT_BYPASS_AUTH === "1";
  if (bypass) return <div className="user-menu"><a href="/history">My requests</a><button disabled aria-label="Test buyer">T</button></div>;
  return <ClerkUserMenu />;
}

function ClerkUserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const name = user?.firstName || user?.primaryEmailAddress?.emailAddress.split("@")[0] || "Account";
  return <div className="user-menu"><a href="/history">My requests</a><button onClick={() => signOut({ redirectUrl: "/" })} aria-label={`Sign out ${name}`}>{name.slice(0,1).toUpperCase()}</button></div>;
}
