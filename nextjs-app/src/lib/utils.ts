export function cn(...inputs: (string | undefined | false | null)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export const COVERAGE_TYPES = [
  { value: "general_liability", label: "General Liability" },
  { value: "workers_comp", label: "Workers Compensation" },
  { value: "auto_liability", label: "Auto Liability" },
  { value: "umbrella_excess", label: "Umbrella / Excess" },
  { value: "professional_liability", label: "Professional Liability" },
  { value: "pollution_liability", label: "Pollution Liability" },
  { value: "builders_risk", label: "Builders Risk" },
  { value: "cyber_liability", label: "Cyber Liability" },
];

export function coverageLabel(type: string): string {
  return COVERAGE_TYPES.find(c => c.value === type)?.label || type;
}

export function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    compliant: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    non_compliant: "bg-red-500/10 text-red-400 border-red-500/20",
    expired: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    pending_review: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    reviewed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    queued: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return colors[status] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_review: "Pending Review", reviewed: "Reviewed", expired: "Expired",
    compliant: "Compliant", non_compliant: "Non-Compliant", active: "Active",
    archived: "Archived", queued: "Queued", ready: "Ready", failed: "Failed",
  };
  return labels[status] || status;
}
