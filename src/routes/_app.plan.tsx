import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "~/components/Placeholder";
import { PlanIcon } from "~/components/icons";

export const Route = createFileRoute("/_app/plan")({
  component: PlanRoute,
});

function PlanRoute() {
  return (
    <Placeholder
      icon={<PlanIcon className="h-5 w-5" />}
      title="Plan"
      description="Bills, debt scenarios, savings goals, optional giving, and simulated automation controls — everything that makes up your plan for the cycle."
      items={[
        "Bills with dates, amounts, and pay-from account",
        "Debt scenarios: highest-interest-first vs smallest-balance-first",
        "Savings goals with editable priorities",
        "Optional Giving — no preselected percentage",
        "Automation preview and pause (simulated only)",
      ]}
    />
  );
}