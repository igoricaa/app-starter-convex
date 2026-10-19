import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "~/components/ui/button";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { api } from "../../../convex/_generated/api";
import { readError } from "../../../convex/errors";

const accountQuery = convexQuery(api.account.get, {});

export const Route = createFileRoute("/_authed/account")({
  loader: ({ context }) => context.queryClient.ensureQueryData(accountQuery),
  component: AccountPage,
});

function AccountPage() {
  const { data: account } = useSuspenseQuery(accountQuery);
  const [displayName, setDisplayName] = useState(account.displayName);
  const hydrated = useHydrated();
  const update = useMutation({ mutationFn: useConvexMutation(api.account.updateDisplayName) });
  const error = update.error ? readError(update.error) : null;
  const nameError = error?.code === "INVALID_DISPLAY_NAME" ? error.message : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate({ displayName });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Account</h1>
      <p className="text-sm text-muted-foreground">{account.email}</p>
      <Field data-invalid={nameError ? true : undefined}>
        <FieldLabel htmlFor="displayName">Display name</FieldLabel>
        <Input
          id="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={nameError ? true : undefined}
        />
        <FieldError>{nameError}</FieldError>
      </Field>
      {error && !nameError && <p role="alert">{error.message}</p>}
      <div>
        <Button type="submit" disabled={!hydrated || update.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
