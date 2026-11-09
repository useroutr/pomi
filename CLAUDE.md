# CLAUDE.md

Engineering instructions for AI coding agents working on Pomi. The product and its plan live in
`docs/spec.md`; read the section that covers your area before changing it.

## 1. What Pomi is

Pomi is a request-link app built on Useroutr. A receiver asks for an amount of an asset and shares
a link. Whoever opens it pays with any token, on any supported chain, from any wallet or by hand,
and the receiver gets exactly what they asked for in their own Stellar account.

Pomi is a showcase of Useroutr and a real product, the way Noblocks is for Paycrest. It runs on
the web and as an iOS and Android app.

Pomi is **non-custodial**. It never holds funds, keys or balances. Useroutr settles each payment
straight to the receiver's address; Pomi only creates requests and shows their status.

## 2. Rules that do not bend

- **Useroutr only through its public interface:** the published npm packages (`@useroutr/sdk`,
  `@useroutr/checkout-*`) and the public API. No copied code, no workspace links, no internal
  endpoints. "Built on Useroutr" must stay literally true.
- **The Useroutr API key lives only on the server** (`apps/web/src/server`). Browsers and the
  mobile app hold a funding token, which grants one funding intent.
- **Only a verified `funding.credited` webhook marks a payment as paid.** Nothing a browser,
  wallet or app reports moves a request.
- **Every webhook event is processed once,** keyed on `Useroutr-Event-Id` with a unique
  constraint. Treat every delivery as one that may come again.
- **Money is a decimal string** (`NUMERIC` in Postgres), never a float. Stellar amounts have
  seven decimal places; `parseRequestAmount` in `packages/shared` is the one parser.
- **Validate every external input at the boundary** with zod: requests, webhook payloads,
  Useroutr responses, environment variables.
- **Never log or commit secrets,** API keys, webhook secrets, email addresses or payout addresses.

## 3. Layout

```text
pomi/
├── apps/
│   ├── web/      Next.js: landing, pay page, receiver dashboard, and the app's backend
│   │   ├── src/app/      routes and pages
│   │   ├── src/server/   config, services, repositories, Useroutr client (server only)
│   │   └── prisma/       schema and migrations
│   └── mobile/   Expo Router: the receiver's iOS and Android app
├── packages/
│   └── shared/   code both apps use, imported as TypeScript source (no build step)
└── docs/spec.md  product, architecture, data, phases and open decisions
```

The backend is the Next.js server in phase 1: route handlers for the app's own API and the
Useroutr webhook, over services and repositories in `src/server`. The mobile app calls the same
routes. Move it to a service of its own only when push and background work outgrow it.

## 4. Stack

| Area | Choice |
|---|---|
| Monorepo | pnpm workspaces, Turborepo |
| Language | TypeScript 6.0, strict everywhere |
| Web and backend | Next.js 16.4, React 19.3 |
| Mobile | Expo SDK 58, Expo Router, React Native 0.88 (React 19.3) |
| Database | PostgreSQL, Prisma 7 |
| Validation | zod 4 |
| Tests | Vitest |

Both apps run React 19.3. Upgrade React only when Expo and Next both support the new version.
Add a dependency only when the stack above cannot do the job, and pin exact versions (Expo
packages keep the `~` ranges Expo's tooling manages).

## 5. Commands

```bash
pnpm install
docker compose up -d                  # Postgres on localhost:5436
pnpm db:migrate                       # apply migrations, or create one after a schema change
pnpm dev                              # every app
pnpm --filter @pomi/web dev           # web on :3000
pnpm --filter @pomi/mobile start      # Expo dev server
```

Quality gate, required before work is called done: `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`. CI runs the same. `pnpm test`
needs no database; `pnpm test:db` runs `*.db.test.ts` against the migrated Postgres in
`DATABASE_URL`, emptying its tables, so never point it at a database you want to keep.

## 6. Coding standards

- Comments say why, never what: a protocol constraint, a security reason, a non-obvious rule.
- Names say what a thing is: `fundingIntentId`, `payoutAddress`, `requestId`. No `data`, `item`.
- No `any`, and no type assertions to quiet the compiler. Validate unknown data instead.
- Throw named errors (`InvalidAmountError`); never swallow one. Public responses never carry
  stack traces or internal details.
- One job per function. Route handlers stay thin: validate, authorize, call a service, respond.
  Database access goes through repositories; Useroutr goes through one client module.
- Enforce invariants in the database (unique and partial unique indexes, check constraints,
  foreign keys), and wrap multi-step writes in a transaction. Prisma's schema cannot express
  partial indexes or checks: add them as SQL at the end of the migration, name each one in a
  comment on its model, and test that it refuses what it should (`schema.db.test.ts`).
- No dead code, debug output, commented-out code or `console.log`.

## 7. Testing

Every change ships with tests of behavior: success, invalid input, failures, authorization,
and repeats. A webhook delivered twice, or two visitors opening one request at once, must still
give one result. A phase is done when it has run on testnet and then with a small mainnet
payment, not when the tests pass.

## 8. Writing

Plain, short sentences. No em dashes. Docs and UI copy say what something does for the person
reading it.

## 9. Git

Small commits with conventional prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), one
concern each. Never commit `.env` files, build output or generated code.
