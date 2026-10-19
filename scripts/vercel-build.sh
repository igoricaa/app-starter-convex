#!/usr/bin/env bash
# Vercel's build command. Convex picks the target deployment from CONVEX_DEPLOY_KEY, so a key in
# the wrong Vercel environment would deploy PR code to production. Refuse any mismatch first.
set -euo pipefail

case "${VERCEL_ENV:-}:${CONVEX_DEPLOY_KEY:-}" in
  production:prod:* | preview:preview:*) ;;
  *)
    echo "Refusing to build: VERCEL_ENV '${VERCEL_ENV:-}' does not match the CONVEX_DEPLOY_KEY type." >&2
    exit 1
    ;;
esac

if [ "$VERCEL_ENV" = production ]; then
  # A new Vercel project's first Git deployment goes to production, whatever its branch.
  if [ "${VERCEL_GIT_COMMIT_REF:-}" != main ]; then
    echo "Refusing to deploy: production builds only from main, not '${VERCEL_GIT_COMMIT_REF:-}'." >&2
    exit 1
  fi
  vars=$(bunx convex env list) || { echo "Could not read the production env vars." >&2; exit 1; }
  if grep -q '^TEST_OTP_CODE=' <<<"$vars"; then
    echo "Refusing to deploy: TEST_OTP_CODE is set on the production deployment." >&2
    exit 1
  fi
  bunx convex deploy --cmd 'bun run build'
else
  bunx convex deploy --cmd 'bun run build' --preview-run seed
fi
