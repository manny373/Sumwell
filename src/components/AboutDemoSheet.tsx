import { Sheet } from "~/components/Dialog";
import { Button } from "~/components/Button";

/**
 * "About this demo" — ONE accessible surface holding every explanation the
 * prototype used to repeat across sidebars, badges, and footers (Finding 9):
 * synthetic data, no bank connections, no real money, no credit pulls, data
 * stays on this device, and what "estimat/ed" means. The persistent shell
 * chip opens this; screens keep ONE obvious indicator and link here instead
 * of repeating the sentences themselves.
 */
export function AboutDemoSheet({
  open,
  onClose,
  sourceIsDemo,
}: {
  open: boolean;
  onClose: () => void;
  /** true when the household is the synthetic demo; false = manual numbers. */
  sourceIsDemo: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="About this demo"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <div className="flex flex-col gap-4 text-body-sm leading-relaxed text-ink-muted">
        {sourceIsDemo ? (
          <p>
            <strong className="text-ink">All data here is synthetic.</strong>{" "}
            The accounts, bills, debts, goals, and paychecks are a made-up
            household for exploring the product. Nothing matches a real bank
            account or person.
          </p>
        ) : (
          <p>
            <strong className="text-ink">These are your numbers, kept on this
            device only.</strong>{" "}
            There is no account, login, or server — the data you entered is
            stored in your browser and can be cleared any time.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          <li>
            <strong className="text-ink">No bank connections.</strong>{" "}
            Nothing is linked to a real institution, and no bank password is
            ever asked for.
          </li>
          <li>
            <strong className="text-ink">No real money moves.</strong>{" "}
            Plans, allocations, and simulated rules reserve nothing and
            transfer nothing. "Preview" never means "paid".
          </li>
          <li>
            <strong className="text-ink">No credit pulls.</strong> No score is
            pulled, manufactured, or inferred from transactions.
          </li>
          <li>
            <strong className="text-ink">Estimates are labeled.</strong>{" "}
            Remaining money, payoff dates, and interest are estimates from the
            numbers on record — never promises.
          </li>
          <li>
            <strong className="text-ink">Prototype, not a financial
            service.</strong> This is a design and planning demo for review,
            not advice, security, or a product guarantee.
          </li>
        </ul>
        <p className="text-caption text-ink-faint">
          See Support in the More tab for what the prototype can and can't do.
        </p>
      </div>
    </Sheet>
  );
}