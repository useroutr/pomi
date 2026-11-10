# Pomi: get paid in what you want, from anything

Status: being built. This is Pomi's product and architecture: what it is, how it uses Useroutr,
the data it keeps, the plan, and the decisions still open. The first milestone is in section 12.

## 1. Why

Paycrest sells a protocol to businesses. Noblocks is its open-source reference consumer app: real
people use it, and it shows the protocol working. This app plays the same part for Useroutr.

- **One app, two jobs.** It is a real product with real users, and a showcase of Useroutr.
- **It shows Useroutr's idea in its simplest form.** A receiver says what they want, and a payer
  pays with whatever they hold.
- **It brings value into Stellar.** Every payment lands as a Stellar asset, in a Stellar account
  the receiver owns.
- **It proves the public interface.** It uses only Useroutr's public SDK, API and checkout
  packages, so "built on Useroutr" is literally true and anyone can fork it.

## 2. What it is, and what it is not

- **What it is.** A receiver creates a payment request and shares a link. Anyone who opens the link
  pays with any token on any supported chain, from any wallet or by hand. The receiver gets the
  exact asset they asked for, in their own Stellar account.
- **Non-custodial.** The app never holds funds or keys. Useroutr settles each payment straight to
  the receiver's address, and the app only creates requests and shows their status.
- **Not:**
  - a wallet
  - an exchange
  - a fiat on-ramp or off-ramp
  - a balance anyone holds with the app

  Anything that would make it one of these is out of scope.
- **Who pays fees.** Payers pay the network, bridge and Useroutr fees inside their quote, which
  the checkout shows them. Receivers get exactly what they asked for. The app charges nothing in
  its first version.

## 3. Users and flows

**Receiver**
1. Signs in with email and a one-time code. This works on every platform without a wallet.
2. Picks a handle. `pomi.app/<handle>` is their page (section 6).
3. Adds a payout address: connects a Stellar wallet, or pastes or scans an address. See section 6
   for the checks.
4. Sets up the pay box on their page: an asset, and either a fixed amount or the payer's choice,
   with an optional minimum.
5. Creates requests:
   - a fixed amount and asset (XLM or USDC on Stellar)
   - a note
   - single-use (an invoice) or reusable (the same amount, paid any number of times)
   - listed on their page, or unlisted and reachable only by its link (the default for invoices)
   - an optional end date
6. Shares their page, a request's link, or either one's QR code.
7. Sees each request's status, and gets a push notification on mobile or an email when paid.

**Payer**
1. Opens `https://pomi.app/<handle>` or a request's `https://pomi.app/r/<request id>` on any
   device. No account is needed.
2. On a handle page, sees who it is, the pay box, and the receiver's listed requests. On a request,
   sees who is asking, how much, and the note.
3. In the pay box, enters an amount (or sees the fixed one), then pays through the Useroutr
   checkout: any token or chain in the catalog, from a connected Stellar or EVM wallet, or by
   sending to an address. The QR code carries a payment request (SEP-7 on Stellar, EIP-681 on EVM
   networks).
4. Sees a confirmation once Useroutr has credited the payment. Never earlier.

## 4. How it uses Useroutr

The whole app is **one Useroutr application** with one API key, held by its backend.

| App concept | Useroutr |
|---|---|
| A request | The app's own record. Useroutr knows nothing of it. |
| A payer opening a request | A funding intent. `destination` is the receiver's address and asset, `reference` is the request id, `metadata` carries the request and visit, and the idempotency key is the visit id. |
| Paid | `funding.credited` for that intent |
| Partly paid, expired, failed | `funding.partially_funded`, `funding.expired`, `funding.failed` |
| A payment that cannot complete the request | `payment.rejected` and `refund.*` events. Useroutr refunds the payer by its own rules, and sends `refund.destination_required` when it cannot tell where the money should go (section 9). |

**One intent per visit, not per request.** An intent lasts at most 24 hours (30 minutes by
default). A request can stay open for weeks, so the app creates an intent when a payer arrives,
as Stripe Payment Links do:
- **Single-use request.** At most one live intent at a time, shared by every visitor. A second
  visitor resumes the same checkout. If two people pay anyway, the second payment is an
  overpayment or a duplicate, which Useroutr refunds to that payer. Once one intent is credited,
  the request closes and no new intent is created.
- **Reusable request**, including the pay box on a handle page. Each visit creates its own
  intent, and each credited intent is one payment on the request. When the payer chooses the
  amount, the backend checks it (`parseRequestAmount`, then the minimum) and the intent asks for
  exactly that amount.

**Webhooks** come into the app's backend:
- The signature is checked with `useroutr.webhooks.constructEvent` over the raw body.
- Each event is processed once, keyed on `Useroutr-Event-Id` with a unique constraint.
- Only `funding.credited` marks a payment as paid. Nothing the payer's browser or wallet reports
  moves a request.

**Rate limits.** Useroutr limits requests per API key, and the whole app shares one key. The
payer's checkout calls Useroutr without a key, so those calls are limited per client address.
Intents are reused where the rules above allow, and the app limits how many checkouts each
visitor and IP address can open.

## 5. Platforms and architecture

```text
                ┌────────────────────────────┐
  web (Next.js) │ landing, pay page /r/:id,  │──┐
                │ receiver dashboard         │  │
                └────────────────────────────┘  │   ┌─────────────────────────┐   ┌──────────┐
                ┌────────────────────────────┐  ├──▶│ app backend             │──▶│ Useroutr │
  mobile (Expo) │ receiver app; opens the pay│──┘   │ requests, users, push,  │◀──│ API      │
  iOS, Android  │ page in an in-app browser  │      │ webhooks, Useroutr key  │   └──────────┘
                └────────────────────────────┘      └─────────────────────────┘
  shared: request types, the app's API client, @useroutr/checkout-core
```

- **The backend** is the only part that holds the Useroutr API key. `@useroutr/sdk` is server-only.
  It stores requests, sends push notifications through Expo's push service, and sends email.
  Section 12.1 says where it runs.
- **The web app (Next.js)** serves the landing page, the pay page and the receiver dashboard. The
  pay page embeds `<UseroutrCheckout>` from `@useroutr/checkout-react`, with `baseUrl` set to the
  environment's public API (section 12.3) and the same wallets as Useroutr's hosted checkout:
  `combineWalletConnectors` over `createStellarWalletsKitConnector`, `createEip6963Connector` and
  `createWalletConnectEvmConnector` from `@useroutr/checkout-wallets`. WalletConnect needs the
  app's own project id, with the app's domains on its allowlist.
- **The mobile app (Expo, React Native)** is the receiver's app on iOS and Android:
  - create requests and share them through the share sheet
  - show and scan QR codes
  - list requests and see their status
  - push notifications

  In the first version it opens the pay page in the system in-app browser (SFSafariViewController
  or Custom Tabs). `@useroutr/checkout-react` is DOM-only, and a native checkout is a later
  phase.
- **Links** are universal links on iOS and app links on Android. `https://pomi.app/r/<id>` opens
  the app if it is installed and the web page otherwise.
- **Shared code** is the request types and the app's own API client. A later native checkout
  builds on `@useroutr/checkout-core`, which uses no DOM. Before that phase, two things need
  work:
  - Its `WalletSubmissionStore` is synchronous (`read`, `write` and `clear` return values, not
    promises), so AsyncStorage cannot back it directly. It needs a synchronous store, or one
    held in memory and loaded before the checkout starts.
  - It builds QR payment requests with `URLSearchParams` and amounts with `BigInt`. Check both
    on Hermes.

**What works where**

| | Web, desktop | Web, phone browser | Mobile app |
|---|---|---|---|
| Receive: sign in, create, share, track | Yes | Yes | Yes, plus push and QR scan |
| Pay from a Stellar wallet | Stellar Wallets Kit: Freighter, xBull, Albedo, MetaMask's Stellar account (mainnet only) and others | WalletConnect to LOBSTR and others, xBull and Albedo | v1: the web pay page in an in-app browser. Phase 3: native, over WalletConnect. |
| Pay from an EVM wallet | Browser wallets found with EIP-6963: MetaMask, Rabby, Coinbase Wallet | Wallet apps over WalletConnect | As above |
| Pay by hand: address and QR | Yes | Yes | Yes |

Paying by hand works everywhere, so any payer can always pay.

## 6. Identity and payout addresses

- **Sign-in is email with a one-time code,** so no platform depends on a wallet signing. A code is
  six digits and works for 10 minutes and five tries, and only the newest code for an address
  counts. An address gets at most one code a minute and five an hour. The first code entered for
  an address creates its account.
- **A session** is a random token that the database stores only as a hash, so it can be ended
  from the server. It lasts 30 days. On the web it is an HttpOnly cookie that page scripts cannot
  read; on mobile it will be a bearer token in the secure store.
- **A handle** names a receiver's page, `pomi.app/<handle>`. It is 3 to 30 characters: lowercase
  letters, digits and single hyphens, starting with a letter and not ending with a hyphen. Words
  the app's own routes use (`r`, `api`, `dashboard`, `settings` and others) and names that would
  pass for Pomi or Useroutr are reserved (`parseHandle` in `packages/shared`). A handle cannot be
  changed in phase 1, so links already shared keep working.
- **A payout address** is connected or pasted. Before it is saved, the backend checks:
  - the account exists, since a new Stellar account needs at least 1 XLM
  - it trusts the asset the receiver wants (USDC needs a trustline)
  - it is not an exchange address that requires a memo (SEP-29), because Useroutr pays without a
    memo

  Each failure says what to do in the receiver's wallet. Useroutr refuses a missing account or
  trustline itself (`INVALID_DESTINATION`), but only when an intent is created, which is when a
  payer opens the link; checking at save spares the receiver a broken request. Useroutr does
  not refuse an address that requires a memo, so that check is the app's, and it is not
  optional: a payment to an exchange's shared account without a memo cannot be credited to the
  receiver.
- **Ownership.** Connecting a wallet and signing a short message (SEP-53) marks the address
  verified, and the pay page shows that. A pasted address works but is shown as unverified.
  Payments to an address only ever reach that address, so the risk is impersonation, not theft.
  The app signs through Stellar Wallets Kit's `signMessage` directly: `WalletConnector` in
  `@useroutr/checkout-core` has no message signing. Which wallets in the kit sign SEP-53 messages
  is to be checked.
- **What a pay page or handle page shows the payer:** the receiver's chosen display name and
  handle, the verification mark, the amount, the note and the shortened address, and on a handle
  page the listed requests. Nothing else about the receiver, and never their email.

## 7. Data

All amounts are `NUMERIC`, never floating point, and every write that spans tables runs in a
transaction.

| Table | Key fields | Constraints |
|---|---|---|
| `users` | id, email, handle, display_name | email unique; handle unique, and its format checked |
| `payout_addresses` | user_id, address, active, verified_at | one active address per user; the address is a Stellar account (`G…`) |
| `requests` | id, user_id, kind (`single` / `reusable`), amount_kind (`fixed` / `open`), amount, minimum_amount, asset_id, note, listed, pay_box, status (`open` / `paid` / `closed`), ends_at | a fixed request has an amount and no minimum, an open one has no amount; amounts are positive; a single-use request is fixed; the pay box is reusable and one per user; a note is at most 280 characters |
| `request_intents` | request_id, funding_intent_id, funding_token, visit_id, amount, exclusive, state (`open` / `closed`) | `funding_intent_id` unique; one per request and visit; one open intent per single-use request (`exclusive`), by a partial unique index |
| `request_payments` | request_id, funding_intent_id, amount, asset_id, credited_at | `funding_intent_id` unique, so one credit counts once |
| `refunds` | refund_id, funding_intent_id, status, destination_required_at | `refund_id` unique |
| `webhook_events` | event_id, type, received_at, processed_at | `event_id` unique |
| `sign_in_codes` | email, code_hash, attempts, expires_at, consumed_at | email lowercase; the code is stored as an HMAC keyed by the server's secret |
| `sessions` | user_id, token_hash, expires_at, revoked_at | `token_hash` unique |
| `devices` (phase 2) | user_id, push_token, platform | `push_token` unique |

Request ids are random and unguessable, so an unlisted request is private to whoever has its
link. An open-amount intent records the amount the payer chose. Partial unique indexes and check
constraints are SQL in the migrations, because Prisma's schema cannot express them; the schema
names each one.

## 8. The app's own API

Every endpoint is under `/api`, apart from the pages, and takes and returns JSON. An error has the
shape `{ "error": { "code", "message" } }`, and its message can be shown to the person.

| Endpoint | Who | Does |
|---|---|---|
| `POST /auth/code`, `POST /auth/verify` | anyone | Email sign-in. Verifying sets the session cookie. |
| `POST /auth/sign-out` | receiver | Ends the session |
| `POST /me/handle` | receiver | Claim a handle, once |
| `GET/PUT /me/payout-address` | receiver | Read or set the payout address, with the checks in section 6 |
| `GET/PUT /me/pay-box` | receiver | Read or set the pay box: asset, fixed amount or the payer's choice, minimum |
| `POST /requests`, `GET /requests`, `PATCH /requests/:id`, `POST /requests/:id/close` | receiver | Manage requests, including listing or unlisting them |
| `GET /profiles/:handle` | anyone | A handle page: name, verification mark, pay box and listed requests |
| `GET /r/:id` | anyone | The public view of a request |
| `POST /r/:id/checkout` | anyone | Reuses or creates the funding intent; returns its funding token for the checkout. For an open amount, the body carries the payer's amount. |
| `POST /webhooks/useroutr` | Useroutr | Signed events |
| `POST /devices` | receiver | Register a push token |

## 9. Security and abuse

- The API key lives only on the backend. The browser and the mobile app hold a funding token,
  which grants one intent.
- Webhooks are verified and processed once each.
- Request notes are limited in length, rendered as plain text, and never auto-linked, to reduce
  phishing. Any request or handle page can be reported, and the operator can close it.
- Handles that would pass for Pomi, Useroutr or the app's own pages are reserved. Unlisted
  requests have random ids, so a handle page never reveals them.
- Checkout creation is rate limited per visitor and per IP address.
- No funds, keys or balances exist in the app to steal. The sensitive data is email addresses and
  payout addresses, and neither is logged.
- **Refund destinations.** The app is the Useroutr application, so it answers for refunds
  Useroutr cannot send on its own: a payer who paid with a memo (most likely from an exchange), a
  payer that is a bridge contract, a native EVM deposit, and any payment of an intent that ran a
  route, which the automatic sweep never touches. Payers are anonymous, so in phase 1 only the
  operator names these destinations, with `refunds.update` from the SDK, after finding the payer.
  Each `refund.destination_required` event lands in `refunds` and alerts the operator.

## 10. App stores

- **Apple, guideline 3.1.5:**
  - Apps that store currency must come from an organization account.
  - Apps that "facilitate transactions or transmissions" of crypto need exchange licensing.
- **The plan for Apple:** enroll as an organization. In the review notes, say plainly that the app
  never holds funds or keys, and that payments happen in the payer's own wallet or on the web pay
  page. Organization enrollment needs a D-U-N-S number for the company, which takes time to get,
  so it starts during phase 1.
- **Google Play** exempts non-custodial wallets from its crypto licensing rules.
- **Recheck both** before the first submission.

## 11. Phases

Each phase is done when it has run on testnet, then with a small mainnet payment. Passing tests is
not enough. Phase 1 starts with the smaller slice in section 12.2.

1. **Web.**
   - email sign-in and payout address checks
   - single-use and reusable requests in XLM or USDC on Stellar
   - handles and handle pages: the pay box, fixed or the payer's choice, and listed requests
   - the pay page with the Useroutr checkout and wallet payments, Stellar and EVM
   - the dashboard, webhook handling and email notifications
   - the operator's refund path in section 9
2. **Mobile receiver app** (Expo):
   - requests, share sheet, QR show and scan
   - push notifications
   - universal and app links
   - the pay page in an in-app browser
   - App Store and Play Store releases
3. **Wider.**
   - a native payer checkout on `@useroutr/checkout-core` with WalletConnect
   - receiving on Base or Arbitrum, through Useroutr's outbound rails
   - receipts

**Measures:**
- value received on Stellar
- active receivers
- distinct payers
- the share of payments from other chains
- the time from payment to credit

## 12. Building it

### 12.1 Stack

| Part | Choice | Why |
|---|---|---|
| Repository | pnpm workspaces and Turborepo, TypeScript strict | The same tools as Useroutr. One place for web, mobile and shared code. |
| Web | Next.js (App Router) with React 19 | The checkout is a React component. Useroutr's own demo runs it on Next.js 16 and React 19. |
| Backend | The Next.js server, in phase 1: route handlers for the app's API and the webhook, over a `src/server` layer of services and repositories | One deployment for the first milestone, and the way `apps/demo` already verifies webhooks. The mobile app calls the same routes with a bearer token. It moves to a service of its own when push and background work outgrow it. |
| Database | PostgreSQL with Prisma | The constraints in section 7 need a real database. The same tools as Useroutr. |
| Useroutr | `@useroutr/sdk` on the server; `@useroutr/checkout-react` and `@useroutr/checkout-wallets` on the pay page | Public packages only |
| Stellar reads | `@stellar/stellar-sdk` | The payout address checks in section 6: account, trustline, `config.memo_required` |
| Wallet signing | `@creit.tech/stellar-wallets-kit`, already under `@useroutr/checkout-wallets` | SEP-53 address verification (section 6) |
| Email | Resend, on the app's own domain | Sign-in codes and paid notices. Useroutr uses it already. |
| Notifications | An outbox table written in the same transaction as the webhook's change, sent after it, and retried by a scheduled job | A failed email or push never fails or repeats the webhook |
| Mobile (shell now, features in phase 2) | Expo SDK 58, with Expo Router, `expo-notifications`, `expo-camera`, `expo-secure-store`, `expo-web-browser`, and EAS Build and Submit | Push, QR scanning, a secure session, and the in-app browser for the pay page |
| Hosting | Vercel for the web app, Neon for Postgres | Separate from Useroutr's own infrastructure, as any integrator's would be. Vercel's Hobby plan is for non-commercial use, so production goes on a paid plan. |

### 12.2 First milestone: one paid request, end to end, on the web

The smallest slice that proves the idea, before the rest of phase 1.

**In it:**
- email code sign-in
- a pasted payout address, with the three checks in section 6
- a single-use request in USDC or XLM on Stellar
- the pay page at `/r/:id` with the embedded checkout and all three wallet connectors
- `POST /r/:id/checkout`, keeping one live intent per request, also under concurrent visitors
- the webhook route: verify, process once, mark paid on `funding.credited`
- the paid email to the receiver, and the request list with statuses

**Not in it:** handle pages and reusable requests (they follow it in phase 1, on the same
schema), the mobile app, SEP-53 verification, reports and abuse limits beyond a basic per-IP
limit, and receipts.

**Done when, on testnet** (the Useroutr sandbox):
- one request is paid by hand with the QR code, and another from a Stellar wallet (Freighter or
  xBull; MetaMask's Stellar account works on mainnet only), and, if the sandbox has a cross-chain
  rail on, one from another chain
- each ends in exactly one `request_payments` row
- replaying the `funding.credited` delivery (`webhooks.deliveries.retry`) and a second visitor on
  a paid request change nothing
- every payment is recorded with its transaction hashes

**Done when, on mainnet** (Useroutr production): a request to the team's own Stellar address is
paid once from MetaMask's Stellar account and once from an EVM wallet on Base, each credited
once, recorded with hashes. Use a few USDC, not cents: swap providers can refuse very small
swaps.

### 12.3 Environments

The app has two environments, each tied to one Useroutr environment. They share nothing.

| | App testnet | App production |
|---|---|---|
| Useroutr environment | sandbox | production |
| Stellar | testnet | mainnet |
| Useroutr key | `ur_test_`; the SDK picks `api.sandbox.useroutr.com` from it | `ur_live_`; the SDK picks `api.useroutr.com` |
| Checkout `baseUrl` | `https://api.sandbox.useroutr.com/v1/public` | `https://api.useroutr.com/v1/public` |
| Database, webhook secret, WalletConnect project, email sender | its own | its own |
| Host | a testnet subdomain, with a banner saying it is testnet | the app's domain |

Things to know about testnet:
- **MetaMask's Stellar account does not work on testnet.** Use Freighter or xBull there.
- **Testnet resets** wipe every account, so receivers' testnet payout addresses stop existing.
- **Local development** talks to the Useroutr sandbox. It refuses plain HTTP webhook URLs, so a
  local webhook route needs an HTTPS tunnel.

## 13. Open decisions

1. **The name, and the domain. Chosen on 2026-11-09: Pomi, on `pomi.app`.** Soft and abstract,
   as Luma is, and short enough to work as a profile link (`pomi.app/<handle>`, as
   `lu.ma/<event>` does). The domain is not registered yet.
2. **Reusable requests and handle pages. Decided on 2026-11-09: both in phase 1.** A handle page,
   `pomi.app/<handle>`, has a pay box (the payer picks the amount, above an optional minimum, or
   pays a fixed amount the receiver sets) and the receiver's listed requests. Single requests
   stay at `pomi.app/r/<id>`, unlisted unless the receiver lists them. A reusable link creates an
   intent on every visit, so per-visitor limits matter from its first day. The first milestone
   is single-use; handle pages follow it.
3. **Whether sign-in also offers "sign in with your Stellar wallet" beside email.** It would
   verify the payout address in the same step, but message signing differs by wallet, and is
   least certain on mobile.
4. **Whether the app ever charges, and if so where.** Noblocks charges consumers nothing. A
   funding intent has one destination, so a fee taken from each payment would need a split that
   Useroutr does not have, or would make the app custodial. A charge paid as its own payment,
   such as a subscription, needs nothing new.
