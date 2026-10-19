/// <reference types="vite/client" />
import betterAuthTest from "@convex-dev/better-auth/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { createAuth } from "./auth";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

export function newTest() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  rateLimiterTest.register(t);
  return t;
}

export type Test = ReturnType<typeof newTest>;

// A real Better Auth user and session, so tests pass through the same identity check as the app.
export async function signUp(t: Test, email: string, name: string) {
  const { userId, sessionId } = await t.run(async (ctx) => {
    const { internalAdapter } = await createAuth(ctx).$context;
    const user = await internalAdapter.createUser({ email, name, emailVerified: true });
    const session = await internalAdapter.createSession(user.id);
    return { userId: user.id, sessionId: session.id };
  });
  return t.withIdentity({ subject: userId, sessionId });
}
