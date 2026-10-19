import { ConvexError } from "convex/values";

export type ErrorCode = "UNAUTHENTICATED" | "INVALID_DISPLAY_NAME";

export function appError(code: ErrorCode, message: string) {
  return new ConvexError({ code, message });
}

// Only an appError's code and message reach the UI; anything else gets a generic message.
export function readError(error: unknown): { code: ErrorCode | "UNKNOWN"; message: string } {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    typeof error.data.code === "string" &&
    typeof error.data.message === "string"
  ) {
    return { code: error.data.code as ErrorCode, message: error.data.message };
  }
  return { code: "UNKNOWN", message: "Something went wrong. Please try again." };
}
