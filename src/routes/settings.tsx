import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb, queryAll, execute, queryOne, saveDb } from "../lib/db";
import { useState, useEffect } from "react";
import {
  ShieldCheck, Bell, User, Plus, Trash2, Check, X, RotateCw,
  Clock, AlertTriangle, RefreshCw, ChevronDown,
} from "lucide-react";
import { coverageLabel, COVERAGE_TYPES, formatCurrency, formatDate } from "../lib/utils";
import { checkReminders, sendReminders } from "../lib/reminders";
import { runComplianceCheck } from "../lib/compliance";

// ──── Server functions ────

const getRequirements = createServerFn({ method: "GET" }).handler(async () => {
  await getDb();
  return queryAll("SELECT * FROM coverage_requirements ORDER BY coverage_type");
});

const createRequirement = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { coverage_type: string; required_amount: number | null; is_required: boolean; description: string } }) => {
    const d = data;
    const existing = queryOne<{ id: number }>(
      "SELECT id FROM coverage_requirements WHERE coverage_type = ?", [d.coverage_type]
    );
    if (existing) throw new Error("A requirement for this coverage type already exists");

    execute(
      `INSERT INTO coverage_requirements (user_id, coverage_type, required_amount, is_required, description)
       VALUES (1, ?, ?, ?, ?)`,
      [d.coverage_type, d.required_amount, d.is_required ? 1 : 0, d.description || null]
    );
    saveDb();
    return queryAll("SELECT * FROM coverage_requirements ORDER BY coverage_type");
  }
);

const updateRequirement = createServerFn({ method: "PATCH" }).handler(
  async ({ data }: { data: { id: number; coverage_type?: string; required_amount?: number | null; is_required?: boolean; description?: string } }) => {
    const d = data;
    execute(
      `UPDATE coverage_requirements SET
        coverage_type = COALESCE(?, coverage_type),
        required_amount = COALESCE(?, required_amount),
        is_required = COALESCE(?, is_required),
        description = COALESCE(?, description),
        updated_at = datetime('now')
       WHERE id = ?`,
      [d.coverage_type ?? null, d.required_amount ?? null, d.is_required !== undefined ? (d.is_required ? 1 : 0) : null, d.description ?? null, d.id]
    );
    saveDb();
    return queryAll("SELECT * FROM coverage_requirements ORDER BY coverage_type");
  }
);

const deleteRequirement = createServerFn({ method: "DELETE" }).handler(
  async ({ data }: { data: { id: number } }) => {
    execute("DELETE FROM coverage_requirements WHERE id = ?", [data.id]);
    saveDb();
    return queryAll("SELECT * FROM coverage_requirements ORDER BY coverage_type");
  }
);

const recheckAll = createServerFn({ method: "POST" }).handler(async () => {
  await getDb();
  const certs = queryAll<{ id: number }>("SELECT id FROM certificates WHERE status != 'rejected'");
  let count = 0;
  for (const c of certs) {
    await runComplianceCheck(c.id);
    count++;
  }
  return { count };
});

const getReminderConfigs = createServerFn({ method: "GET" }).handler(async () => {
  await getDb();
  return queryAll("SELECT * FROM reminder_configs WHERE user_id = 1 ORDER BY days_before_expiry");
});

const updateReminderConfigs = createServerFn({ method: "PUT" }).handler(
  async ({ data }: { data: { days: number[] } }) => {
    // Delete all existing configs, replace with new set
    execute("DELETE FROM reminder_configs WHERE user_id = 1");
    for (const days of data.days) {
      execute(
        "INSERT INTO reminder_configs (user_id, days_before_expiry, is_enabled) VALUES (1, ?, 1)",
        [days]
      );
    }
    saveDb();
    return queryAll("SELECT * FROM reminder_configs WHERE user_id = 1 ORDER BY days_before_expiry");
  }
);

const runReminderCheck = createServerFn({ method: "POST" }).handler(async () => {
  const count = await checkReminders();
  return { count };
});

const runReminderSend = createServerFn({ method: "POST" }).handler(async () => {
  const count = await sendReminders();
  return { count };
});

const getReminderStats = createServerFn({ method: "GET" }).handler(async () => {
  await getDb();
  const pending = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM reminders WHERE status = 'queued'")?.c || 0;
  const sentToday = queryOne<{ c: number }>(
    "SELECT COUNT(*) as c FROM reminders WHERE status = 'sent' AND date(sent_at) = date('now')"
  )?.c || 0;
  const failed = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM reminders WHERE status = 'failed'")?.c || 0;
  return { pending, sentToday, failed };
});

// ──── Route ────

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: async () => {
    const [requirements, reminderConfigs, reminderStats] = await Promise.all([
      getRequirements(),
      getReminderConfigs(),
      getReminderStats(),
    ]);
    return { requirements, reminderConfigs, reminderStats };
  },
  component: SettingsPage,
});

// ──── Component ────

type Tab = "requirements" | "reminders" | "account";

function SettingsPage() {
  const { requirements: initialReqs, reminderConfigs: initialConfigs, reminderStats: initialStats } = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("requirements");
  const [requirements, setRequirements] = useState(initialReqs);
  const [configs, setConfigs] = useState(initialConfigs);
  const [stats, setStats] = useState(initialStats);

  // Requirements state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newReq, setNewReq] = useState({ coverage_type: "", required_amount: "", is_required: true, description: "" });
  const [error, setError] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [recheckResult, setRecheckResult] = useState<string | null>(null);

  // Reminders state
  const [newDay, setNewDay] = useState("");
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // ──── Requirements handlers ────

  const handleEdit = (req: any) => {
    setEditingId(req.id);
    setEditValues({ ...req });
    setError(null);
  };

  const handleSave = async () => {
    try {
      const updated = await updateRequirement({
        data: {
          id: editingId!,
          coverage_type: editValues.coverage_type,
          required_amount: editValues.required_amount ? parseInt(editValues.required_amount) : null,
          is_required: editValues.is_required,
          description: editValues.description,
        },
      });
      setRequirements(updated);
      setEditingId(null);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    const updated = await deleteRequirement({ data: { id } });
    setRequirements(updated);
    setDeleteConfirm(null);
  };

  const handleAdd = async () => {
    if (!newReq.coverage_type) return;
    try {
      const updated = await createRequirement({
        data: {
          coverage_type: newReq.coverage_type,
          required_amount: newReq.required_amount ? parseInt(newReq.required_amount) : null,
          is_required: newReq.is_required,
          description: newReq.description || "",
        },
      });
      setRequirements(updated);
      setNewReq({ coverage_type: "", required_amount: "", is_required: true, description: "" });
      setAdding(false);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRecheck = async () => {
    setRechecking(true);
    setRecheckResult(null);
    try {
      const result = await recheckAll();
      setRecheckResult(`Rechecked ${result.count} certificates. Refresh the dashboard to see updated compliance.`);
    } catch (e: any) {
      setRecheckResult(`Error: ${e.message}`);
    }
    setRechecking(false);
  };

  // ──── Reminders handlers ────

  const handleAddDay = async () => {
    const day = parseInt(newDay);
    if (isNaN(day) || day < 0) return;
    const currentDays = configs.map((c: any) => c.days_before_expiry);
    if (currentDays.includes(day)) return;
    const newDays = [...currentDays, day].sort((a, b) => b - a);
    const updated = await updateReminderConfigs({ data: { days: newDays } });
    setConfigs(updated);
    setNewDay("");
  };

  const handleRemoveDay = async (day: number) => {
    const newDays = configs.map((c: any) => c.days_before_expiry).filter((d: number) => d !== day);
    const updated = await updateReminderConfigs({ data: { days: newDays } });
    setConfigs(updated);
  };

  const handleCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await runReminderCheck();
      setCheckResult(`Created ${result.count} new reminder(s).`);
    } catch (e: any) {
      setCheckResult(`Error: ${e.message}`);
    }
    setChecking(false);
  };

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const result = await runReminderSend();
      const s = await getReminderStats();
      setStats(s);
      setSendResult(`Sent ${result.count} reminder(s).`);
    } catch (e: any) {
      setSendResult(`Error: ${e.message}`);
    }
    setSending(false);
  };

  // ──── Render ────

  const tabs: { key: Tab; label: string; icon: typeof ShieldCheck }[] = [
    { key: "requirements", label: "Requirements", icon: ShieldCheck },
    { key: "reminders", label: "Reminders", icon: Bell },
    { key: "account", label: "Account", icon: User },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">Configure compliance requirements and reminders</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab: Requirements */}
      {tab === "requirements" && (
        <RequirementsTab
          requirements={requirements}
          editingId={editingId}
          editValues={editValues}
          setEditValues={setEditValues}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={() => { setEditingId(null); setError(null); }}
          onDelete={(id) => setDeleteConfirm(deleteConfirm === id ? null : id)}
          onConfirmDelete={handleDelete}
          deleteConfirm={deleteConfirm}
          adding={adding}
          setAdding={setAdding}
          newReq={newReq}
          setNewReq={setNewReq}
          onAdd={handleAdd}
          onRecheck={handleRecheck}
          rechecking={rechecking}
          recheckResult={recheckResult}
          error={error}
        />
      )}

      {/* Tab: Reminders */}
      {tab === "reminders" && (
        <RemindersTab
          configs={configs}
          stats={stats}
          newDay={newDay}
          setNewDay={setNewDay}
          onAddDay={handleAddDay}
          onRemoveDay={handleRemoveDay}
          onCheck={handleCheck}
          onSend={handleSend}
          checking={checking}
          sending={sending}
          checkResult={checkResult}
          sendResult={sendResult}
        />
      )}

      {/* Tab: Account placeholder */}
      {tab === "account" && (
        <div className="text-center py-12">
          <User className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-500">Account settings coming soon</p>
        </div>
      )}
    </div>
  );
}

// ──── Requirements Tab ────

function RequirementsTab({
  requirements, editingId, editValues, setEditValues, onEdit, onSave, onCancel,
  onDelete, deleteConfirm, onConfirmDelete,
  adding, setAdding, newReq, setNewReq, onAdd, onRecheck, rechecking, recheckResult, error,
}: {
  requirements: any[];
  editingId: number | null;
  editValues: Record<string, any>;
  setEditValues: (v: Record<string, any>) => void;
  onEdit: (r: any) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (id: number) => void;
  deleteConfirm: number | null;
  onConfirmDelete: (id: number) => void;
  adding: boolean;
  setAdding: (v: boolean) => void;
  newReq: any;
  setNewReq: (v: any) => void;
  onAdd: () => void;
  onRecheck: () => void;
  rechecking: boolean;
  recheckResult: string | null;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Bulk recheck */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          Define the minimum insurance coverage requirements for your vendors.
        </p>
        <button
          onClick={onRecheck}
          disabled={rechecking}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${rechecking ? "animate-spin" : ""}`} />
          {rechecking ? "Rechecking..." : "Recheck All Certificates"}
        </button>
      </div>
      {recheckResult && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
          {recheckResult}
        </div>
      )}

      {/* Requirements table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Coverage Type</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Minimum Limit</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Required</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Description</th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((req: any) => (
              <tr key={req.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                {editingId === req.id ? (
                  <>
                    <td className="px-4 py-3">
                      <select
                        value={editValues.coverage_type}
                        onChange={(e) => setEditValues({ ...editValues, coverage_type: e.target.value })}
                        className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500/50"
                      >
                        {COVERAGE_TYPES.map((ct) => (
                          <option key={ct.value} value={ct.value}>{ct.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={editValues.required_amount ?? ""}
                        onChange={(e) => setEditValues({ ...editValues, required_amount: e.target.value })}
                        className="w-32 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500/50"
                        placeholder="Limit"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditValues({ ...editValues, is_required: !editValues.is_required })}
                        className={`w-9 h-5 rounded-full transition-colors ${editValues.is_required ? "bg-emerald-500" : "bg-zinc-600"} relative`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${editValues.is_required ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={editValues.description || ""}
                        onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                        className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500/50"
                        placeholder="Description"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={onSave} className="p-1.5 rounded text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800" title="Save">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={onCancel} className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800" title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white">{coverageLabel(req.coverage_type)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-300">{formatCurrency(req.required_amount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${req.is_required ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"}`}>
                        {req.is_required ? "Required" : "Optional"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-400">{req.description || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onEdit(req)} className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {deleteConfirm === req.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => onConfirmDelete(req.id)} className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10" title="Confirm">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDelete(req.id)} className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800" title="Cancel">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => onDelete(req.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {/* Add row */}
            {adding ? (
              <tr className="border-b border-zinc-800/50 bg-zinc-800/20">
                <td className="px-4 py-3">
                  <select
                    value={newReq.coverage_type}
                    onChange={(e) => setNewReq({ ...newReq, coverage_type: e.target.value })}
                    className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="">Select type...</option>
                    {COVERAGE_TYPES.filter(ct => !requirements.some((r: any) => r.coverage_type === ct.value)).map((ct) => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={newReq.required_amount}
                    onChange={(e) => setNewReq({ ...newReq, required_amount: e.target.value })}
                    className="w-32 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500/50"
                    placeholder="Limit"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setNewReq({ ...newReq, is_required: !newReq.is_required })}
                    className={`w-9 h-5 rounded-full transition-colors ${newReq.is_required ? "bg-emerald-500" : "bg-zinc-600"} relative`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${newReq.is_required ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={newReq.description}
                    onChange={(e) => setNewReq({ ...newReq, description: e.target.value })}
                    className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500/50"
                    placeholder="Description"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={onAdd} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded transition-colors">Add</button>
                    <button onClick={() => setAdding(false)} className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-2">
                  <button
                    onClick={() => setAdding(true)}
                    className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Requirement
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──── Reminders Tab ────

function RemindersTab({
  configs, stats, newDay, setNewDay, onAddDay, onRemoveDay,
  onCheck, onSend, checking, sending, checkResult, sendResult,
}: {
  configs: any[];
  stats: { pending: number; sentToday: number; failed: number };
  newDay: string;
  setNewDay: (v: string) => void;
  onAddDay: () => void;
  onRemoveDay: (day: number) => void;
  onCheck: () => void;
  onSend: () => void;
  checking: boolean;
  sending: boolean;
  checkResult: string | null;
  sendResult: string | null;
}) {
  // Compute upcoming preview
  const today = new Date();
  const previewDates = configs.map((c: any) => {
    const d = new Date(today);
    d.setDate(d.getDate() + c.days_before_expiry);
    return { day: c.days_before_expiry, date: d.toISOString().split("T")[0] };
  });

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.pending}</div>
          <div className="text-sm text-zinc-500 mt-1">Pending</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-2xl font-bold text-emerald-400">{stats.sentToday}</div>
          <div className="text-sm text-zinc-500 mt-1">Sent Today</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
          <div className="text-sm text-zinc-500 mt-1">Failed</div>
        </div>
      </div>

      {/* Schedule configuration */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Reminder Schedule</h2>
        <p className="text-xs text-zinc-500 mb-4">Reminders will be sent this many days before a certificate expires.</p>

        {/* Current chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {configs.map((c: any) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 text-sm text-white border border-zinc-700"
            >
              {c.days_before_expiry === 0 ? "On expiry" : `${c.days_before_expiry} days`}
              <button
                onClick={() => onRemoveDay(c.days_before_expiry)}
                className="text-zinc-500 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          {configs.length === 0 && (
            <p className="text-sm text-zinc-500 italic">No reminder days configured</p>
          )}
        </div>

        {/* Add day */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={newDay}
            onChange={(e) => setNewDay(e.target.value)}
            placeholder="e.g. 45"
            className="w-24 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
            onKeyDown={(e) => { if (e.key === "Enter") onAddDay(); }}
          />
          <button
            onClick={onAddDay}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors border border-zinc-700"
          >
            Add Day
          </button>
        </div>

        {/* Live preview */}
        {previewDates.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
            <p className="text-xs text-zinc-500 mb-2">Next reminder check will target certificates expiring on:</p>
            <div className="flex flex-wrap gap-1.5">
              {previewDates.map((p) => (
                <span key={p.day} className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">
                  {p.day === 0 ? "Expired" : `${p.day}d`}: {formatDate(p.date)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual actions */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Manual Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onCheck}
            disabled={checking}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking..." : "Check for Reminders"}
          </button>
          <button
            onClick={onSend}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <Bell className="w-4 h-4" />
            {sending ? "Sending..." : "Send Pending Reminders"}
          </button>
        </div>
        {checkResult && (
          <p className="mt-3 text-sm text-blue-400">{checkResult}</p>
        )}
        {sendResult && (
          <p className="mt-3 text-sm text-emerald-400">{sendResult}</p>
        )}
      </div>
    </div>
  );
}
