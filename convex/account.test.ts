import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { newTest, signUp } from "./test.setup";

describe("account", () => {
  test("refuses a signed-out caller", async () => {
    const t = newTest();
    await expect(t.query(api.account.get, {})).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(
      t.mutation(api.account.updateDisplayName, { displayName: "Mallory" }),
    ).rejects.toThrow(/UNAUTHENTICATED/);
  });

  test("user B can't read or change user A's account", async () => {
    const t = newTest();
    const alice = await signUp(t, "alice@example.test", "Alice");
    const bob = await signUp(t, "bob@example.test", "Bob");

    expect(await bob.query(api.account.get, {})).toEqual({
      email: "bob@example.test",
      displayName: "Bob",
    });
    await bob.mutation(api.account.updateDisplayName, { displayName: "Bobby" });

    expect(await alice.query(api.account.get, {})).toEqual({
      email: "alice@example.test",
      displayName: "Alice",
    });
  });

  test("an invalid name returns its code and changes nothing", async () => {
    const t = newTest();
    const alice = await signUp(t, "alice@example.test", "Alice");

    for (const displayName of ["   ", "x".repeat(51)]) {
      await expect(alice.mutation(api.account.updateDisplayName, { displayName })).rejects.toThrow(
        /INVALID_DISPLAY_NAME/,
      );
    }
    expect((await alice.query(api.account.get, {})).displayName).toBe("Alice");
  });
});
