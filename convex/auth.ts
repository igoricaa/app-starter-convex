import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireActionCtx } from "@convex-dev/better-auth/utils";
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { Resend } from "@convex-dev/resend";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins/email-otp";
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
    // would throttle all users together. OTP mail is limited per address in sendOtpEmail instead.
    rateLimit: { enabled: false },
    plugins: [
      emailOTP({
        // Returning undefined falls back to a random code; expiry and attempt limits apply either way.
        generateOTP: ({ email }) =>
          env.TEST_OTP_CODE && isSeeded(email) ? env.TEST_OTP_CODE : undefined,
        sendVerificationOTP: async ({ email, otp }) => {
          if (isSeeded(email)) return;
          await sendOtpEmail(requireActionCtx(ctx), email, otp);
        },
      }),
      convex({ authConfig }),
    ],
  });

const otpEmailLimits = new RateLimiter(components.rateLimiter, {
  perAddress: { kind: "token bucket", rate: 3, period: 10 * MINUTE },
  total: { kind: "fixed window", rate: 100, period: HOUR },
});

async function sendOtpEmail(ctx: ActionCtx, to: string, otp: string) {
  const allowed =
    (await otpEmailLimits.limit(ctx, "perAddress", { key: to })).ok &&
    (await otpEmailLimits.limit(ctx, "total")).ok;
  // Better Auth logs a send failure and still answers success, so callers learn nothing.
  if (!allowed) throw new Error("Too many sign-in codes requested; no mail sent.");
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
