import { v } from "convex/values";
import { env } from "./_generated/server";
import { createAuth, seededAccounts } from "./auth";
import { internalMutation } from "./functions";

// Run by `convex deploy --preview-run seed` and by hand in dev. Convex gives functions no
// deployment-type signal, so TEST_OTP_CODE (never set in production) gates it.
export default internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!env.TEST_OTP_CODE) {
      throw new Error("The seed runs only where TEST_OTP_CODE is set (dev and previews).");
    }
    const { internalAdapter } = await createAuth(ctx).$context;
    for (const account of seededAccounts) {
      if (await internalAdapter.findUserByEmail(account.email)) continue;
      await internalAdapter.createUser({ ...account, emailVerified: true });
    }
    return null;
  },
});
