import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { authClient } from "~/lib/auth-client";
import { getToken } from "~/lib/auth-server";
import appCss from "~/styles/app.css?url";

const getAuthToken = createServerFn({ method: "GET" }).handler(() => getToken());

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "App" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: import.meta.env.VITE_CONVEX_URL },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const token = await getAuthToken();
    // Only exists during SSR: authenticates the server-side queries of this request.
    if (token) context.convexQueryClient.serverHttpClient?.setAuth(token);
    return { isAuthenticated: Boolean(token), token };
  },
  shellComponent: Document,
  component: RootComponent,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootComponent() {
  const { convexQueryClient, token } = Route.useRouteContext();
  return (
    <ConvexBetterAuthProvider
      client={convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={token}
    >
      <Outlet />
    </ConvexBetterAuthProvider>
  );
}

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootError({ error }: ErrorComponentProps) {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="mt-4 overflow-x-auto text-xs">{error.stack}</pre>
      )}
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block underline">
        Go home
      </Link>
    </main>
  );
}
