import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/")({
  component: Home,
});

function Home() {
  return (
    <p>
      Welcome back. Edit your <Link to="/account">account</Link>.
    </p>
  );
}
