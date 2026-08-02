import { redirect } from "next/navigation";

export default function MarketPage({ params }: { params: { id: string } }) {
  redirect(`/?resume=${encodeURIComponent(params.id)}`);
}
