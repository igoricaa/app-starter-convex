import { afterEach, describe, expect, test, vi } from "vitest";
import { createAuth, seededAccounts } from "./auth";
import { newTest, signUp, type Test } from "./test.setup";

const FIXED_CODE = "424242";
const seeded = seededAccounts[0]!.email;
// What the app's /api/auth proxy forwards; Better Auth resolves its base URL from them.
const forwarded = { "X-Forwarded-Host": "localhost:3000", "X-Forwarded-Proto": "http" };

// Issues a sign-in code through the real generation hook (no mail), then signs in with `otp`.
async function signInStatus(email: string, otp: string) {
  const t = newTest();
  await t.run(async (ctx) => {
    await createAuth(ctx).api.createVerificationOTP({
      body: { email, type: "sign-in" },
      headers: new Headers(forwarded),
    });
  });
  const response = await t.fetch("/api/auth/sign-in/email-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", ...forwarded },
    body: JSON.stringify({ email, otp }),
  });
  return response.status;
}

const sendCode = "/email-otp/send-verification-otp";
const signIn = "/sign-in/email-otp";

// A request through the app's /api/auth proxy, as the browser makes it.
function browserFetch(
  t: Test,
  path: string,
  init: { method?: string; body?: object; cookie?: string },
) {
  return t.fetch(`/api/auth${path}`, {
    method: init.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      ...forwarded,
      ...(init.cookie && { Cookie: init.cookie }),
    },
    body: init.body && JSON.stringify(init.body),
  });
}

async function post(t: Test, path: string, body: Record<string, string>) {
  return (await browserFetch(t, path, { body })).status;
}

// Signs `email` in with a code it is sent; returns the browser's cookies and the session token.
async function signInCookie(t: Test, email: string, extra: Record<string, string> = {}) {
  expect(await post(t, sendCode, { email, type: "sign-in" })).toBe(200);
  const otp = (await storedCode(t, email))!.value.split(":")[0]!;
  const response = await browserFetch(t, signIn, { body: { email, otp, ...extra } });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { cookie, token: ((await response.json()) as { token: string }).token };
}

const DAY = 24 * 60 * 60;

// The Max-Age, in seconds, of the session cookie a response sets.
function sessionCookieMaxAge(response: Response) {
  const cookie = response.headers
    .getSetCookie()
    .find((c) => c.startsWith("better-auth.session_token="));
  return Number(/Max-Age=(\d+)/.exec(cookie ?? "")?.[1]);
}

// The stored sign-in code record for `email` ("<code>:<attempts>"), or null.
function storedCode(t: Test, email: string) {
  return t.run(async (ctx) => {
    const { internalAdapter } = await createAuth(ctx).$context;
    return internalAdapter.findVerificationValue(`sign-in-otp-${email}`);
  });
}

describe("fixed OTP", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("signs in a seeded account when TEST_OTP_CODE is set", async () => {
    vi.stubEnv("TEST_OTP_CODE", FIXED_CODE);
    expect(await signInStatus(seeded.toUpperCase(), FIXED_CODE)).toBe(200);
  });

  test("is refused without TEST_OTP_CODE", async () => {
    expect(await signInStatus(seeded, FIXED_CODE)).toBe(400);
  });

  test("is refused for an unseeded address", async () => {
    vi.stubEnv("TEST_OTP_CODE", FIXED_CODE);
    expect(await signInStatus("someone@example.test", FIXED_CODE)).toBe(400);
  });
});

describe("sign-in code limits", () => {
  const alice = "alice@example.test";

  test("past the issuance limit, a request neither stores nor replaces a code", async () => {
    const t = newTest();
    for (let i = 0; i < 3; i++) {
      expect(await post(t, sendCode, { email: alice, type: "sign-in" })).toBe(200);
    }
    const issued = await storedCode(t, alice);

    expect(await post(t, sendCode, { email: alice, type: "sign-in" })).toBe(429);
    expect(await storedCode(t, alice)).toEqual(issued);
    expect(await post(t, signIn, { email: alice, otp: issued!.value.split(":")[0]! })).toBe(200);
  });

  test("attempts past the limit are refused, even with a fresh code", async () => {
    const t = newTest();
    for (let i = 0; i < 10; i++) {
      expect(await post(t, signIn, { email: alice, otp: "000000" })).toBe(400);
    }
    expect(await post(t, sendCode, { email: alice, type: "sign-in" })).toBe(200);
    const otp = (await storedCode(t, alice))!.value.split(":")[0]!;

    expect(await post(t, signIn, { email: alice, otp })).toBe(429);
  });

  test("codes for new addresses can't use up existing users' codes", async () => {
    const t = newTest();
    await signUp(t, alice, "Alice");
    for (let i = 0; i < 100; i++) {
      expect(await post(t, sendCode, { email: `new${i}@example.test`, type: "sign-in" })).toBe(200);
    }

    expect(await post(t, sendCode, { email: "new100@example.test", type: "sign-in" })).toBe(429);
    expect(await storedCode(t, "new100@example.test")).toBeNull();
    expect(await post(t, sendCode, { email: alice, type: "sign-in" })).toBe(200);
    expect(await storedCode(t, alice)).not.toBeNull();
  });

  test("invalid addresses and codes that aren't sent don't count toward the new-address cap", async () => {
    const t = newTest();
    for (let i = 0; i < 100; i++) {
      expect(await post(t, sendCode, { email: `bad${i}`, type: "sign-in" })).toBe(400);
      expect(
        await post(t, sendCode, { email: `new${i}@example.test`, type: "forget-password" }),
      ).toBe(200);
    }
    expect(await post(t, sendCode, { email: "new@example.test", type: "sign-in" })).toBe(200);
  });
});

describe("account fields", () => {
  test("sign-up keeps a trimmed name of up to 50 characters and no image", async () => {
    const t = newTest();
    const email = "long@example.test";
    await signInCookie(t, email, { name: ` ${"x".repeat(100_000)}`, image: "x".repeat(1_000_000) });
    const { user, displayName } = await t.run(async (ctx) => {
      const { internalAdapter } = await createAuth(ctx).$context;
      return {
        user: (await internalAdapter.findUserByEmail(email))!.user,
        displayName: (await ctx.db.query("users").unique())!.displayName,
      };
    });
    expect([user.name, user.image, displayName]).toEqual(["x".repeat(50), null, "x".repeat(50)]);
  });

  test("a signed-in user can't change their name or image through Better Auth", async () => {
    const t = newTest();
    const { cookie } = await signInCookie(t, "alice@example.test", { name: "Alice" });
    const response = await browserFetch(t, "/update-user", {
      cookie,
      body: { name: "x".repeat(200_000), image: "https://example.test/a.png" },
    });
    expect(response.status).toBe(404);
  });
});

test("a session the server reads is extended by the browser, which keeps the cookie", async () => {
  const t = newTest();
  const { cookie, token } = await signInCookie(t, "alice@example.test");
  // Last extended two days ago: past Better Auth's one-day update age.
  const expiresAt = Date.now() + 5 * DAY * 1000;
  await t.run(async (ctx) => {
    const { internalAdapter } = await createAuth(ctx).$context;
    await internalAdapter.updateSession(token, { expiresAt: new Date(expiresAt) });
  });
  const expiry = () =>
    t.run(async (ctx) => {
      const { internalAdapter } = await createAuth(ctx).$context;
      return new Date((await internalAdapter.findSession(token))!.session.expiresAt).getTime();
    });

  // The server's SSR read (getToken): its Set-Cookie never reaches the browser, so it must not extend.
  const serverRead = await t.fetch("/api/auth/convex/token", { headers: { Cookie: cookie } });
  expect(serverRead.status).toBe(200);
  expect(await expiry()).toBe(expiresAt);

  // The browser's auth client: GET reports needsRefresh, then POST extends through the proxy.
  const read = await browserFetch(t, "/get-session", { method: "GET", cookie });
  expect(((await read.json()) as { needsRefresh: boolean }).needsRefresh).toBe(true);
  const refresh = await browserFetch(t, "/get-session", { cookie });
  expect(sessionCookieMaxAge(refresh)).toBeGreaterThan(6 * DAY);
  expect(await expiry()).toBeGreaterThan(expiresAt);
});
