import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "~/components/Placeholder";
import { ProgressIcon } from "~/components/icons";

export const Route = createFileRoute("/_app/progress")({
  component: ProgressRoute,
});

function ProgressRoute() {
  return (
    <Placeholder
      icon={<ProgressIcon className="h-5 w-5" />}
      title="Progress"
      description="Goal progress and confirmed financial changes over time — every estimate clearly labeled, with dated history and evidence."
      items={[
        "Goal progress against the plan (estimates labeled as estimates)",
        "Confirmed financial changes with dates and evidence — nothing credited to the app without proof",
        "Dated history of pay cycles and what changed",
        "Honest empty states until real changes exist",
      ]}
    />
  );
}