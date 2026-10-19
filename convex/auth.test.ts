import { afterEach, describe, expect, test, vi } from "vitest";
import { createAuth, seededAccounts } from "./auth";
import { newTest } from "./test.setup";

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
