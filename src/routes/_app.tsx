import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/AppShell";
import { LoadingState } from "~/components/LoadingState";
import { useClientData } from "~/lib/client/store";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

/**
 * The 4-tab shell (Home/Plan/Progress/More). Until onboarding completes,
 * every tab redirects to the onboarding root; the other tabs are placeholders
 * for Phase 3b/3c.
 */
function AppLayout() {
  const { status, onboarded } = useClientData();

  if (status !== "ready") {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface">
        <LoadingState label="Getting ready…" />
      </main>
    );
  }
  if (!onboarded) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}