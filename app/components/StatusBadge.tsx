import type { ReactNode } from "react";
import SupplementScoutIcon, {
  type SupplementScoutIconName,
} from "./SupplementScoutIcon";

type StatusBadgeTone = "availability" | "comparison" | "evidence" | "neutral";

const toneClassNames: Record<StatusBadgeTone, string> = {
  availability: "ss-badge--availability",
  comparison: "ss-badge--comparison",
  evidence: "ss-badge--evidence",
  neutral: "ss-badge--neutral",
};

export default function StatusBadge({
  children,
  icon,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  icon?: SupplementScoutIconName;
  tone?: StatusBadgeTone;
  className?: string;
}) {
  return (
    <span className={`ss-badge ${toneClassNames[tone]} ${className}`.trim()}>
      {icon && <SupplementScoutIcon name={icon} size={16} />}
      <span>{children}</span>
    </span>
  );
}
