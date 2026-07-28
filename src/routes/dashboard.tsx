import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb, queryOne, queryAll } from "../lib/db";
import { useState } from "react";
import { AlertCircle, RefreshCw, Plus, TrendingUp, Users, ShieldCheck, Clock, AlertTriangle, FileX } from "lucide-react";

// ──── Server functions ────

const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();

  const totalVendors =
    queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM vendors WHERE status = 'active'"
    )?.c || 0;

  // Active COIs = certificates that haven't expired yet (any status)
  const activeCerts =
    queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM certificates WHERE expiration_date > date('now') AND status != 'rejected'"
    )?.c || 0;

  const expiring30 =
    queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM certificates WHERE expiration_date BETWEEN date('now') AND date('now', '+30 days') AND status != 'rejected'"
    )?.c || 0;

  const expiring90 =
    queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM certificates WHERE expiration_date BETWEEN date('now') AND date('now', '+90 days') AND status != 'rejected'"
    )?.c || 0;

  const expired =
    queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM certificates WHERE expiration_date < date('now') AND status != 'rejected'"
    )?.c || 0;

  const highRisk =
    queryOne<{ c: number }>(
      "SELECT COUNT(DISTINCT cc.vendor_id) as c FROM compliance_checks cc JOIN certificates c ON cc.certificate_id = c.id WHERE cc.is_compliant = 0 AND c.expiration_date > date('now')"
    )?.c || 0;

  // Compliance trend: last 6 months
  const trend = queryAll<{ month: string; compliant: number; non_compliant: number }>(
    `SELECT 
      strftime('%Y-%m', cc.created_at) as month,
      SUM(CASE WHEN cc.is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
      SUM(CASE WHEN cc.is_compliant = 0 THEN 1 ELSE 0 END) as non_compliant
    FROM compliance_checks cc
    WHERE cc.created_at >= date('now', '-6 months')
    GROUP BY month
    ORDER BY month ASC`
  );

  return {
    totalVendors,
    activeCerts,
    expiring30,
    expiring90,
    expired,
    highRisk,
    trend,
  };
});

// ──── Route ────

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: () => getDashboardStats(),
  component: DashboardPage,
});

// ──── Component ────

function DashboardPage() {
  const stats = Route.useLoaderData();
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm flex-1">Something went wrong loading your dashboard.</p>
          <button
            onClick={() => setError(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (stats.totalVendors === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-6">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to SureComply</h2>
          <p className="text-zinc-400 max-w-md mx-auto mb-8">
            Start tracking vendor insurance compliance by adding your first vendor.
          </p>
          <Link
            to="/vendors"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Your First Vendor
          </Link>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Active Vendors", value: stats.totalVendors, color: "text-blue-400", bg: "bg-blue-500/10", icon: Users, filter: "all" },
    { label: "Active COIs", value: stats.activeCerts, color: "text-emerald-400", bg: "bg-emerald-500/10", icon: ShieldCheck, filter: "compliant" },
    { label: "Expiring in 30 days", value: stats.expiring30, color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock, filter: "expiring_30" },
    { label: "Expiring in 90 days", value: stats.expiring90, color: "text-amber-300", bg: "bg-amber-500/10", icon: Clock, filter: "expiring_30" },
    { label: "Expired", value: stats.expired, color: "text-red-400", bg: "bg-red-500/10", icon: FileX, filter: "expired" },
    { label: "High Risk", value: stats.highRisk, color: "text-rose-400", bg: "bg-rose-500/10", icon: AlertTriangle, filter: "non_compliant" },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">Compliance overview at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/vendors"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Vendor
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <a
            key={card.label}
            href={`/vendors?filter=${card.filter}`}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 transition-colors group block"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-sm text-zinc-500 mt-1">{card.label}</div>
              </div>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Compliance trend */}
      {stats.trend.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">Compliance Trend</h2>
            <span className="text-xs text-zinc-500">Last 6 months</span>
          </div>
          <div className="space-y-1">
            {stats.trend.map((m) => {
              const total = m.compliant + m.non_compliant || 1;
              const compliantPct = Math.round((m.compliant / total) * 100);
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 w-16 flex-shrink-0">
                    {formatMonth(m.month)}
                  </span>
                  <div className="flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${compliantPct}%` }}
                    />
                    <div
                      className="bg-zinc-600 h-full transition-all"
                      style={{ width: `${100 - compliantPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 w-10 text-right flex-shrink-0">
                    {compliantPct}%
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-xs text-zinc-500">Compliant</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-zinc-600" />
              <span className="text-xs text-zinc-500">Non-Compliant</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
