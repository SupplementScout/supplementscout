import type { ReactNode, SVGProps } from "react";

export type SupplementScoutIconName =
  | "calculator"
  | "chart"
  | "check"
  | "clock"
  | "external-link"
  | "package"
  | "receipt"
  | "search"
  | "shield"
  | "store"
  | "truck";

type SupplementScoutIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: SupplementScoutIconName;
  size?: 16 | 18 | 20 | 24;
};

const paths: Record<SupplementScoutIconName, ReactNode> = {
  calculator: (
    <>
      <rect x="4" y="2.75" width="16" height="18.5" rx="2.5" />
      <path d="M7.5 6.5h9M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" />
    </>
  ),
  chart: <path d="M4 19.25V5.5M4 19.25h16M7 15l3.5-3.5 3 2 5-6" />,
  check: <path d="m5 12.5 4.25 4.25L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 7.5v5l3.25 2" />
    </>
  ),
  "external-link": <path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />,
  package: (
    <>
      <path d="m4 7 8-4 8 4-8 4-8-4Z" />
      <path d="M4 7v10l8 4 8-4V7M12 11v10" />
    </>
  ),
  receipt: <path d="M6 3.5h12v17l-2.5-1.5-2 1.5-2-1.5-2 1.5L6 18.75V3.5ZM9 8h6M9 12h6M9 16h3" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.25 15.25 4.25 4.25" />
    </>
  ),
  shield: <path d="M12 3 19 6v5.25c0 4.4-2.95 7.85-7 9.75-4.05-1.9-7-5.35-7-9.75V6l7-3Zm-3 9 2 2 4-4" />,
  store: <path d="M4 9.5V20h16V9.5M3 9.5l2-5h14l2 5M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6" />,
  truck: <path d="M3 6h11v10H3V6Zm11 4h4l3 3v3h-7v-6ZM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
};

export default function SupplementScoutIcon({
  name,
  size = 18,
  className,
  ...props
}: SupplementScoutIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
