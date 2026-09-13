import { Card } from "~/components/Card";
import { ShieldIcon } from "~/components/icons";

/**
 * The rest of the More tab — honest placeholder states for Credit, Discover,
 * Support, Privacy, and Settings. Everything here says "not available /
 * prototype", never implying a real service exists.
 */
export function MoreSections() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card padded>
        <p className="text-body font-semibold text-ink">Credit</p>
        <p className="mt-1 text-body-sm text-ink-muted">
          Not available in the prototype. No credit provider is connected, so there is no credit
          monitoring and no score here — and Sumwell never manufactures a score from your
          transactions.
        </p>
      </Card>
      <Card padded>
        <p className="text-body font-semibold text-ink">Discover</p>
        <p className="mt-1 text-body-sm text-ink-muted">
          Labeled synthetic offers only (Milestone A). Any sample offer shown is marked as a demo,
          with full terms stored as data — Sumwell never invents approval odds.
        </p>
      </Card>
      <Card padded>
        <p className="text-body font-semibold text-ink">Support</p>
        <p className="mt-1 text-body-sm text-ink-muted">
          This is a prototype for design review. Questions go to the founder during the Milestone A
          checkpoint.
        </p>
      </Card>
      <Card padded>
        <p className="text-body font-semibold text-ink">Privacy</p>
        <p className="mt-1 text-body-sm text-ink-muted">
          In this prototype your data lives only on this device (local storage). Nothing is sent to
          a server, and no bank, credit bureau, or partner sees it.
        </p>
      </Card>
      <Card padded>
        <p className="flex items-center gap-1.5 text-body font-semibold text-ink">
          <ShieldIcon className="h-4 w-4 text-ink-faint" />
          Settings
        </p>
        <p className="mt-1 text-body-sm text-ink-muted">
          Theme (light/dark) lives in the header. Data can be exported or deleted from the actions
          above; “Start over” is available from the Home tab. There is no account, login, or
          cloud sync in the prototype.
        </p>
      </Card>
    </div>
  );
}