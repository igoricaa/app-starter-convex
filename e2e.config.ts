import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { existsSync } from "node:fs";

// Local runs and `e2e mcp` (which agents start with a bare environment) read APP_URL and the secrets from this ignored file.
if (existsSync(".env.e2e")) process.loadEnvFile(".env.e2e");

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default {
  targets: [
    {
      // e2e sends headers to the app's own site only, never to Convex or other hosts.
      engine: web(bypass ? { headers: { "x-vercel-protection-bypass": bypass } } : {}),
      app: {
        url: process.env.APP_URL ?? "http://localhost:3000",
        identity: "app-starter-convex",
        environment: "staging",
      },
    },
  ],
  credentials: {
    // The seeded account. Its password is the fixed sign-in code, set only in dev and previews.
    test: { username: "test@example.test", password: () => process.env.TEST_OTP_CODE ?? "" },
  },
} satisfies E2EConfig;
