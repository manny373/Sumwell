import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "~/components/Placeholder";
import { MoreIcon } from "~/components/icons";

export const Route = createFileRoute("/_app/more")({
  component: MoreRoute,
});

function MoreRoute() {
  return (
    <Placeholder
      icon={<MoreIcon className="h-5 w-5" />}
      title="More"
      description="Everything else: complete accounts and transactions, Credit, Discover, support, privacy, and settings."
      items={[
        "Complete accounts & transactions (checking, savings, cards, loans, retirement, manual assets)",
        "Credit — truthful status page, no manufactured scores",
        "Discover — labeled synthetic offers only, with full terms",
        "Support, privacy, and settings",
        "CSV import, export, and deletion flows",
      ]}
    />
  );
}