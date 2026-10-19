import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
          env: {
            SITE_URL: "http://localhost:3000",
            CONVEX_SITE_URL: "https://some.convex.site",
            BETTER_AUTH_SECRET: "test-only-secret-0123456789abcdef",
          },
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
});
