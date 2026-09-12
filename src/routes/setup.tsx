import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoadingState } from "~/components/LoadingState";
import { ThemeToggle } from "~/components/theme";
import { ManualSetupForm } from "~/components/app/ManualSetupForm";
import { useClientData } from "~/lib/client/store";
import { Logo } from "~/components/Logo";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/setup")({
  component: SetupRoute,
});

/**
 * The manual form route — used by onboarding ("Enter a few numbers") and by
 * the Home "These are estimates — edit" path (prefilled from the current
 * household; saving replaces it with your numbers, labeled manual).
 */
function SetupRoute() {
  const navigate = useNavigate();
  const { status, onboarded, household, saveManual, replaceHousehold } =
    useClientData();

  if (status !== "ready") {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface">
        <LoadingState label="Getting ready…" />
      </main>
    );
  }

  const isEdit = onboarded && household !== null;

  return (
    <main className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
          <Link to={isEdit ? "/home" : "/"} aria-label="Sumwell home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
        <ManualSetupForm
          initialHousehold={household}
          submitLabel={isEdit ? "Save changes" : "See my plan"}
          backHref={isEdit ? "/home" : "/"}
          backLabel={isEdit ? "Back to Home" : "Back"}
          onSubmit={(inputs) => {
            if (isEdit) {
              replaceHousehold(inputs);
            } else {
              saveManual(inputs);
            }
            void navigate({ to: "/home" });
          }}
        />
      </div>
    </main>
  );
}