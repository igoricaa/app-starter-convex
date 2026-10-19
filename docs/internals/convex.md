# Convex

What `AGENTS.md` doesn't cover, for anyone writing Convex code.

## The reference slice

`convex/account.test.ts` shows what every backend change proves: a signed-out caller is refused, a second user can't reach the first one's data, and an invalid input returns its code. `src/routes/_authed/account.tsx` shows the page side: a loader with `ensureQueryData`, and the error code shown on its field.

## Rules lint and types don't cover

- **Builders.** `convex/functions.ts` has `authedQuery` and `authedMutation`, which set `ctx.user` or throw `UNAUTHENTICATED`, plus `public*` and `internal*`. `authed*` establishes who is calling; checking that the caller owns the document is still the handler's job.
- **Ownership.** A function that takes a record's ID loads the record and refuses anyone else's as missing:

  ```ts
  const note = await ctx.db.get("notes", args.noteId);
  if (!note || note.ownerId !== ctx.user._id) throw appError("NOT_FOUND", "Note not found.");
  ```

  Its test: user B passes user A's ID, gets `NOT_FOUND`, and A's record is unchanged.

- **Errors.** Add each new code to `ErrorCode` in `convex/errors.ts`. The UI shows only what `readError` returns, so internal messages never reach users.
- **Environment.** Declare every variable in `convex/convex.config.ts` and read it through `env` from `./_generated/server`. A deploy fails while a required one is missing.
- **Previews.** A new preview backend gets the Convex project's preview default env vars. Its `SITE_URL` is a wildcard host, so sign-in works on both the deployment URL and the branch URL.
- **Auth.** `convex/auth.ts` holds Better Auth (email OTP only), the seeded accounts and the per-address code limits. Server-rendered auth follows `get-convex/better-auth/examples/tanstack`.
- **Tests.** `convex/test.setup.ts` gives a fresh backend (`newTest`) and real Better Auth users (`signUp`).
- **Dev restarts.** `bun run dev` deletes `src/routeTree.gen.ts` first: nitro `3.0.260903-beta` otherwise fails every restart after the first ("Vite environment ssr is unavailable"). Remove the `rm` once nitro ships a fix.
