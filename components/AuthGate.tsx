"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import { useState } from "react";
import { Logo } from "./Logo";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const bypass = process.env.NEXT_PUBLIC_PLAYWRIGHT_BYPASS_AUTH === "1";
  if (bypass) return <>{children}</>;
  return <ClerkAuthGate>{children}</ClerkAuthGate>;
}

function ClerkAuthGate({ children }: { children: React.ReactNode }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn: clerkSignIn } = useSignIn();
  const [error, setError] = useState("");

  async function startGoogleSignIn() {
    setError("");
    try {
      if (!clerkSignIn) throw new Error("Clerk is still loading.");
      await clerkSignIn.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: "/" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Google sign-in could not be started."); }
  }

  if (isSignedIn) return <>{children}</>;
  if (!isLoaded) return <main className="auth-shell"><div className="auth-loading" aria-label="Checking sign-in"><span /></div></main>;
  return <main className="auth-shell">
    <section className="auth-card">
      <Logo />
      <div className="auth-visual" aria-hidden="true"><span>BUYER</span><i>→</i><b>3 OFFERS</b><i>→</i><strong>1 WINNER</strong></div>
      <span className="kicker">YOUR PRIVATE BUYER AGENT</span>
      <h1>One identity.<br />Your own market.</h1>
      <p>Sign in to publish purchase requests, compare merchant bids, and keep every reservation and transaction in your private history.</p>
      <button className="google-button" onClick={startGoogleSignIn} disabled={!configured}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4L15.4 17c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.4H3a10 10 0 0 0 0 9.2l3.4-2.7Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 3 7.4l3.4 2.7C7.2 7.8 9.4 6 12 6Z"/></svg>
        Continue with Google
      </button>
      {!configured && <p className="auth-note">The Clerk publishable key is not configured yet. Add it to `.env.local` to enable sign-in.</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <small>Google is the only sign-in method. ReverseCart never receives your Google password.</small>
    </section>
  </main>;
}
