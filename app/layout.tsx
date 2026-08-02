import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReverseCart — Make sellers compete",
  description: "A buyer-first marketplace powered by Prava.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const bypass = process.env.NEXT_PUBLIC_PLAYWRIGHT_BYPASS_AUTH === "1";
  return (
    <html lang="en">
      <body>{bypass ? children : <ClerkProvider>{children}</ClerkProvider>}</body>
    </html>
  );
}
