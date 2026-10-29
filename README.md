# SecretWish — Admin & Operations

The control room: orders and fulfilment, vendors and listing approvals, payments, refunds/disputes/chargebacks, vendor payouts, customer support, reports, privacy, audit logs and settings.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Recharts · lucide-react. All data comes from the SecretWish .NET API (`../Backend`).

## Run

```bash
npm install
cp .env.example .env.local   # optional — defaults point at http://localhost:5080
npm run dev                  # http://localhost:3001
```

Start the API first (`dotnet run --project ../Backend/src/SecretWish.Api --launch-profile http`). Production build: `npm run build && npm start`. Type check: `npm run typecheck`.

## Screens

| Screen | What you can do |
|---|---|
| Overview | KPIs (GMV vs revenue vs vendor earnings), sales trend, status mix, categories, vendor performance, alerts, transactions, activity |
| Orders & Fulfilment | Search, filter (incl. “needs attention”), sort, paginate; order detail with timeline, payments, internal notes, permitted actions, logged PII reveal |
| Customers & Recipients | Senders and recipients with role-based masking |
| Vendors & Approvals | Approve / reject / suspend / reinstate with recorded reasons; verification, performance, payouts, decision history |
| Products & Categories | Listing review queue (approve / reject / suspend with feedback) |
| Wishlists & Campaigns | Wishlists by visibility; sender surprise requests with budget ranges and quote counts |
| Payments & Transactions | Charges and refunds with provider references (simulated) |
| Refunds & Disputes | Assign, add evidence, decide (full / partial refund, decline / contest chargeback) with confirmation |
| Vendor Payouts | Eligibility pipeline per vendor, initiate payout, simulate provider success/failure, resolve reconciliation exceptions |
| Customer Support | Ticket queue, assignment, internal notes vs customer replies, status changes |
| Reports & Analytics | Date-range metrics with definitions; charts with table view |
| Privacy & Security · Audit Logs · Settings | Controls overview, PII reveal log, audit search, business-rule settings and the role permission matrix |

Try each persona: **Tolu** (Operations, full access), **Chidi** (Finance: names but no addresses; decides refunds and payouts), **Amaka** (Support: masked data, reveal with a reason).

## Shared design system

`src/shared` is identical in Admin, Sender, Recipient and Vendor (tokens, components, API client, app shells). Edit it in one app, then run `sync-shared.ps1` from the workspace root to copy it to the others. A later step is to publish it as a private `@secretwish/ui` package.

## Prototype notes

- **Demo sign-in:** pick a synthetic persona; the API trusts the `X-Demo-User` header. Not real authentication.
- **Sample data only.** Figures are generated, not production analytics.
- Browser storage holds only per-viewer conveniences (chosen persona, currency, sidebar state, recently viewed).
- Prices are stored in USD and shown in USD or NGN at the recorded sample FX rate (toggle in the header).
