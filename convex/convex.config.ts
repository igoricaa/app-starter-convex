import betterAuth from "@convex-dev/better-auth/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    // The app's origin. Previews use a wildcard host, e.g. https://<project>-*-<team>.vercel.app.
    SITE_URL: v.string(),
    BETTER_AUTH_SECRET: v.string(),
    RESEND_API_KEY: v.optional(v.string()),
    EMAIL_FROM: v.optional(v.string()),
    // Dev and preview only. Its presence also lets the seed run.
    TEST_OTP_CODE: v.optional(v.string()),
  },
});

app.use(betterAuth);
app.use(resend);
app.use(rateLimiter);

export default app;
