import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

function Base({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11v-9.5" />
      <path d="M10 20v-5.2h4V20" />
    </Base>
  );
}

export function PlanIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M4 10.2h16" />
      <path d="M8.5 3.5v3.6M15.5 3.5v3.6" />
      <path d="M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01" />
    </Base>
  );
}

export function ProgressIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 17l5-5 3.5 3.5L20 7" />
      <path d="M14.5 7H20v5.5" />
    </Base>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="6" cy="12" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.55" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.55" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7.2h13.5a2 2 0 0 1 2 2v8.1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 7.2V6.2A1.7 1.7 0 0 1 5.7 4.5h11A2.3 2.3 0 0 1 19 6.8" />
      <circle cx="16" cy="13.3" r="1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5.5 12.5l4.4 4.4L18.5 7.5" />
    </Base>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9.5l6 6 6-6" />
    </Base>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9.5 6l6 6-6 6" />
    </Base>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.6h.01" />
    </Base>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10.5 4.2 3 17a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.5 4.2a2 2 0 0 0-3 0z" />
      <path d="M12 9.5v4.2" />
      <path d="M12 17h.01" />
    </Base>
  );
}

export function XCircleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </Base>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.6l2.8 2.8L16.2 9.6" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </Base>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.2M12 19v2.2M21.2 12H19M5 12H2.8M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6M18.5 18.5l-1.6-1.6M7.1 7.1 5.5 5.5" />
    </Base>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z" />
    </Base>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 20s-7.2-4.4-9.2-8.7C1.3 8.3 3.6 5.3 7 5.3c2 0 3.7 1.2 5 3 1.3-1.8 3-3 5-3 3.4 0 5.7 3 4.2 6-2 4.3-9.2 8.7-9.2 8.7z" />
    </Base>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 19 6v5.2c0 4.5-3 7.5-7 9.3-4-1.8-7-4.8-7-9.3V6z" />
      <path d="M9 11.6l2.2 2.2 3.8-4.2" />
    </Base>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.4" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9.3 14.7l5.4-5.4" />
      <path d="M7.2 11.6 5.3 13.5a3.7 3.7 0 0 0 5.2 5.2l1.9-1.9" />
      <path d="M16.8 12.4l1.9-1.9a3.7 3.7 0 0 0-5.2-5.2l-1.9 1.9" />
    </Base>
  );
}

export function QuestionIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.4a2.6 2.6 0 1 1 3.7 2.4c-.8.4-1.1.9-1.1 1.9v.3" />
      <path d="M12 17.2h.01" />
    </Base>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="6.4" />
      <path d="M20 20l-3.8-3.8" />
    </Base>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 7h8.5M18 7h1M5 17h1M10.5 17H19" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Base>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4v10" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </Base>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" />
      <path d="M8.5 10.5v-3a3.5 3.5 0 0 1 7 0v3" />
    </Base>
  );
}