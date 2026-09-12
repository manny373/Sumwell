import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "~/components/Placeholder";
import { HomeIcon } from "~/components/icons";

export const Route = createFileRoute("/_app/home")({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <Placeholder
      icon={<HomeIcon className="h-5 w-5" />}
      title="Home"
      description="Your paycheck horizon at a glance — estimated remaining money, the next obligation, and one explained next action."
      items={[
        "Paycheck horizon: days until payday and what the check must cover",
        "Estimated remaining money after obligations, essentials, goals and buffer",
        "Next obligation with date and amount",
        "One explained next action per pay cycle",
        "Route into accounts and transactions",
      ]}
    />
  );
}