"use client";

import { useEffect, useMemo, useState } from "react";
import { bidEvents, formatINR, initialOffers, Offer, scoreOffer, Stage } from "@/lib/domain";
import { destinationFromPrompt, fallbackInterpretation, interpretFallback, InterpretedRequest } from "@/lib/request";
import { Logo } from "@/components/Logo";
import { AuthGate } from "@/components/AuthGate";
import { UserMenu } from "@/components/UserMenu";
import { SiteFooter } from "@/components/SiteFooter";

const requestHints = [
  "Hotel near the hackathon venue tonight, under ₹8,000, with late check-in.",
  "Two family rooms in Bengaluru this weekend, under ₹12,000, with breakfast.",
  "An airport hotel for an early flight, under ₹6,500, with a free shuttle.",
  "An accessible hotel near the city centre tomorrow, under ₹7,500.",
  "A quiet business hotel for three nights, with Wi-Fi and free cancellation.",
];

const steps: { id: Stage; label: string }[] = [
  { id: "request", label: "Request" },
  { id: "bidding", label: "Offers" },
  { id: "payment", label: "Payment" },
  { id: "confirmed", label: "Confirmed" },
];

const auctionDurations = [
  { seconds: 60, label: "1 minute" },
  { seconds: 120, label: "2 minutes" },
  { seconds: 300, label: "5 minutes" },
];

function formatCountdown(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function stageIndex(stage: Stage) {
  if (stage === "review") return 0;
  if (stage === "decision") return 1;
  return steps.findIndex((step) => step.id === stage);
}

function datesForTiming(timing: string) {
  const checkin = new Date();
  checkin.setHours(12, 0, 0, 0);
  const lower = timing.toLowerCase();
  if (lower.includes("tomorrow")) checkin.setDate(checkin.getDate() + 1);
  if (lower.includes("weekend")) {
    const daysUntilSaturday = (6 - checkin.getDay() + 7) % 7 || 7;
    checkin.setDate(checkin.getDate() + daysUntilSaturday);
  }
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const requestedDay = weekdays.findIndex((day) => lower.includes(day));
  if (requestedDay >= 0) {
    const daysUntil = (requestedDay - checkin.getDay() + 7) % 7 || 7;
    checkin.setDate(checkin.getDate() + daysUntil);
  }
  const checkout = new Date(checkin);
  const nights = Number(lower.match(/(\d+)\s*nights?/)?.[1] || 1);
  checkout.setDate(checkout.getDate() + Math.max(1, nights));
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { checkin: iso(checkin), checkout: iso(checkout) };
}

function ReverseCartApp() {
  const [stage, setStage] = useState<Stage>("request");
  const [request, setRequest] = useState("");
  const [hintIndex, setHintIndex] = useState(0);
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [legOffers, setLegOffers] = useState<Offer[][]>([]);
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [auctionDuration, setAuctionDuration] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [paying, setPaying] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<InterpretedRequest>(fallbackInterpretation);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ transactionId: string; bookingReference: string; confirmedAt: string } | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [selectedLegOfferIds, setSelectedLegOfferIds] = useState<Record<number, string>>({});
  const [activeDecisionLeg, setActiveDecisionLeg] = useState(0);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [hotelSource, setHotelSource] = useState<"fixture" | "geoapify" | "liteapi">("fixture");
  const [hotelReference, setHotelReference] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<"checking" | "demo" | "prava">("checking");
  const [resumeLoading, setResumeLoading] = useState(false);
  const [restoreStops, setRestoreStops] = useState<string[]>(["Stop 1", "Stop 2"]);

  useEffect(() => {
    fetch("/api/payment/readiness", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => setPaymentMode(body.mode === "prava" ? "prava" : "demo"))
      .catch(() => setPaymentMode("demo"));
  }, []);

  useEffect(() => {
    if (request || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setHintIndex((index) => (index + 1) % requestHints.length), 3200);
    return () => window.clearInterval(timer);
  }, [request]);

  useEffect(() => {
    const resumeId = new URLSearchParams(window.location.search).get("resume");
    if (!resumeId) return;
    setResumeLoading(true);
    fetch(`/api/requests/${encodeURIComponent(resumeId)}`).then(async (response) => {
      if (!response.ok) throw new Error("Saved draft could not be opened.");
      const body = await response.json();
      const saved = body.request;
      if (!saved) throw new Error("Saved draft was not found.");
      const recovered = interpretFallback(saved.raw_prompt);
      if ((recovered.legs?.length || 0) > 1) setRestoreStops(recovered.legs!.map((leg) => leg.destination));
      setRequest(saved.raw_prompt);
      setRequestId(resumeId);
      setInterpretation({ destination: destinationFromPrompt(saved.raw_prompt, saved.destination), timing: saved.timing || recovered.timing, guests: recovered.guests, rooms: recovered.rooms, maxTotalMinor: recovered.maxTotalMinor, required: saved.required_constraints?.length ? saved.required_constraints : recovered.required, preferred: saved.preferred_constraints?.length ? saved.preferred_constraints : recovered.preferred });
      if (Array.isArray(body.offers) && body.offers.length) {
        setOffers(body.offers.map((offer: { merchant_id: string; merchant_name: string; total_minor: number; benefits?: string[]; cancellation?: string; distance_km?: number; selected?: boolean }, index: number) => ({ id: offer.merchant_id, hotel: offer.merchant_name, mark: offer.merchant_name.slice(0, 1).toUpperCase(), color: initialOffers[index % initialOffers.length].color, price: offer.total_minor / 100, openingPrice: offer.total_minor / 100, distance: Number(offer.distance_km || 0), rating: initialOffers[index % initialOffers.length].rating, benefits: offer.benefits || [], cancellation: offer.cancellation || "Terms unavailable", selected: offer.selected })));
        const selected = body.offers.find((offer: { selected?: boolean }) => offer.selected);
        if (selected) setSelectedOfferId(selected.merchant_id);
      }
      if (saved.status !== "draft") {
        fetch("/api/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: saved.raw_prompt }) }).then((response) => response.json()).then(async (interpretedBody) => {
          const interpreted = interpretedBody.data as InterpretedRequest | undefined;
          if (!interpreted) return;
          setInterpretation(interpreted);
          const legs = interpreted.legs?.length ? interpreted.legs : [{ destination: interpreted.destination, timing: interpreted.timing }];
          if (legs.length < 2) return;
          const markets = await Promise.all(legs.map(async (leg, legIndex) => {
            const legDates = datesForTiming(leg.timing);
            const params = new URLSearchParams({ destination: leg.destination, checkin: legDates.checkin, checkout: legDates.checkout, guests: String(interpreted.guests), rooms: String(interpreted.rooms) });
            const hotelBody = await fetch(`/api/hotels?${params}`).then((response) => response.json());
            if (!["geoapify", "liteapi"].includes(hotelBody.source) || !Array.isArray(hotelBody.hotels) || hotelBody.hotels.length < 3) return initialOffers.map((offer, index) => ({ ...offer, id: `${legIndex}-${offer.id}`, hotel: `${leg.destination} fallback ${index + 1}`, mark: String(index + 1), dataSource: "fixture" as const }));
            return initialOffers.map((offer, index) => { const hotel = hotelBody.hotels[index]; const livePrice = hotel.liveTotal ? Math.round(hotel.liveTotal) : offer.price; return { ...offer, id: `${legIndex}-${hotel.id || offer.id}`, price: livePrice, openingPrice: livePrice, hotel: hotel.name, mark: hotel.name.slice(0, 1).toUpperCase(), distance: hotel.distanceKm, rating: hotel.rating || offer.rating, address: hotel.address, latitude: hotel.latitude, longitude: hotel.longitude, imageUrl: hotel.imageUrl, imageSourceUrl: hotel.imageSourceUrl, imageProvider: hotel.imageProvider, dataSource: hotelBody.source }; });
          }));
          setLegOffers(markets);
          setOffers(markets[0]);
        }).catch(() => undefined).finally(() => setResumeLoading(false));
      } else {
        setResumeLoading(false);
      }
      setStage(saved.status === "selected" || saved.status === "payment_pending" || saved.status === "closed" ? "decision" : saved.status === "open" ? "bidding" : "review");
      window.history.replaceState({}, "", "/");
    }).catch((cause) => { setError(cause.message); setResumeLoading(false); });
  }, []);

  useEffect(() => {
    if (stage !== "bidding") return;
    if (timeLeft <= 0) {
      if (requestId) void fetch(`/api/requests/${requestId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "closed" }) });
      setStage("decision");
      return;
    }

    const timer = window.setTimeout(() => {
      const elapsed = auctionDuration - timeLeft + 1;
      const auctionBeat = Math.ceil((elapsed / auctionDuration) * 18);
      setTimeLeft((value) => value - 1);
      const nextCount = bidEvents.filter((event) => event.at <= auctionBeat).length;
      setVisibleEvents(nextCount);

      if (auctionBeat >= 8 && hotelSource !== "liteapi") {
        setOffers((current) => current.map((offer) => (offer.id === "mora" ? { ...offer, price: 7300 } : offer)));
      }
      if (auctionBeat >= 11) {
        setOffers((current) =>
          current.map((offer) =>
            offer.id === "luma" && !offer.benefits.includes("Late checkout")
              ? { ...offer, benefits: [...offer.benefits, "Late checkout"] }
              : offer,
          ),
        );
      }
      if (auctionBeat >= 14 && hotelSource !== "liteapi") {
        setOffers((current) => current.map((offer) => (offer.id === "luma" ? { ...offer, price: 7600 } : offer)));
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [stage, timeLeft, hotelSource, auctionDuration, requestId]);

  const ranked = useMemo(
    () => [...offers].sort((a, b) => scoreOffer(b) - scoreOffer(a)),
    [offers],
  );
  const primaryWinner = offers.find((offer) => offer.id === selectedOfferId) || ranked[0];
  const tripLegs = interpretation.legs?.length ? interpretation.legs : [{ destination: interpretation.destination, timing: interpretation.timing }];
  const linkedWinners = legOffers.length > 1 ? legOffers.map((items, index) => items.find((offer) => offer.id === selectedLegOfferIds[index]) || [...items].sort((a, b) => scoreOffer(b) - scoreOffer(a))[0]) : [primaryWinner];
  const activeMarketOffers = legOffers.length > 1 ? legOffers[activeDecisionLeg] || [] : offers;
  const winner = legOffers.length > 1 ? linkedWinners[activeDecisionLeg] || primaryWinner : primaryWinner;
  const combinedTotal = linkedWinners.reduce((total, offer) => total + (offer?.price || 0), 0);
  const payableTotal = legOffers.length > 1 ? combinedTotal : winner.price;
  const activeStep = stageIndex(stage);

  function startOver() {
    setStage("request");
    setOffers(initialOffers);
    setLegOffers([]);
    setVisibleEvents(0);
    setAuctionDuration(60);
    setTimeLeft(60);
    setReceipt(null);
    setSelectedOfferId(null);
    setSelectedLegOfferIds({});
    setActiveDecisionLeg(0);
    setShowAlternatives(false);
    setRequest("");
    setRequestId(null);
  }

  async function interpret() {
    setInterpreting(true);
    setError("");
    const response = await fetch("/api/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: request }) });
    const body = await response.json();
    setInterpreting(false);
    if (!response.ok) { setError(body.error || "Could not interpret the request."); return; }
    setInterpretation(body.data);
    setHotelReference(body.data.destination);
    const stayDates = datesForTiming(body.data.timing);
    const hotelParams = new URLSearchParams({ destination: body.data.destination, checkin: stayDates.checkin, checkout: stayDates.checkout, guests: String(body.data.guests), rooms: String(body.data.rooms) });
    const legs = body.data.legs?.length ? body.data.legs : [{ destination: body.data.destination, timing: body.data.timing }];
    Promise.all(legs.map(async (leg: { destination: string; timing: string }, legIndex: number) => {
      const legDates = datesForTiming(leg.timing);
      const params = new URLSearchParams({ destination: leg.destination, checkin: legDates.checkin, checkout: legDates.checkout, guests: String(body.data.guests), rooms: String(body.data.rooms) });
      const hotelBody = await fetch(`/api/hotels?${params}`).then((hotelResponse) => hotelResponse.json());
      if (!["geoapify", "liteapi"].includes(hotelBody.source) || !Array.isArray(hotelBody.hotels) || hotelBody.hotels.length < 3) return initialOffers.map((offer, index) => ({ ...offer, id: `${legIndex}-${offer.id}`, hotel: `${leg.destination} fallback ${index + 1}`, mark: String(index + 1), dataSource: "fixture" as const }));
      setHotelSource(hotelBody.source);
      if (legIndex === 0) setHotelReference(hotelBody.reference?.label || leg.destination);
      return initialOffers.map((offer, index) => { const hotel = hotelBody.hotels[index]; const livePrice = hotel.liveTotal ? Math.round(hotel.liveTotal) : offer.price; return ({ ...offer, id: `${legIndex}-${hotel.id || offer.id}`, price: livePrice, openingPrice: livePrice, hotel: hotel.name, mark: hotel.name.slice(0, 1).toUpperCase(), distance: hotel.distanceKm, rating: hotel.rating || offer.rating, address: hotel.address, latitude: hotel.latitude, longitude: hotel.longitude, imageUrl: hotel.imageUrl, imageSourceUrl: hotel.imageSourceUrl, imageProvider: hotel.imageProvider, dataSource: hotelBody.source }); });
    })).then((markets) => { setLegOffers(markets); setOffers(markets[0] || initialOffers); }).catch(() => undefined);
    const saved = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawPrompt: request, ...body.data }) });
    if (saved.ok) { const savedBody = await saved.json(); setRequestId(savedBody.request.id); }
    setStage("review");
  }

  async function openAuction() {
    setTimeLeft(auctionDuration);
    setVisibleEvents(0);
    setStage("bidding");
    if (!requestId) return;
    const allOffers = legOffers.length > 1 ? legOffers.flat() : offers;
    await fetch(`/api/requests/${requestId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "open", offers: allOffers.map((offer) => ({ merchantId: offer.id, merchantName: offer.hotel, totalMinor: offer.price * 100, benefits: offer.benefits, cancellation: offer.cancellation, distanceKm: offer.distance, score: scoreOffer(offer), selected: false })) }) });
  }

  async function selectOffer(offer: Offer) {
    const legIndex = legOffers.findIndex((market) => market.some((item) => item.id === offer.id));
    if (legIndex >= 0) setSelectedLegOfferIds((selected) => ({ ...selected, [legIndex]: offer.id }));
    setSelectedOfferId(offer.id);
    setShowAlternatives(false);
    if (!requestId) return;
    await fetch(`/api/requests/${requestId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "selected", selectedMerchantId: offer.id, offers: offers.map((item) => ({ merchantId: item.id, merchantName: item.hotel, totalMinor: item.price * 100, benefits: item.benefits, cancellation: item.cancellation, distanceKm: item.distance, score: scoreOffer(item), selected: item.id === offer.id })) }) });
  }

  async function pay() {
    setPaying(true);
    setError("");
    const response = await fetch("/api/payment/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: payableTotal, merchant: linkedWinners.length > 1 ? `Linked trip: ${linkedWinners.map((offer) => offer.hotel).join(" + ")}` : winner.hotel, requestId }),
    });
    const data = await response.json();
    setPaying(false);
    if (!response.ok) { setError(data.error || "Payment could not be started."); return; }
    if (data.mode === "prava") {
      window.localStorage.setItem("reversecart.pravaSessionId", data.sessionId);
      window.localStorage.setItem("reversecart.reservationId", data.reservationId);
      window.location.assign(data.checkoutUrl);
      return;
    }
    setReceipt(data.result);
    setStage("confirmed");
  }

  function renderOfferCard(offer: Offer, leader: boolean) {
    return <article className={`offer-card ${leader ? "leader" : ""}`} key={offer.id}>
      {leader && <div className="leader-label">CURRENT BEST</div>}
      {offer.imageUrl ? <div className="hotel-photo"><img src={offer.imageUrl} alt={`${offer.hotel} property`} /><a href={offer.imageSourceUrl} target="_blank" rel="noreferrer">LiteAPI photo ↗</a></div> : <div className="hotel-photo hotel-photo-fallback" aria-hidden="true"><span>{offer.mark}</span><small>Verified hotel · image not supplied</small></div>}
      <div className="hotel-head"><div className="hotel-mark" style={{ background: offer.color }}>{offer.mark}</div><div><h3>{offer.hotel}</h3><span>★ {offer.rating} · {offer.distance} km straight-line</span><small className={`source-badge ${offer.dataSource || "fixture"}`}>{offer.dataSource === "liteapi" ? "LiteAPI sandbox hotel + rate" : offer.dataSource === "geoapify" ? "Geoapify place · simulated rate" : "Simulated fallback offer"}</small></div></div>
      {offer.address && <p className="hotel-address">{offer.address}</p>}
      <div className="offer-price"><small>TOTAL</small><strong>{formatINR(offer.price)}</strong>{offer.price < offer.openingPrice && <span>was {formatINR(offer.openingPrice)}</span>}</div>
      <div className="benefits">{offer.benefits.map((benefit) => <span key={benefit}>✓ {benefit}</span>)}</div>
      <div className="offer-foot"><span>{offer.cancellation}</span><b>Score {scoreOffer(offer)}</b></div>
    </article>;
  }

  if (resumeLoading) return <main className="app-shell"><header className="topbar market-topbar"><span className="brand"><Logo /></span><nav className="stepper" aria-label="Purchase progress"><div className="step active"><span>1</span>Request</div><div className="step active"><span>2</span>Offers</div><div className="step"><span>3</span>Payment</div><div className="step"><span>4</span>Confirmed</div></nav><div className="header-actions"><div className="sandbox-pill"><span /> Prava sandbox ready</div><UserMenu /></div></header><section className="restore-market"><div className="restore-orbit"><i /></div><span className="kicker">MARKET COMPLETE</span><h1>Restoring your completed market…</h1><p>Refreshing city results, hotel photos, rates and distance references.</p><div className="restore-stops">{restoreStops.map((stop, index) => <span key={stop}>{index > 0 && <b>→</b>}{stop}</span>)}</div></section><SiteFooter /></main>;

  return (
    <main className="app-shell">
      <header className="topbar market-topbar">
        <button className="brand" onClick={startOver} aria-label="ReverseCart home">
          <Logo />
        </button>
        <nav className="stepper" aria-label="Purchase progress">
          {steps.map((step, index) => (
            <div className={`step ${index <= activeStep ? "active" : ""}`} key={step.id}>
              <span>{index + 1}</span>{step.label}
            </div>
          ))}
        </nav>
        <div className="header-actions"><div className="sandbox-pill"><span /> {paymentMode === "prava" ? "Prava sandbox ready" : paymentMode === "checking" ? "Checking payment" : "Payment demo"}</div><UserMenu /></div>
      </header>

      {stage === "request" && (
        <section className="hero page-enter">
          <div className="eyebrow"><span className="pulse-dot" /> A buyer-first marketplace</div>
          <h1>Stop searching.<br /><em>Make hotels compete.</em></h1>
          <p className="hero-copy">Describe the stay you want and set your limit. ReverseCart brings live offers to you, then Prava closes the winner.</p>
          <div className="composer">
            <textarea value={request} placeholder={requestHints[hintIndex]} onChange={(event) => setRequest(event.target.value)} aria-label="Describe what you want merchants to compete for" />
            <div className="composer-footer">
              <span>↳ Natural language is fine</span>
              <button className="primary" onClick={interpret} disabled={!request.trim() || interpreting}>
                {interpreting ? "Structuring request…" : "Create my request"} <b>→</b>
              </button>
            </div>
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <div className="trust-row">
            <span>✓ No charge until you approve</span>
            <span>✓ Hard budget limit</span>
            <span>✓ Offers expire automatically</span>
          </div>
          <div className="market-preview" aria-hidden="true">
            <div className="preview-head"><span className="preview-label">EXAMPLE MARKET</span><b>3 sample offers</b></div>
            <p>One request. Three hotels compete on price and terms.</p>
            <div className="ticker"><span>01</span><b>Mora House</b><strong>₹7,600</strong></div>
            <div className="ticker"><span>02</span><b>Luma Bengaluru</b><strong>+ breakfast</strong></div>
            <div className="ticker"><span>03</span><b>Soma Residency</b><strong>free cancel</strong></div>
            <small>Your live market starts empty and moves only after you publish.</small>
          </div>
        </section>
      )}

      {stage === "review" && (
        <section className="content-page page-enter">
          <div className="section-heading">
            <span className="kicker">PURCHASE MANDATE</span>
            <h2>Here’s what hotels will compete for.</h2>
            <p>Check the non-negotiables. You stay in control of the budget.</p>
          </div>
          <div className="mandate-grid">
            <div className="mandate-main card">
              <div className="field wide"><label>{tripLegs.length > 1 ? "Linked itinerary" : "Destination"}</label><strong>{tripLegs.map((leg) => leg.destination).join(" → ")}</strong><span>{tripLegs.length > 1 ? `${tripLegs.length} hotel markets · one combined budget` : interpretation.required.find((item) => item.toLowerCase().includes("km")) || "Near the venue"}</span></div>
              <div className="field"><label>Check-in</label><strong>Tonight</strong><span>After 10 PM</span></div>
              <div className="field"><label>Check-out</label><strong>Tomorrow</strong><span>1 night</span></div>
              <div className="field"><label>Guests</label><strong>{interpretation.guests} {interpretation.guests === 1 ? "guest" : "guests"}</strong><span>{interpretation.rooms} {interpretation.rooms === 1 ? "room" : "rooms"}</span></div>
              <div className="field budget"><label>Maximum total</label><strong>{formatINR(interpretation.maxTotalMinor / 100)}</strong><span>Including taxes</span></div>
              <div className="field auction-duration"><label htmlFor="auction-duration">Auction stays live for</label><select id="auction-duration" value={auctionDuration} onChange={(event) => setAuctionDuration(Number(event.target.value))}>{auctionDurations.map((duration) => <option value={duration.seconds} key={duration.seconds}>{duration.label}</option>)}</select><span>Closes automatically · default 1 minute</span></div>
              <div className="constraints wide">
                <label>Must have</label>
                {interpretation.required.map((item) => <div className="tag required" key={item}>✓ {item}</div>)}
                <label className="second-label">Nice to have</label>
                {interpretation.preferred.map((item) => <div className="tag preferred" key={item}>+ {item}</div>)}
              </div>
            </div>
            <aside className="mandate-side card dark-card">
              <div className="authority-head"><span className="mini-label">BUYER AUTHORITY</span><div className="shield">Guarded by Prava</div></div>
              <div className="limit-ring"><small>HARD LIMIT</small><strong>{formatINR(interpretation.maxTotalMinor / 100)}</strong><span>One purchase only</span></div>
              <ul><li><span>Scope</span><b>Hotel reservation</b></li><li><span>Recurring</span><b>Blocked</b></li><li><span>Approval</span><b>Required</b></li><li><span>Expires</span><b>Tonight</b></li></ul>
            </aside>
          </div>
          <div className="actions"><button className="ghost" onClick={() => setStage("request")}>← Edit request</button><button className="primary large" onClick={openAuction}>Invite offers <b>→</b></button></div>
        </section>
      )}

      {stage === "bidding" && (
        <section className="content-page bidding-page page-enter">
          <div className="auction-head">
            <div><span className="kicker live"><i /> LIVE AUCTION</span><h2>Hotels are competing for your stay.</h2></div>
              <div className="timer"><small>OFFERS CLOSE IN</small><strong>{formatCountdown(timeLeft)}</strong></div>
          </div>
          <div className="request-strip"><span>Tonight · 1 guest</span><span>Within 5 km</span><span>Late check-in required</span><b>Max ₹8,000</b></div>
          <div className="auction-layout">
            <div className={`offers-grid ${legOffers.length > 1 ? "linked-offers" : ""}`}>
              {(legOffers.length ? legOffers : [offers]).map((market, legIndex) => <section className="linked-market" key={tripLegs[legIndex]?.destination || legIndex}>
                {legOffers.length > 1 && <header><span>STOP {legIndex + 1}</span><h3>{tripLegs[legIndex]?.destination}</h3><small>{tripLegs[legIndex]?.timing}</small></header>}
                <div className="leg-offer-grid">{market.map((offer) => renderOfferCard(offer, offer.id === linkedWinners[legIndex]?.id && visibleEvents > 0))}</div>
              </section>)}
            </div>
            <aside className="activity card">
              <div className="activity-title"><span>Market activity</span><i>live</i></div>
              <div className="events">
                {bidEvents.slice(0, visibleEvents).reverse().map((event, index) => (
                  (() => { const offerIndex = initialOffers.findIndex((offer) => offer.hotel === event.hotel); const liveOffer = offers[Math.max(0, offerIndex)]; return <div className="event" key={`${event.at}-${event.hotel}`}><span className={index === 0 ? "hot" : ""} /><p><b>{liveOffer?.hotel || event.hotel}</b> {event.message} {event.price && <strong>{formatINR(liveOffer?.price || event.price)}</strong>}</p><small>just now</small></div>; })()
                ))}
                {visibleEvents === 0 && <div className="waiting"><span /><p>Invitations sent to 3 hotels…</p></div>}
              </div>
            </aside>
          </div>
          <div className="auction-bottom"><p><span /> Auction closes automatically after {auctionDurations.find((duration) => duration.seconds === auctionDuration)?.label}. No money has moved.</p><button className="ghost solid" onClick={() => setStage("decision")}>End bidding now</button></div>
          <p className="data-attribution">{hotelSource === "liteapi" ? "Hotel identities, photos and date-specific stay prices from LiteAPI sandbox · Negotiated benefits remain simulated." : hotelSource === "geoapify" ? "Real hotel identities and locations from OpenStreetMap via Geoapify · Bid prices and benefits are simulated." : "Hackathon test hotels · Bid prices and benefits are simulated."}</p>
        </section>
      )}

      {stage === "decision" && (
        <section className="content-page decision-page page-enter">
          <div className="decision-banner"><span>✓</span><div><small>AUCTION COMPLETE</small><h2>We found your best offer.</h2></div><div className="saved"><small>SAVED FROM OPENING BEST</small><strong>₹0</strong></div></div>
          {linkedWinners.length > 1 && <section className="linked-summary card"><div><span className="kicker">LINKED TRIP</span><h3>{tripLegs.map((leg) => leg.destination).join(" → ")}</h3><p>Select a stop to inspect its hotel, distance reference and alternative offers.</p></div><div className="linked-summary-total"><small>COMBINED TOTAL</small><strong>{formatINR(combinedTotal)}</strong><span className={combinedTotal <= interpretation.maxTotalMinor / 100 ? "within-budget" : "over-budget"}>{combinedTotal <= interpretation.maxTotalMinor / 100 ? `${formatINR(interpretation.maxTotalMinor / 100 - combinedTotal)} under budget` : `${formatINR(combinedTotal - interpretation.maxTotalMinor / 100)} over budget`}</span></div>{linkedWinners.map((offer, index) => <button className={`linked-stop ${activeDecisionLeg === index ? "active" : ""}`} key={offer.id} onClick={() => { setActiveDecisionLeg(index); setShowAlternatives(false); }}><span>{index + 1}</span><div><small>{tripLegs[index]?.destination} · {offer.distance} km from landmark</small><b>{offer.hotel}</b></div><strong>{formatINR(offer.price)}</strong><em>{activeDecisionLeg === index ? "Viewing" : "View details →"}</em></button>)}</section>}
          <div className="decision-layout">
            <article className="winner-card card">
              {winner.imageUrl ? <div className="winner-photo"><img src={winner.imageUrl} alt={`${winner.hotel} property`} /><a href={winner.imageSourceUrl} target="_blank" rel="noreferrer">{winner.imageProvider === "liteapi" ? "LiteAPI photo" : winner.imageProvider === "foursquare" ? "Foursquare photo" : "Wikimedia photo"} ↗</a></div> : <div className="winner-photo hotel-photo-fallback" aria-hidden="true"><span>{winner.mark}</span><small>Photo unavailable for this verified place</small></div>}
              <div className="winner-top"><div className="hotel-mark big" style={{ background: winner.color }}>{winner.mark}</div><div><span className="kicker">{selectedOfferId || selectedLegOfferIds[activeDecisionLeg] ? "YOUR SELECTION" : "RECOMMENDED"}</span><h2>{winner.hotel}</h2><p>★ {winner.rating} · {winner.distance} km straight-line from <b>{tripLegs[activeDecisionLeg]?.destination || interpretation.destination}</b></p><small className={`source-badge ${winner.dataSource || "fixture"}`}>{winner.dataSource === "liteapi" ? "Hotel identity and date-specific sandbox rate from LiteAPI" : winner.dataSource === "geoapify" ? "Hotel identity from Geoapify · rate simulated" : "Fallback demo hotel and simulated rate"}</small>{winner.address && <small className="winner-address">{winner.address}</small>}</div><div className="winner-price"><small>{linkedWinners.length > 1 ? `STOP ${activeDecisionLeg + 1} TOTAL` : "FINAL TOTAL"}</small><strong>{formatINR(winner.price)}</strong></div></div>
              <div className="why"><span className="spark">✦</span><div><h3>{selectedOfferId || selectedLegOfferIds[activeDecisionLeg] ? "What you’re choosing" : "Why this offer wins"}</h3><p>This offer ranks strongly across total price, straight-line distance from {tripLegs[activeDecisionLeg]?.destination || interpretation.destination}, cancellation flexibility and included benefits. LiteAPI prices are date-specific sandbox rates; negotiated benefits remain simulated.</p></div></div>
              <div className="inclusions">{winner.benefits.map((benefit) => <span key={benefit}>✓ {benefit}</span>)}<span>✓ {winner.cancellation}</span></div>
            </article>
            <aside className="comparison card"><span className="mini-label">{tripLegs[activeDecisionLeg]?.destination || "THE TRADE-OFF"}</span><h3>{winner.price > Math.min(...activeMarketOffers.map((offer) => offer.price)) ? `${formatINR(winner.price - Math.min(...activeMarketOffers.map((offer) => offer.price)))} more than the cheapest` : "You chose the lowest price"}</h3><p>Distances are straight-line measurements from <b>{tripLegs[activeDecisionLeg]?.destination || interpretation.destination}</b>, calculated from Geoapify coordinates.</p><div className="compare-row"><span>Cheapest</span><b>{[...activeMarketOffers].sort((a,b) => a.price-b.price)[0]?.hotel} · {formatINR(Math.min(...activeMarketOffers.map((offer) => offer.price)))}</b></div><div className="compare-row chosen"><span>Selected</span><b>{winner.hotel} · {formatINR(winner.price)}</b></div><button className="text-button offer-toggle" aria-expanded={showAlternatives} onClick={() => setShowAlternatives((shown) => !shown)}>{showAlternatives ? "Hide offers ×" : linkedWinners.length > 1 ? `Show all ${activeMarketOffers.length} ${tripLegs[activeDecisionLeg]?.destination} offers +` : `Show all ${activeMarketOffers.length} offers +`}</button></aside>
          </div>
          {hotelSource !== "fixture" && <section className="location-card card"><div className="location-copy"><span className="kicker">LOCATION CHECK · STOP {activeDecisionLeg + 1}</span><h3>Distance from {tripLegs[activeDecisionLeg]?.destination || interpretation.destination}.</h3><p>Geoapify geocodes the requested landmark; hotel coordinates come from LiteAPI or Geoapify. We calculate the straight-line distance between those coordinates, so driving distance may be longer.</p><div><span><i className="reference-dot" /> {tripLegs[activeDecisionLeg]?.destination || hotelReference}</span><span><i className="hotel-dot" /> Candidate hotels</span></div></div><img key={tripLegs[activeDecisionLeg]?.destination} src={`/api/hotels/map?destination=${encodeURIComponent(tripLegs[activeDecisionLeg]?.destination || interpretation.destination)}`} alt={`Map of hotels near ${tripLegs[activeDecisionLeg]?.destination || interpretation.destination}`} /></section>}
          {showAlternatives && <section className="alternatives card" aria-label="All offers">
            <div className="alternatives-head"><div><span className="kicker">ALL VALID OFFERS</span><h3>Pick the trade-off you prefer.</h3></div><button className="close-button" aria-label="Close offer list" onClick={() => setShowAlternatives(false)}>×</button></div>
            <div className="alternative-list">{[...activeMarketOffers].sort((a,b) => a.price-b.price).map((offer) => <article className={`alternative-row ${offer.id === winner.id ? "selected" : ""}`} key={offer.id}><div className="hotel-mark" style={{background:offer.color}}>{offer.mark}</div><div><b>{offer.hotel}</b><span>{offer.distance} km from {tripLegs[activeDecisionLeg]?.destination || interpretation.destination} · {offer.benefits.slice(0,2).join(" · ")}</span></div><strong>{formatINR(offer.price)}</strong><button onClick={() => selectOffer(offer)}>{offer.id === winner.id ? "Selected" : "Select"}</button></article>)}</div>
          </section>}
          <div className="actions"><button className="ghost solid offer-toggle" aria-expanded={showAlternatives} onClick={() => setShowAlternatives((shown) => !shown)}>{showAlternatives ? "Hide offers ×" : linkedWinners.length > 1 ? `Show ${tripLegs[activeDecisionLeg]?.destination} alternatives +` : `Show all ${activeMarketOffers.length} offers +`}</button><button className="primary large" onClick={() => setStage("payment")} disabled={payableTotal > interpretation.maxTotalMinor / 100}>{payableTotal > interpretation.maxTotalMinor / 100 ? "Combined total exceeds budget" : linkedWinners.length > 1 ? "Review linked trip and pay" : "Review and pay"} <b>→</b></button></div>
        </section>
      )}

      {stage === "payment" && (
        <section className="content-page payment-page page-enter">
          <div className="section-heading centered"><span className="kicker">FINAL APPROVAL</span><h2>You’re authorizing one exact purchase.</h2><p>ReverseCart cannot charge more or create a recurring payment.</p></div>
          <div className="checkout-layout">
            <div className="checkout card">
              {linkedWinners.length > 1 ? linkedWinners.map((offer, index) => <div className="checkout-hotel" key={offer.id}><div className="hotel-mark" style={{ background: offer.color }}>{offer.mark}</div><div><h3>{offer.hotel}</h3><p>{tripLegs[index]?.destination} · {tripLegs[index]?.timing}</p></div><b>{formatINR(offer.price)}</b></div>) : <div className="checkout-hotel"><div className="hotel-mark" style={{ background: winner.color }}>{winner.mark}</div><div><h3>{winner.hotel}</h3><p>Tonight → Tomorrow · 1 guest</p></div><b>{formatINR(winner.price)}</b></div>}
              <div className="line"><span>Rooms and included benefits</span><b>{formatINR(Math.round(payableTotal * 0.89))}</b></div><div className="line"><span>Taxes and fees</span><b>{formatINR(payableTotal - Math.round(payableTotal * 0.89))}</b></div><div className="line total"><span>Total authorization</span><b>{formatINR(payableTotal)}</b></div>
              <div className="policy"><span>✓</span><p><b>Free cancellation until 8 PM</b><br />Late check-in and breakfast are guaranteed by the offer.</p></div>
            </div>
            <aside className="pay-card card dark-card">
              <span className="mini-label">PRAVA PURCHASE MANDATE</span>
              <div className="pay-amount"><small>YOU WILL PAY</small><strong>{formatINR(payableTotal)}</strong></div>
              <div className="authorization-row"><span>Purchase</span><b>{linkedWinners.length > 1 ? `${linkedWinners.length} linked stays` : winner.hotel}</b></div><div className="authorization-row"><span>Maximum allowed</span><b>{formatINR(interpretation.maxTotalMinor / 100)}</b></div><div className="authorization-row"><span>Recurring</span><b>Blocked</b></div><div className="authorization-row"><span>Approval</span><b>Required now</b></div>
              <button className="pay-button" onClick={pay} disabled={paying}>{paying ? <><i className="spinner" /> Confirming with Prava…</> : <>Approve with Prava <b>→</b></>}</button>
              <p className="sandbox-note">{paymentMode === "prava" ? "Prava sandbox is ready. Approval opens Prava’s hosted checkout, then a protected test-hotel simulator reports the result. No real hotel is charged or booked." : "Demo gateway active. Add the Prava sandbox key and public HTTPS callback and merchant endpoints to activate hosted checkout."}</p>
              {error && <p className="inline-error dark-error" role="alert">{error}</p>}
            </aside>
          </div>
          <button className="ghost back-alone" onClick={() => setStage("decision")}>← Back to recommendation</button>
        </section>
      )}

      {stage === "confirmed" && receipt && (
        <section className="content-page confirmation page-enter">
          <div className="success-orbit"><span>✓</span></div>
          <span className="kicker success">SANDBOX PAYMENT VERIFIED</span><h1>Your test reservation is confirmed.</h1><p>The end-to-end Prava sandbox flow completed for {winner.hotel}. No real hotel was charged or booked.</p>
          <div className="receipt card">
            <div className="receipt-head"><div className="hotel-mark" style={{ background: winner.color }}>{winner.mark}</div><div><h3>{winner.hotel}</h3><span>Tonight → Tomorrow · 1 guest</span></div><strong>{formatINR(winner.price)}</strong></div>
            <div className="receipt-grid"><div><small>BOOKING REFERENCE</small><b>{receipt.bookingReference}</b></div><div><small>DEMO TRANSACTION</small><b>{receipt.transactionId}</b></div><div><small>STATUS</small><b className="status-confirmed">● Confirmed</b></div><div><small>CONFIRMED AT</small><b>{new Date(receipt.confirmedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b></div></div>
            <div className="audit"><span className="done">✓ Request created</span><i /><span className="done">✓ Offer selected</span><i /><span className="done">✓ Payment verified</span><i /><span className="done">✓ Hotel confirmed</span></div>
          </div>
          <div className="confirmation-actions"><button className="primary" onClick={startOver}>Start another request</button><a className="ghost solid merchant-link" href={`/merchant/luma?booking=${receipt.bookingReference}&transaction=${receipt.transactionId}&amount=${winner.price}`}>View merchant order ↗</a></div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}

export default function Home() { return <AuthGate><ReverseCartApp /></AuthGate>; }
