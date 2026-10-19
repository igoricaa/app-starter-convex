# app-starter-convex

app-kit's Convex starter: TanStack Start, Convex, Better Auth (email OTP), shadcn/ui, deployed on Vercel.

`/app-setup` in app-kit creates an app from this template and wires its services. Read `AGENTS.md` before changing anything.

## Commands

- `bun run dev`: the Convex dev deployment and the app on http://localhost:3000.
- `bun run check`: format, lint, knip, types and unit tests, as CI runs them.
- `bun run e2e`: the sign-in flow in Playwright; needs `TEST_OTP_CODE`.

## Deploys

- Every PR gets a Vercel preview with its own Convex preview backend, seeded with `test@example.test`, which signs in with the fixed `TEST_OTP_CODE` and gets no mail. CI runs the sign-in test against it.
- Merging to `main` deploys production. Vercel's build runs `scripts/vercel-build.sh`, which refuses a deploy key from the wrong environment.
