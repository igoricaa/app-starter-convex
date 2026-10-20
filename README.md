# app-starter-convex

app-kit's starter for Convex apps: TanStack Start on Vercel, Convex, Better Auth with email codes, and shadcn/ui on Base UI.

New apps are created from this template with `/app-setup new <name>`, the user-level skill in [igoricaa/app-kit](https://github.com/igoricaa/app-kit). It also wires the app's services.

## Inside

- The account page as the reference slice: `convex/account.ts`, its tests, and `src/routes/_authed/account.tsx`.
- Sign-in with email codes, a seeded test account, and one Playwright test of the flow.
- CI: `verify` on every PR and on `main`; `e2e` against each Vercel preview, which has its own Convex backend.
- `scripts/vercel-build.sh`, the only path to production: merging to `main`. A push with only docs changes since the last production deployment skips the production build (`vercel.json`).
- The kit's agent files: `AGENTS.md`, the skills in `.agents/skills/`, `docs/agents/` and `.coderabbit.yaml`.

## Links

- [`AGENTS.md`](AGENTS.md): how to work here. Read it first.
- [`docs/internals/convex.md`](docs/internals/convex.md): Convex rules.
- Live: https://app-starter-convex.vercel.app

PRs labelled `coderabbit` get a CodeRabbit review; `/build` adds the label to important, high-stakes or bigger PRs.
