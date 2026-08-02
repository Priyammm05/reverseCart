import { AuthGate } from "@/components/AuthGate";
import { HistoryView } from "@/components/HistoryView";

export default function HistoryPage() { return <AuthGate><HistoryView /></AuthGate>; }
