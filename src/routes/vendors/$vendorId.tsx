import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb, queryOne, queryAll, execute, saveDb } from "../../lib/db";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, ShieldCheck, AlertTriangle,
  FileText, Clock, CheckCircle, XCircle, Upload, Send, Edit3,
  ChevronDown, Plus, Trash2, Eye, Bell, BellOff
} from "lucide-react";
import { VendorSlideover, type VendorFormData } from "../../components/vendor-slideover";
import { UploadZone } from "../../components/upload-zone";
import { formatDate, formatCurrency, coverageLabel, statusBadge, statusLabel } from "../../lib/utils";
import { getTimeline, getCoverageStatus, getCertificates } from "../../lib/server/vendor-data";

// ──── Server functions ────

const getVendorDetail = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { id: number } }) => {
    await getDb();
    const vendor = queryOne<any>("SELECT * FROM vendors WHERE id = ?", [data.id]);
    return vendor;
  }
);

// ──── Route ────

export const Route = createFileRoute("/vendors/$vendorId")({
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: async ({ params }) => {
    const vendor = await getVendorDetail({ data: { id: parseInt(params.vendorId) } });
    if (!vendor) throw new Error("Vendor not found");
    const [timeline, coverages, certificates] = await Promise.all([
      getTimeline({ data: { vendorId: vendor.id } }),
      getCoverageStatus({ data: { vendorId: vendor.id } }),
      getCertificates({ data: { vendorId: vendor.id } }),
    ]);
    return { vendor, timeline, coverages, certificates };
  },
  component: VendorDetailPage,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-center">
        <h2 className="text-lg font-semibold text-white mb-2">Vendor not found</h2>
        <p className="text-zinc-400 text-sm mb-4">{error?.message || "They may have been removed."}</p>
        <a href="/vendors" className="text-emerald-400 hover:text-emerald-300 text-sm">← Back to vendors</a>
      </div>
    </div>
  ),
});

// ──── Tabs ────

const TABS = ["Overview", "Coverages", "Documents", "Timeline"] as const;
type Tab = (typeof TABS)[number];

// ──── Inline edit field ────

function InlineField({
  label, value, onSave, type,
}: {
  label: string;
  value: string | null;
  onSave: (val: string) => Promise<void>;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setText(value || ""); }, [value]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(text); setEditing(false); } catch {} finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type={type || "text"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500/50"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
        />
        <button onClick={handleSave} disabled={saving} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group">
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm text-white">{value || "—"}</p>
      </div>
      <button onClick={() => setEditing(true)} className="p-1 rounded opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all">
        <Edit3 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ──── Component ────

function VendorDetailPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(data.vendor);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [showSlideover, setShowSlideover] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const getComplianceBadge = () => {
    const covs = data.coverages;
    if (!covs || covs.length === 0) return { color: "text-zinc-400", bg: "bg-zinc-500/10", label: "No Data", icon: Clock };
    const hasNonCompliant = covs.some((c: any) => c.compliant === false);
    if (hasNonCompliant) return { color: "text-amber-400", bg: "bg-amber-500/10", label: "Action Needed", icon: AlertTriangle };
    return { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Compliant", icon: ShieldCheck };
  };

  const badge = getComplianceBadge();

  const handleEdit = async (formData: VendorFormData) => {
    const { updateVendor } = await import("../../routes/api/-vendors");
    const updated = await updateVendor({ data: { id: vendor.id, ...formData } });
    setVendor(updated);
    refresh();
  };

  const handleInlineUpdate = async (field: string, value: string) => {
    const { updateVendor } = await import("../../routes/api/-vendors");
    const updated = await updateVendor({ data: { id: vendor.id, [field]: value } });
    setVendor(updated);
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <a href="/vendors" className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{vendor.company_name}</h1>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${badge.bg} ${badge.color}`}>
            <badge.icon className="w-3.5 h-3.5" /> {badge.label}
          </span>
          <button
            onClick={() => setShowSlideover(true)}
            className="px-3 py-1.5 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:text-white hover:border-zinc-600 transition-colors"
          >
            Edit
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === "Overview" && (
          <OverviewTab
            vendor={vendor}
            onInlineUpdate={handleInlineUpdate}
            reminderPaused={reminderPaused}
            reminderToggling={reminderToggling}
            reminderReason={reminderReason}
            setReminderReason={setReminderReason}
            onToggleReminders={handleToggleReminders}
          />
        )}

        {activeTab === "Coverages" && (
          <CoveragesTab coverages={data.coverages} />
        )}

        {activeTab === "Documents" && (
          <DocumentsTab
            vendorId={vendor.id}
            certificates={data.certificates}
            onUploadComplete={refresh}
          />
        )}

        {activeTab === "Timeline" && (
          <TimelineTab timeline={data.timeline} />
        )}
      </div>

      {/* Edit slide-over */}
      <VendorSlideover
        open={showSlideover}
        onClose={() => setShowSlideover(false)}
        onSubmit={handleEdit}
        initialData={vendor}
        title="Edit Vendor"
      />
    </div>
  );
}

// ──── Overview Tab ────

function OverviewTab({
  vendor,
  onInlineUpdate,
  reminderPaused,
  reminderToggling,
  reminderReason,
  setReminderReason,
  onToggleReminders,
}: {
  vendor: any;
  onInlineUpdate: (field: string, value: string) => Promise<void>;
  reminderPaused?: boolean;
  reminderToggling?: boolean;
  reminderReason?: string;
  setReminderReason?: (v: string) => void;
  onToggleReminders?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Company Info */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Building2 className="w-4 h-4 text-zinc-400" /> Company Info
        </h3>
        <InlineField label="Company Name" value={vendor.company_name} onSave={(v) => onInlineUpdate("company_name", v)} />
        <InlineField label="Vendor Type" value={vendor.vendor_type} onSave={(v) => onInlineUpdate("vendor_type", v)} />
        <div className="text-xs text-zinc-500">Address</div>
        <InlineField label="Street" value={vendor.address_line1} onSave={(v) => onInlineUpdate("address_line1", v)} />
        <div className="grid grid-cols-3 gap-2">
          <InlineField label="City" value={vendor.city} onSave={(v) => onInlineUpdate("city", v)} />
          <InlineField label="State" value={vendor.state} onSave={(v) => onInlineUpdate("state", v)} />
          <InlineField label="ZIP" value={vendor.zip} onSave={(v) => onInlineUpdate("zip", v)} />
        </div>
        <InlineField label="Notes" value={vendor.notes} onSave={(v) => onInlineUpdate("notes", v)} />
      </div>

      {/* Contact */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Mail className="w-4 h-4 text-zinc-400" /> Contact
        </h3>
        <InlineField label="Name" value={vendor.contact_name} onSave={(v) => onInlineUpdate("contact_name", v)} />
        <InlineField label="Email" value={vendor.contact_email} onSave={(v) => onInlineUpdate("contact_email", v)} />
        <InlineField label="Phone" value={vendor.contact_phone} onSave={(v) => onInlineUpdate("contact_phone", v)} />
      </div>

      {/* Insurance Agent */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-zinc-400" /> Insurance Agent
        </h3>
        <InlineField label="Agent Name" value={vendor.insurance_agent_name} onSave={(v) => onInlineUpdate("insurance_agent_name", v)} />
        <InlineField label="Agent Email" value={vendor.insurance_agent_email} onSave={(v) => onInlineUpdate("insurance_agent_email", v)} />
        <InlineField label="Agent Phone" value={vendor.insurance_agent_phone} onSave={(v) => onInlineUpdate("insurance_agent_phone", v)} />
      </div>

      {/* Status */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-400" /> Details
        </h3>
        <div className="flex justify-between">
          <span className="text-xs text-zinc-500">Status</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${statusBadge(vendor.status)}`}>
            {statusLabel(vendor.status)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-zinc-500">Created</span>
          <span className="text-xs text-zinc-400">{formatDate(vendor.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-zinc-500">Last Updated</span>
          <span className="text-xs text-zinc-400">{formatDate(vendor.updated_at)}</span>
        </div>
      </div>
      {/* Reminders */}
      {onToggleReminders !== undefined && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-zinc-400" /> Reminders
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">
              {reminderPaused ? "Paused" : "Active"}
            </span>
            <button
              onClick={onToggleReminders}
              disabled={reminderToggling}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                reminderPaused
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
              }`}
            >
              {reminderPaused ? (
                <><Bell className="w-3.5 h-3.5" /> Resume</>
              ) : (
                <><BellOff className="w-3.5 h-3.5" /> Pause</>
              )}
            </button>
          </div>
          {!reminderPaused && setReminderReason && (
            <div>
              <input
                type="text"
                value={reminderReason}
                onChange={(e) => setReminderReason(e.target.value)}
                placeholder="Optional reason for pausing..."
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          )}
          {vendor.reminders_paused_reason && reminderPaused && (
            <p className="text-xs text-zinc-500 mt-1">
              Reason: {vendor.reminders_paused_reason}
            </p>
          )}
          {vendor.reminders_paused_at && reminderPaused && (
            <p className="text-xs text-zinc-600">
              Paused: {formatDate(vendor.reminders_paused_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ──── Coverages Tab ────

function CoveragesTab({ coverages }: { coverages: any[] }) {
  if (!coverages || coverages.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
        <p>No coverage data available. Upload a certificate first.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Coverage Type</th>
            <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Required Limit</th>
            <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Actual Limit</th>
            <th className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {coverages.map((row: any, i: number) => (
            <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-3 text-sm text-white">{row.label}</td>
              <td className="px-4 py-3 text-sm text-zinc-400 text-right">
                {row.required_limit ? formatCurrency(row.required_limit) : "—"}
              </td>
              <td className="px-4 py-3 text-sm text-white text-right">
                {row.actual_limit ? formatCurrency(row.actual_limit) : "—"}
              </td>
              <td className="px-4 py-3 text-center">
                {row.compliant === true && (
                  <CheckCircle className="w-4 h-4 text-emerald-400 inline" />
                )}
                {row.compliant === false && (
                  <XCircle className="w-4 h-4 text-red-400 inline" />
                )}
                {row.compliant === null && (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Gaps */}
      {coverages.filter((c: any) => c.gap).length > 0 && (
        <div className="p-4 space-y-2">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase">Gaps Found</h4>
          {coverages.filter((c: any) => c.gap).map((c: any, i: number) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{c.gap}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──── Documents Tab ────

function DocumentsTab({
  vendorId,
  certificates,
  onUploadComplete,
}: {
  vendorId: number;
  certificates: any[];
  onUploadComplete: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <UploadZone vendorId={vendorId} onComplete={onUploadComplete} />

      {certificates.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <FileText className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
          <p>No certificates uploaded yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">File</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Policy #</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Carrier</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Expiration</th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert: any) => (
                <tr
                  key={cert.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                  onClick={() => navigate({ to: `/vendors/${vendorId}/certificates/${cert.id}` })}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-sm text-white truncate max-w-[200px]">{cert.file_name || "COI"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{cert.policy_number || "—"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{cert.carrier_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{formatDate(cert.expiration_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${statusBadge(cert.status)}`}>
                      {statusLabel(cert.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──── Timeline Tab ────

const timelineIcons: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  reminder_sent: { icon: Bell, color: "text-violet-400", bg: "bg-violet-500/10" },
  vendor_created: { icon: Clock, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  vendor_updated: { icon: Clock, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  certificate_uploaded: { icon: Upload, color: "text-blue-400", bg: "bg-blue-500/10" },
  compliance_pass: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  compliance_fail: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
};

function TimelineTab({ timeline }: { timeline: any[] }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <Clock className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
        <p>No events yet</p>
      </div>
    );
  }

  return (
    <div className="relative pl-8 space-y-0">
      {/* Timeline line */}
      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-zinc-800" />

      {timeline.map((event: any, i: number) => {
        const config = timelineIcons[event.type] || { icon: Clock, color: "text-zinc-400", bg: "bg-zinc-500/10" };
        const Icon = config.icon;
        return (
          <div key={event.id || i} className="relative pb-6 last:pb-0">
            <div className={`absolute left-[-23px] p-1 rounded-full ${config.bg} border-4 border-zinc-950`}>
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">{event.title}</h4>
              <p className="text-xs text-zinc-500 mt-0.5">{event.description}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{formatDate(event.timestamp)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
