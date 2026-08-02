"use client";

import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { SiteFooter } from "./SiteFooter";
import { destinationFromPrompt } from "@/lib/request";

type SavedRequest = { id: string; raw_prompt: string; destination: string; timing: string; max_total_minor: number; status: string; created_at: string; offers?: Array<{ id: string }> };

const statusLabels: Record<string, string> = { draft: "Draft", open: "Auction live", closed: "Market complete", selected: "Hotel selected", payment_pending: "Payment pending", completed: "Completed", payment_failed: "Payment failed" };

export function HistoryView() {
  const [requests, setRequests] = useState<SavedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/requests").then((response) => response.json()).then((body) => setRequests(body.requests || [])).finally(() => setLoading(false)); }, []);
  return <main className="app-shell"><header className="topbar history-topbar"><a className="brand merchant-link" href="/"><Logo /></a><span className="kicker history-nav-label">PRIVATE BUYER HISTORY</span><a className="nav-cta merchant-link" href="/"><span>＋</span> New request</a></header><section className="history-page"><div className="section-heading"><span className="kicker">MY REQUESTS</span><h1>Your markets, decisions and bookings.</h1><p>Only records owned by your signed-in account are returned.</p></div>{loading ? <div className="history-empty">Loading your requests…</div> : requests.length === 0 ? <div className="history-empty"><h2>No requests yet.</h2><p>Publish your first purchase request and it will appear here.</p><a className="primary merchant-link" href="/">Create a request →</a></div> : <div className="history-list">{requests.map((item) => { const destination = destinationFromPrompt(item.raw_prompt, item.destination); const resumable = ["draft", "open", "closed", "selected", "payment_pending"].includes(item.status); const action = item.status === "closed" ? "Review offers" : item.status === "draft" ? "Complete request" : item.status === "open" ? "Continue auction" : "Open details"; return <a className="history-row card history-link" href={resumable ? `/?resume=${item.id}` : `/history/${item.id}`} key={item.id} aria-label={`${action} for ${destination}`}><div><span className="status-chip">{statusLabels[item.status] || item.status}</span><h2>{destination} <span className="row-arrow">↗</span></h2><p>{item.raw_prompt}</p>{resumable && <span className="draft-action">{action} <b>→</b></span>}</div><dl><div><dt>When</dt><dd>{item.timing}</dd></div><div><dt>Budget</dt><dd>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(item.max_total_minor / 100)}</dd></div><div><dt>Offers</dt><dd>{item.offers?.length || 0}</dd></div><div><dt>Created</dt><dd>{new Date(item.created_at).toLocaleDateString()}</dd></div></dl></a>; })}</div>}</section><SiteFooter /></main>;
}
