// The only place raw builders are imported (lint enforces it). Every function is built from these.
// They establish identity; ownership is still each handler's job (see convex/account.ts).
import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import {
  internalAction as rawInternalAction,
  internalMutation as rawInternalMutation,
  internalQuery as rawInternalQuery,
  mutation as rawMutation,
  query as rawQuery,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { appError } from "./errors";

async function requireUser(ctx: QueryCtx) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  const user =
    authUser &&
    (await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .unique());
  if (!user) throw appError("UNAUTHENTICATED", "Please sign in.");
  return user;
}

const withUser = customCtx(async (ctx: QueryCtx) => ({ user: await requireUser(ctx) }));

export const authedQuery = customQuery(rawQuery, withUser);
export const authedMutation = customMutation(rawMutation, withUser);

export const publicQuery = rawQuery;
export const publicMutation = rawMutation;

export const internalQuery = rawInternalQuery;
export const internalMutation = rawInternalMutation;
export const internalAction = rawInternalAction;
