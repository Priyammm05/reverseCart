# ReverseCart

ReverseCart is a buyer-first marketplace where merchants compete for an authorized purchase request and Prava closes the winning transaction.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, sign in with Google, and describe what you want merchants to compete for. The empty request field rotates example prompts until the buyer starts typing.

## Current implementation

- Responsive buyer flow from request to confirmation
- Google-only Clerk authentication with private Supabase history and database RLS
- Editable purchasing mandate
- Deterministic three-hotel live auction
- Transparent offer scoring and recommendation
- Server-side payment gateway boundary
- Prava hosted checkout adapter: session creation, result polling, merchant charge handoff, and status reporting
- OpenAI structured request interpretation with deterministic fallback
- Demo payment adapter and confirmation receipt when keys are absent
- Merchant-side order view
- Mobile-first responsive market-ticket design

## Important payment status

Without `PRAVA_SECRET_KEY`, the payment route uses `DemoPaymentGateway` and labels itself clearly in the UI. With the environment variables in `.env.example`, it switches to Prava's real hosted sandbox flow. A real merchant/PSP sandbox charge endpoint is also required; ReverseCart never treats Prava credential issuance alone as a completed hotel order.

See [INTEGRATION.md](./INTEGRATION.md) for the exact flow and configuration.

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) to connect Clerk to Supabase and enable per-user database isolation.

See [plan.md](./plan.md) for the full product, architecture and submission plan.
