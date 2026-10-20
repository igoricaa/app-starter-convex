# App Starter (Convex)

The app-kit starter for Convex apps: TanStack Start on Vercel, Convex, and Better Auth with email codes. Shape replaces this paragraph with what the app is, who uses it, and what makes it special.

## A note from Igor

I like simple systems and software that feels obvious. Don't preserve complexity because it already exists, and don't add machinery because it looks impressive. Understand the real constraint, then build the smallest thing that makes the correct behaviour unsurprising.

Measure twice, cut once, and YAGNI. Fight scope creep.

Treat this file as good defaults, not hard rules. If a rule fights the task in front of you, say so and ask before breaking it.

## The ways to hurt yourself

1. **Touching production.**
   - Never run `convex deploy`, anything with `--prod`, or `convex import` (`--replace` wipes tables).
   - Production changes only by merging to `main`; Vercel's build deploys it (`scripts/vercel-build.sh`).
   - Never read, print or copy a deploy key.
2. **Printing secrets.** Never echo, log or commit one. Generate a secret and pipe it straight in: `openssl rand -base64 32 | bunx convex env set BETTER_AUTH_SECRET`.
3. **Breaking open tabs.** Users keep the old frontend open after a deploy, so a public function's arguments and return value change only additively. Removals and renames go in a later PR.
4. **Narrowing data in one step.** It takes three PRs: widen the schema, migrate (`@convex-dev/migrations`), then narrow, and only after the migration has completed. Igor takes a backup first.
5. **Running `convex dev`.** There is one dev deployment, and only Igor runs it. Builders run `bunx convex codegen` and test with `convex-test`; `/build`'s browser walk uses the PR's preview, which has its own backend.

## Hit every surface

The most common defect is a change that works on the path you tested and is missing everywhere else. Before calling work done, walk this list and say which entries applied:

- **Entry points:** every route, nav item and link that reaches the feature.
- **Roles and tenants:** who may see or do it, and what everyone else sees.
- **Reverse states:** a way in needs a way out and a way to see it.
- **Loading, empty and error states,** at 1440 and 390.
- **Email:** any message the change sends or should send.
- **Seed data:** a new kind of record needs seed rows, so previews show it.
- **Docs:** whether the change makes existing guidance wrong.

## Dev servers

- `bun install`. New worktrees get `.env.local` and dependencies from `t3.json` / `.worktreeinclude`.
- `bun run dev` runs Vite and `convex dev` together on port 3000. Only Igor runs it. It deletes and regenerates `src/routeTree.gen.ts` first, to work around a nitro beta restart bug (see `docs/internals/convex.md`).
- Stop what you started, by the PID you captured. Never kill by name or pattern.

## Test data

- `bunx convex run seed` creates the seeded accounts (see `convex/seed.ts`). It refuses wherever `TEST_OTP_CODE` is unset, which includes production.
- Sign in as a seeded account with the code in `TEST_OTP_CODE`. It works only in dev and previews, and only for seeded addresses. Previews get dev's code, so one value works on both. Use it without printing it: `TEST_OTP_CODE="$(bunx convex env get TEST_OTP_CODE)" bunx playwright …`.
- Each branch's previews share one backend, seeded when it's created.

## Verifying

- **Smallest proof:** format the files you touched with `bunx oxfmt <files>`; run the tests that cover the change, plus `bunx oxlint --type-aware <files>` and `bunx tsc --noEmit`. CI runs the full suite.
- **Backend changes** ship with focused `convex-test` tests at the function boundary: who may call it, whose data it touches, and the error codes. Copy `convex/account.test.ts`.
- **Test meaningful behaviour.** No static-render tests, no tests that mirror the implementation, no snapshots.
- **End-to-end:** one Playwright test (sign-in). Add one only for a flow whose breaking would really hurt.
- **Browsers:** the browser walk runs on the preview (see `/build`).

## Pull requests

- Conventional commit titles in plain language, with the Linear key: `feat(account): edit display name (APP-12)`.
- The body follows `/build`.
- Merging deploys production. CI green means verify, the Vercel build and the preview e2e for the head SHA; confirm e2e itself passed (`gh pr checks <n> --json name,bucket --jq '.[] | select(.name == "e2e") | .bucket'` prints `pass`).

## Documentation

Most changes need no doc change. Agents can read the code.
- **`docs/internals/`** is for constraints that span files and traps that are hard to see in the source. Before adding a paragraph, ask what a maintainer would get wrong without it.
- **Rewrite or delete** text that a change makes untrue. Never append a second account.
- **`GLOSSARY.md`** holds terms only.
- **`docs/adr/`** is for decisions that are hard to reverse, surprising, and a real trade-off.
- **`docs/decisions.md`** holds product rules in force, one line each, added only on Igor's yes.

## Plans and work artifacts

- Never commit plans, research notes, reports, handovers or scratch files.
- Specs and tickets live in Linear (`docs/agents/issue-tracker.md`). A merged PR is the implementation record.
- Research is saved only when Igor says so.

## How it works

- **Data:** the browser talks to Convex through TanStack Query (`@convex-dev/react-query`). Routes load data on the server with `ensureQueryData`, then stay live over the Convex socket.
- **Auth:** Better Auth runs inside Convex as a component, and Start proxies `/api/auth/*` to it.
  - The root route reads the session token on the server, so signed-in pages render with data.
  - `_authed` redirects signed-out visitors on the server.
- **Deploys:** Vercel runs `scripts/vercel-build.sh` on every deploy.
  - It refuses a deploy key from the wrong environment, a production build from any branch but `main`, and a production backend with `TEST_OTP_CODE` set.
  - `convex deploy` builds the web app against the target backend, then pushes the functions.
  - A preview creates its branch's backend and seeds it, or reuses it on later pushes. Production deploys to the production backend.

## Where code lives

- `convex/`: the backend.
  - Read `convex/_generated/ai/guidelines.md` and `docs/internals/convex.md` before writing Convex code.
  - `convex/functions.ts` holds the only query, mutation and action builders.
- **The reference slice:** `convex/account.ts`, `convex/account.test.ts` and `src/routes/_authed/account.tsx`. Copy its shape for new features.
- `src/routes/`: pages (file routes); `_authed/` needs a session.
- `src/components/ui/`: shadcn components (Base UI). They own their look.
- `src/lib/`: the auth client and server helpers.
- `tests/e2e/`: the one Playwright test.

## Taste

- **Every public function** goes through `convex/functions.ts`, validates its arguments, returns a narrow object, and throws `appError(code, message)`.
- **Identity** comes from `ctx.user`, never from arguments.
- **Ownership and tenancy** are checked against the record: load it and check its owner inside the mutation.
- **External services:** use a Convex component first. Otherwise write an Effect service, called from a thin action that writes back through a mutation. No Effect inside queries and mutations.
- **Validation** uses Convex `v.*` validators in functions and Effect Schema elsewhere. No Zod unless a dependency forces it.
- **UI components own their look.** Pick a `variant` or `size`; never restyle one with `className`. Layout goes on a wrapping element. `@shadcn/lint` enforces it. See `docs/internals/web-ui.md` once the UI foundation writes it.
- Inferred types over annotations. `any` is the enemy.
- **Comments** describe how a thing is used, mostly on functions. Never narrate lines. A lint or type suppression carries its reason.

<!-- app-kit:start (kit-owned; refresh replaces this block) -->
## Sessions

Igor starts every session, and each one ends by naming the next command.
- **Setup:** `/app-setup`.
- **Shape,** one unbroken session:
  1. `/grill-with-docs`. Terms go in `GLOSSARY.md`; an ADR only when a decision is hard to reverse, surprising and a real trade-off.
  2. **One screen for Igor to approve:** the technical approach and the spec outline (data model sketch, key libraries, departures from the kit's defaults, scope in and out, main flows, key decisions, risky parts, test seams), and a `Design:` line: Paper first, or straight to code.
  3. `/to-spec`, written into a Linear parent issue. Its seam check is answered "as outlined".
  4. **The spec challenge,** by stakes (see Routing). Its findings update the spec.
  5. A one-screen overview: what the challenge changed, and any questions.
  6. **Paper first:** stop here. Igor runs `/design`, then `/to-tickets <spec>`, because screen tickets name their frames.
  7. `/to-tickets`.
  8. Before `/build`, commit `GLOSSARY.md`, ADRs and `docs/decisions.md` straight to `main` (docs only), so builders' worktrees see them.
- **Build:** `/build`, a fresh session per batch. Merging deploys production.
- **A small, clear feature** (one piece, no new data model, not high-stakes) skips Shape: `/build <what>`. The coordinator writes one Linear ticket (acceptance criteria, test seam) and builds it. Everything else goes through Shape and both its approval rounds (the outline, then the spec and tickets).
- **Tiny tweaks** (copy, spacing, a label) go straight to `main`, with no PR and no review.

## Routing

Every dispatch pins its model and effort. Never Haiku. At most 6 Opus agents at high or xhigh at once, and 10 agents in total, nested included. Codex models (Sol, Astra) run through T3 `delegate_task`. If T3 is unreachable, stop and say so; never swap a model silently.

| Work | Model | Effort |
|---|---|---|
| Discovery and spec session | Opus 5.5 | xhigh |
| Spec challenge: new app or high-stakes / other specs / small features | Astra + Opus 5.5 / Astra / none | xhigh |
| Build coordinator (`/build`) | Opus 5.5 | high |
| Backend builder (and pieces with both backend and UI) | Opus 5.5 | medium; high for really complex work |
| Design session (`/design`), UI foundation | Opus 5.5 | high |
| Screens and views | Sonnet 5.5 | medium |
| Ordinary review | Sol | high |
| Important review: changed or removed arguments or returns of existing functions, APIs other apps consume, substantial behaviour, integrations | Sol | xhigh |
| High-stakes review: money, authorization and tenancy, migrations and deletion, concurrency, billing webhooks | Sol + Opus 5.5 | xhigh |
| UI review in the browser, once per batch | Opus 5.5 | high |
| Research | Sol | medium |
| Hard debugging | Sol (diagnose) → Opus 5.5 (fix) | xhigh → high |

Consequence decides the review tier, never size or a "UI" label. A one-line permission change is high-stakes.
<!-- app-kit:end -->

## Agent skills

### Issue tracker

Linear (MCP `<server>`), team `TEAM_KEY`, project `PROJECT_NAME`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.
