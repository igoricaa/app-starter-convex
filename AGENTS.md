# AGENTS.md

Placeholder until the kit writes the full file.

## Ways to hurt yourself

- **A local `convex deploy`, or any command with `--prod`.** Deploys happen only through Vercel's build (`scripts/vercel-build.sh`).
- **`convex import --replace`.** It overwrites tables.
- **Production keys.** Never read, print or use one. Production env vars are set by the owner.

## Rules

- A public function's arguments and return value change only additively. Removals and renames wait for a later PR, because open tabs keep running the old frontend.
- Builders run `bunx convex codegen`, never `convex dev`. One person owns the dev deployment.
- Read `convex/_generated/ai/guidelines.md` before writing Convex code.

## Where code lives

The account page is the reference slice; copy its shape. See `docs/internals/convex.md`.
