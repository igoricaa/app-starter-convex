import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Better Auth's own tables live in its component.
export default defineSchema({
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    displayName: v.string(),
  }).index("by_authId", ["authId"]),
});
