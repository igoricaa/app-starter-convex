# Convex

The account page is the reference slice. New features copy its shape:

- `convex/account.ts`: functions built from `convex/functions.ts`, validated arguments, a narrow `returns`, identity from `ctx.user`, never from arguments.
- `convex/account.test.ts`: a signed-out caller is refused, a second user can't reach the first one's data, an invalid input returns its code.
- `src/routes/_authed/account.tsx`: a loader with `ensureQueryData`, the error code shown on its field.

## Rules lint and types don't cover

- **Builders.** Every function comes from `convex/functions.ts` (lint enforces it). `authed*` establishes who is calling; checking that the caller owns the document is still the handler's job.
- **Errors.** Throw `appError(code, message)` from `convex/errors.ts`. The UI shows only what `readError` returns, so internal messages never reach users.
- **Environment.** Declare every variable in `convex/convex.config.ts` and read it through `env` from `./_generated/server`. A deploy fails while a required one is missing.
- **Previews.** Each branch gets its own Convex preview deployment with the project's preview default env vars, and `scripts/vercel-build.sh` seeds it. A later push to the branch reuses that deployment. Its `SITE_URL` is a wildcard host, so sign-in works on both the deployment URL and the branch URL.
- **Auth.** `convex/auth.ts` holds Better Auth (email OTP only), the fixed test code for seeded accounts and the OTP mail limits. Server-rendered auth follows `get-convex/better-auth/examples/tanstack`.
- **Seed.** `convex/seed.ts` creates the seeded accounts. It runs on every preview and refuses where `TEST_OTP_CODE` is unset, which includes production.
- **Tests.** `convex/test.setup.ts` gives a fresh backend and real Better Auth users (`signUp`).
