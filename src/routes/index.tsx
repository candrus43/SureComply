import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb, queryOne } from "../lib/db";

const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const totalVendors = queryOne<{c:number}>("SELECT COUNT(*) as c FROM vendors WHERE status = 'active'")?.c || 0;
  const activeCerts = queryOne<{c:number}>("SELECT COUNT(*) as c FROM certificates WHERE status = 'reviewed' AND expiration_date > date('now')")?.c || 0;
  const expired = queryOne<{c:number}>("SELECT COUNT(*) as c FROM certificates WHERE expiration_date < date('now') AND status != 'rejected'")?.c || 0;
  const highRisk = queryOne<{c:number}>(
    "SELECT COUNT(DISTINCT cc.vendor_id) as c FROM compliance_checks cc JOIN certificates c ON cc.certificate_id = c.id WHERE cc.is_compliant = 0 AND c.expiration_date > date('now')"
  )?.c || 0;
  return { totalVendors, activeCerts, expired, highRisk };
});

export const Route = createFileRoute("/")({
  loader: () => getDashboardStats(),
  component: Home,
});

function Home() {
  const stats = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <ShieldIcon />
            <span className="font-semibold text-lg">SureComply</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign in</a>
            <a href="/signup" className="text-sm px-4 py-2 rounded-lg bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors">Get Started</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-24 pb-16 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
          Vendor Insurance<br/><span className="text-emerald-400">Compliance Made Effortless</span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10">
          Upload COIs, auto-extract data, track compliance, and never miss an expiration — all from one beautiful dashboard.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="/signup" className="px-6 py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors">Start Free Trial →</a>
          <a href="/login" className="px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors">Sign In</a>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Vendors", value: stats.totalVendors, color: "text-blue-400" },
            { label: "Active COIs", value: stats.activeCerts, color: "text-emerald-400" },
            { label: "Expired", value: stats.expired, color: "text-amber-400" },
            { label: "High Risk", value: stats.highRisk, color: "text-red-400" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-zinc-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard icon="📄" title="Smart Uploads" description="Drag and drop COIs. AI automatically extracts policy numbers, dates, coverage limits, and more." />
          <FeatureCard icon="✅" title="Instant Compliance" description="See which vendors meet your requirements at a glance. AI highlights gaps before they become problems." />
          <FeatureCard icon="🔔" title="Auto Reminders" description="Never chase a vendor again. Automated reminders go out before certificates expire." />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 text-center text-sm text-zinc-500">
        &copy; {new Date().getFullYear()} SureComply. All rights reserved.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-700 transition-colors">
      <div className="text-2xl mb-4">{icon}</div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-zinc-400">{description}</p>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
