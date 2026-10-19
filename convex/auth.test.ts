import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
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
const checkCode = "/email-otp/check-verification-otp";

// A request through the app's /api/auth proxy, as the browser makes it.
async function post(t: Test, path: string, body: Record<string, string>) {
  const response = await t.fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", ...forwarded },
    body: JSON.stringify(body),
  });
  return response.status;
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
    expect(await post(t, checkCode, { email: alice, type: "sign-in", otp })).toBe(429);
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
});

test("sign-up keeps the first 50 characters of a trimmed name", async () => {
  const t = newTest();
  const user = await signUp(t, "long@example.test", ` ${"x".repeat(100_000)}`);
  expect((await user.query(api.account.get, {})).displayName).toBe("x".repeat(50));
});
