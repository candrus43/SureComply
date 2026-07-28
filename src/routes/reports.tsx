import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { FileText, CalendarDays, TrendingUp, Download, Loader2, RefreshCw } from "lucide-react";

// ──── Route ────

export const Route = createFileRoute("/reports")({
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  component: ReportsPage,
});

// ──── Types ────

interface ReportHistoryItem {
  id: number;
  report_type: string;
  format: string;
  file_name: string;
  created_at: string;
}

const reportTypes = [
  {
    key: "compliance",
    title: "Compliance Report",
    desc: "Full compliance breakdown per vendor and coverage type",
    icon: FileText,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    key: "expired",
    title: "Expired Vendors",
    desc: "All vendors with expired certificates",
    icon: CalendarDays,
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
  {
    key: "upcoming_renewals",
    title: "Upcoming Renewals",
    desc: "Certificates expiring in your selected date range",
    icon: TrendingUp,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

function ReportsPage() {
  const [selectedType, setSelectedType] = useState("compliance");
  const [format, setFormat] = useState("csv");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const resp = await fetch("/api/reports/list");
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data.reports || []);
      }
    } catch {
      // Ignore
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleGenerate() {
    if (selectedType === "upcoming_renewals" && (!startDate || !endDate)) {
      setError("Start and end dates are required for upcoming renewals");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const body: any = { report_type: selectedType, format };
      if (selectedType === "upcoming_renewals") {
        body.start_date = startDate;
        body.end_date = endDate;
      }

      const resp = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        await loadHistory();
        // Auto-download the generated report
        const data = await resp.json();
        if (data.report?.id) {
          window.open(`/api/reports/download?id=${data.report.id}`, "_blank");
        }
      } else {
        const err = await resp.json();
        setError(err.error || "Failed to generate report");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setGenerating(false);
    }
  }

  function reportTypeLabel(type: string): string {
    switch (type) {
      case "compliance": return "Compliance";
      case "expired": return "Expired";
      case "upcoming_renewals": return "Renewals";
      default: return type;
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-zinc-400 text-sm mt-1">Generate and download compliance reports</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <span className="text-sm flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs font-medium text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Report type cards */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">Select Report Type</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {reportTypes.map((rt) => (
            <button
              key={rt.key}
              onClick={() => setSelectedType(rt.key)}
              className={`rounded-xl border p-4 text-left transition-all ${
                selectedType === rt.key
                  ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <div className={`inline-flex p-2 rounded-lg ${rt.bg} mb-3`}>
                <rt.icon className={`w-5 h-5 ${rt.color}`} />
              </div>
              <h3 className="text-sm font-semibold text-white">{rt.title}</h3>
              <p className="text-xs text-zinc-500 mt-1">{rt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Format selector */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Format</label>
          <div className="flex gap-2">
            {["csv", "html"].map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  format === f
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Date range for upcoming renewals */}
        {selectedType === "upcoming_renewals" && (
          <>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-colors"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : (
            <><Download className="w-4 h-4" /> Generate</>
          )}
        </button>
      </div>

      {/* Report history */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Report History</h3>
          <button
            onClick={loadHistory}
            className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {historyLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-32" />
                <div className="h-4 bg-zinc-800 rounded w-16" />
                <div className="h-4 bg-zinc-800 rounded w-24" />
                <div className="h-4 bg-zinc-800 rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No reports generated yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-xs font-medium text-zinc-500 px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-zinc-500 px-4 py-3">Format</th>
                <th className="text-left text-xs font-medium text-zinc-500 px-4 py-3">Generated</th>
                <th className="text-right text-xs font-medium text-zinc-500 px-4 py-3">Download</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-sm text-white">{reportTypeLabel(r.report_type)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-zinc-400 uppercase">{r.format}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/reports/download?id=${r.id}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      <Download className="w-3 h-3" /> {r.file_name}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
