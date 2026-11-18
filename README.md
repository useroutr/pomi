# Pomi

Get paid in what you want, from anything.

Ask for an amount of USDC or XLM and share a link. Whoever opens it can pay with any token, on any
supported chain, from any wallet or by hand. You receive exactly what you asked for, in your own
Stellar account. Pomi never holds your money.

Pomi is built on [Useroutr](https://useroutr.com), using only its public SDK and checkout
packages, so anything Pomi does, your app can do too.

**Status:** early. The workspace is in place; the first milestone, one paid request end to end on
the web, is being built.

## What is here

| Path              | What it is                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/web`        | Next.js: the landing page, the pay page, the receiver dashboard, and the backend that holds the Useroutr key |
| `apps/mobile`     | Expo: the receiver's iOS and Android app                                                                     |
| `packages/shared` | Code both apps use                                                                                           |
| `docs/spec.md`    | What Pomi is, how it works, and the plan                                                                     |

## Run it

You need Node.js 22.12 or later (24 recommended), pnpm 10, Docker for the local database, and
for the mobile app the Expo Go app or an iOS or Android simulator.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
docker compose up -d
pnpm db:migrate
pnpm --filter @pomi/web dev
```

Before the last step, set `AUTH_SECRET` in `apps/web/.env` to the output of
`openssl rand -base64 32`.

The web app runs on http://localhost:3000. Sign in at `/sign-in`: locally, the code is printed in
the terminal running the dev server instead of being emailed. A `ur_test_` Useroutr key works
against the Useroutr sandbox, on the Stellar testnet.

For the mobile app, point it at the web app, then start Expo and press `i` for the iOS
simulator or `a` for an Android emulator:

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @pomi/mobile start
```

## Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
```

## License

[MIT](LICENSE)
