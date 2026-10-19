import { v } from "convex/values";
import { appError } from "./errors";
import { authedMutation, authedQuery } from "./functions";

export const get = authedQuery({
  args: {},
  returns: v.object({ email: v.string(), displayName: v.string() }),
  handler: async (ctx) => ({ email: ctx.user.email, displayName: ctx.user.displayName }),
});

export const updateDisplayName = authedMutation({
  args: { displayName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const displayName = args.displayName.trim();
    if (displayName.length === 0 || displayName.length > 50) {
      throw appError("INVALID_DISPLAY_NAME", "Display name must be 1 to 50 characters.");
    }
    await ctx.db.patch("users", ctx.user._id, { displayName });
    return null;
  },
});
