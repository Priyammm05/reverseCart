import { AuthGate } from "@/components/AuthGate";
import { RequestDetail } from "@/components/RequestDetail";

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  return <AuthGate><RequestDetail id={params.id} /></AuthGate>;
}
