import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireActionCtx, requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { Resend } from "@convex-dev/resend";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins/email-otp";
import * as z from "zod";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { env, type ActionCtx } from "./_generated/server";
import authConfig from "./auth.config";

// Created by convex/seed.ts. While TEST_OTP_CODE is set they sign in with that code; they never get mail.
export const seededAccounts = [{ email: "test@example.test", name: "Test User" }];

function isSeeded(email: string) {
  const normalized = email.trim().toLowerCase();
  return seededAccounts.some((account) => account.email === normalized);
}

// A seeded account's code is TEST_OTP_CODE and never mailed, so issuing it again costs nothing.
function usesFixedCode(email: string) {
  return !!env.TEST_OTP_CODE && isSeeded(email);
}

// Keyed by address, never by IP: behind the app's proxy every request comes from the server's IP.
const otpLimits = new RateLimiter(components.rateLimiter, {
  codesPerAddress: { kind: "token bucket", rate: 3, period: 10 * MINUTE },
  // Only addresses without an account count, so a flood of new ones can't lock out existing users.
  codesForNewAddresses: { kind: "fixed window", rate: 100, period: HOUR },
  attemptsPerAddress: { kind: "token bucket", rate: 10, period: 10 * MINUTE },
});

// The sign-in flow's only two email-code endpoints. Every other one is disabled below.
const sendCode = "/email-otp/send-verification-otp";
const signIn = "/sign-in/email-otp";

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        await ctx.db.insert("users", {
          authId: authUser._id,
          email: authUser.email,
          displayName: authUser.name,
        });
      },
    },
  },
});

export const { onCreate } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    // Resolved per request from the host the app's proxy forwards, so a wildcard SITE_URL covers
    // every preview URL. The server's session lookups arrive on CONVEX_SITE_URL itself.
    baseURL: {
      allowedHosts: [env.SITE_URL, env.CONVEX_SITE_URL],
      protocol: env.SITE_URL.startsWith("https:") ? "https" : "http",
    },
    database: authComponent.adapter(ctx),
    // Behind the app's proxy every request reaches Convex from the server's IP, so per-IP limits
    // would throttle all users together. The hook below limits codes per address instead.
    rateLimit: { enabled: false },
    // /update-user would take any name or image; the app's account.updateDisplayName validates
    // names. The rest are the email-code endpoints the sign-in flow doesn't use.
    disabledPaths: [
      "/update-user",
      "/email-otp/check-verification-otp",
      "/email-otp/verify-email",
      "/email-otp/request-password-reset",
      "/forget-password/email-otp",
      "/email-otp/reset-password",
      "/email-otp/request-email-change",
      "/email-otp/change-email",
    ],
    databaseHooks: {
      user: {
        create: {
          // Sign-up accepts any name and image; keep the account slice's limit and no image.
          before: async (user) => ({
            data: { ...user, name: user.name.trim().slice(0, 50), image: null },
          }),
        },
      },
    },
    // Reads never extend a session: the server's SSR token read drops Better Auth's Set-Cookie.
    // The browser's auth client sees `needsRefresh` and extends it through the app's proxy.
    session: { deferSessionRefresh: true },
    hooks: {
      // Runs before the endpoint, so a refused request never stores or replaces a code.
      before: createAuthMiddleware(async ({ path, body, context }) => {
        // As the endpoints read it. No code exists for an invalid address, so it needs no limit.
        const email = typeof body?.email === "string" ? body.email.toLowerCase() : "";
        if ((path !== sendCode && path !== signIn) || !z.email().safeParse(email).success) return;
        const limitCtx = requireRunMutationCtx(ctx);
        const ok =
          path === signIn
            ? (await otpLimits.limit(limitCtx, "attemptsPerAddress", { key: email })).ok
            : usesFixedCode(email) ||
              ((await otpLimits.limit(limitCtx, "codesPerAddress", { key: email })).ok &&
                // Only a sign-in code is sent to an address without an account.
                (body.type !== "sign-in" ||
                  !!(await context.internalAdapter.findUserByEmail(email)) ||
                  (await otpLimits.limit(limitCtx, "codesForNewAddresses")).ok));
        if (!ok)
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many tries. Wait a few minutes.",
          });
      }),
    },
    plugins: [
      emailOTP({
        // Returning undefined falls back to a random code; expiry and attempt limits apply either way.
        generateOTP: ({ email }) => (usesFixedCode(email) ? env.TEST_OTP_CODE : undefined),
        sendVerificationOTP: async ({ email, otp }) => {
          if (isSeeded(email)) return;
          await sendOtpEmail(requireActionCtx(ctx), email, otp);
        },
      }),
      convex({ authConfig }),
    ],
  });

// Better Auth logs a send failure and still answers success, so callers learn nothing.
async function sendOtpEmail(ctx: ActionCtx, to: string, otp: string) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error(
      "Email is not configured: set RESEND_API_KEY and EMAIL_FROM on the deployment.",
    );
  }
  const resend = new Resend(components.resend, { apiKey: env.RESEND_API_KEY, testMode: false });
  await resend.sendEmail(ctx, {
    from: env.EMAIL_FROM,
    to,
    subject: `Your sign-in code: ${otp}`,
    text: `Your sign-in code is ${otp}. It expires in 5 minutes.`,
  });
}
