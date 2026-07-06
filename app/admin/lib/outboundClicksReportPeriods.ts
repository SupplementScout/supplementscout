export const OUTBOUND_CLICK_REPORT_PERIODS = ["7d", "30d", "all"] as const;

export type OutboundClickReportPeriod =
  (typeof OUTBOUND_CLICK_REPORT_PERIODS)[number];

export function normalizeOutboundClickReportPeriod(
  value: string | string[] | undefined
): OutboundClickReportPeriod {
  const period = Array.isArray(value) ? value[0] : value;

  return OUTBOUND_CLICK_REPORT_PERIODS.includes(
    period as OutboundClickReportPeriod
  )
    ? (period as OutboundClickReportPeriod)
    : "30d";
}
