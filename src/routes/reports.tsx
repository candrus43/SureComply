import { createFileRoute, redirect } from "@tanstack/react-router";
import { FileText, BarChart3, TrendingUp, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/reports")({
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-zinc-400 text-sm mt-1">Generate and download compliance reports</p>
      </div>

      {/* Coming soon */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-800 mb-6">
          <BarChart3 className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Reports Coming Soon</h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          Detailed compliance reports, expired vendor summaries, upcoming renewal forecasts, and executive summaries will be available in the next update.
        </p>
      </div>

      {/* Preview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: "Compliance Report", desc: "Full compliance status across all vendors", icon: FileText },
          { title: "Expired Vendors", desc: "Vendors with expired or missing coverage", icon: CalendarDays },
          { title: "Upcoming Renewals", desc: "Certificates expiring in your selected range", icon: TrendingUp },
          { title: "Executive Summary", desc: "One-page overview for leadership", icon: BarChart3 },
        ].map((r) => (
          <div key={r.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 opacity-50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-zinc-800">
                <r.icon className="w-5 h-5 text-zinc-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{r.title}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{r.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
