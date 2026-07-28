import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb, queryOne, queryAll, execute, saveDb } from "../../../lib/db";
import { useState } from "react";
import {
  ArrowLeft, FileText, Download, Loader2, CheckCircle, AlertCircle,
  RefreshCw, Save, Plus, Trash2, ExternalLink
} from "lucide-react";
import { COVERAGE_TYPES, coverageLabel, formatDate, formatCurrency, statusBadge, statusLabel } from "../../../lib/utils";
import { extractFromFile } from "../../../lib/extraction";
import { runComplianceCheck } from "../../../lib/compliance";

// ──── Server functions ────

const getCertificateDetail = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { certId: number } }) => {
    await getDb();
    const cert = queryOne("SELECT * FROM certificates WHERE id = ?", [data.certId]);
    const coverages = queryAll("SELECT * FROM certificate_coverages WHERE certificate_id = ?", [data.certId]);
    const checks = queryAll("SELECT * FROM compliance_checks WHERE certificate_id = ?", [data.certId]);
    return { cert, coverages, checks };
  }
);

const saveCertificate = createServerFn({ method: "PATCH" }).handler(
  async ({ data }: { data: { certId: number } & Record<string, any> }) => {
    const d = data;
    execute(
      `UPDATE certificates SET carrier_name = ?, policy_number = ?, effective_date = ?,
       expiration_date = ?, named_insured = ?, additional_insured = ?,
       certificate_holder = ?, producer_name = ?, producer_contact = ?,
       status = 'reviewed', updated_at = datetime('now') WHERE id = ?`,
      [d.carrier_name ?? null, d.policy_number ?? null, d.effective_date ?? null,
       d.expiration_date ?? null, d.named_insured ?? null, d.additional_insured ?? null,
       d.certificate_holder ?? null, d.producer_name ?? null, d.producer_contact ?? null,
       d.certId]
    );
    if (d.coverages && Array.isArray(d.coverages)) {
      execute("DELETE FROM certificate_coverages WHERE certificate_id = ?", [d.certId]);
      for (const cov of d.coverages) {
        if (cov.coverage_type) {
          execute("INSERT INTO certificate_coverages (certificate_id, coverage_type, coverage_limit) VALUES (?, ?, ?)",
            [d.certId, cov.coverage_type, cov.coverage_limit ?? null]);
        }
      }
    }
    saveDb();
    await runComplianceCheck(d.certId);
    return queryOne("SELECT * FROM certificates WHERE id = ?", [d.certId]);
  }
);

// ──── Route ────

export const Route = createFileRoute("/vendors/$vendorId/certificates/$certId")({
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: async ({ params }) => {
    const data = await getCertificateDetail({ data: { certId: parseInt(params.certId) } });
    if (!data.cert) throw new Error("Certificate not found");
    return data;
  },
  component: CertificateReviewPage,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-center">
        <h2 className="text-lg font-semibold text-white mb-2">Certificate not found</h2>
        <p className="text-zinc-400 text-sm mb-4">{error?.message}</p>
        <a href="/vendors" className="text-emerald-400 hover:text-emerald-300 text-sm">← Back to vendors</a>
      </div>
    </div>
  ),
});

// ──── Component ────

function CertificateReviewPage() {
  const { cert: initialCert, coverages: initialCoverages, checks } = Route.useLoaderData();
  const params = Route.useParams();

  const [cert, setCert] = useState(initialCert);
  const [coverages, setCoverages] = useState(initialCoverages || []);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    setExtracting(true);
    setError(null);
    try {
      const result = await extractFromFile(cert.file_path);

      // Update local state
      setCert((prev: any) => ({
        ...prev,
        carrier_name: result.carrier_name,
        policy_number: result.policy_number,
        effective_date: result.effective_date,
        expiration_date: result.expiration_date,
        named_insured: result.named_insured,
        additional_insured: result.additional_insured ? "Yes" : null,
        certificate_holder: result.certificate_holder,
        producer_name: result.producer_name,
        producer_contact: result.producer_contact,
      }));

      setCoverages(
        result.coverages.map((c: any) => ({
          coverage_type: c.type,
          coverage_limit: c.limit,
        }))
      );
    } catch (err: any) {
      setError(err.message || "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveCertificate({
        data: {
          certId: cert.id,
          carrier_name: cert.carrier_name,
          policy_number: cert.policy_number,
          effective_date: cert.effective_date,
          expiration_date: cert.expiration_date,
          named_insured: cert.named_insured,
          additional_insured: cert.additional_insured,
          certificate_holder: cert.certificate_holder,
          producer_name: cert.producer_name,
          producer_contact: cert.producer_contact,
          coverages,
        },
      });
      setCert(updated);
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string | null) => {
    setCert((prev: any) => ({ ...prev, [field]: value }));
  };

  const addCoverage = () => {
    setCoverages((prev: any[]) => [...prev, { coverage_type: "general_liability", coverage_limit: null }]);
  };

  const removeCoverage = (idx: number) => {
    setCoverages((prev: any[]) => prev.filter((_, i) => i !== idx));
  };

  const updateCoverage = (idx: number, field: string, value: any) => {
    setCoverages((prev: any[]) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  const extractionStatus = extracting ? "Extracting..." : cert.status === "reviewed" ? "Ready for Review" : cert.status === "failed" ? "Failed" : "Pending";

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <a
            href={`/vendors/${params.vendorId}`}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">
              {cert.file_name || "Certificate"}
            </h1>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
            extracting ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
            cert.status === "reviewed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
          }`}>
            {extracting && <Loader2 className="w-3 h-3 animate-spin" />}
            {extractionStatus}
          </span>
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="px-3 py-1.5 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:text-white hover:border-zinc-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${extracting ? "animate-spin" : ""}`} /> Re-extract
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save & Review"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Document preview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400" /> Document
          </h3>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-16 h-16 text-zinc-600 mb-4" />
            <p className="text-white font-medium mb-1">{cert.file_name || "Certificate"}</p>
            <p className="text-xs text-zinc-500 mb-4">
              {cert.carrier_name && `Carrier: ${cert.carrier_name}`}
              {cert.policy_number && ` • Policy: ${cert.policy_number}`}
            </p>
            <a
              href={`/api/files/${cert.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
              target="_blank"
            >
              <Download className="w-4 h-4" /> Download
            </a>
          </div>

          {/* Compliance checks summary */}
          {checks.length > 0 && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-3">Compliance Results</h4>
              <div className="space-y-2">
                {checks.map((ch: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {ch.is_compliant ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span className={ch.is_compliant ? "text-zinc-300" : "text-red-300"}>
                      {ch.explanation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Editable extracted fields */}
        <div className="space-y-6">
          {/* Certificate Info */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Certificate Info</h3>
            <EditableField label="Carrier" value={cert.carrier_name} onChange={(v) => updateField("carrier_name", v)} />
            <EditableField label="Policy Number" value={cert.policy_number} onChange={(v) => updateField("policy_number", v)} />
            <div className="grid grid-cols-2 gap-3">
              <EditableField label="Effective Date" value={cert.effective_date} onChange={(v) => updateField("effective_date", v)} type="date" />
              <EditableField label="Expiration Date" value={cert.expiration_date} onChange={(v) => updateField("expiration_date", v)} type="date" />
            </div>
          </div>

          {/* Insured Info */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Insured & Holder</h3>
            <EditableField label="Named Insured" value={cert.named_insured} onChange={(v) => updateField("named_insured", v)} />
            <EditableField label="Certificate Holder" value={cert.certificate_holder} onChange={(v) => updateField("certificate_holder", v)} />
            <EditableField label="Additional Insured" value={cert.additional_insured} onChange={(v) => updateField("additional_insured", v)} />
          </div>

          {/* Producer */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Producer</h3>
            <EditableField label="Producer Name" value={cert.producer_name} onChange={(v) => updateField("producer_name", v)} />
            <EditableField label="Producer Contact" value={cert.producer_contact} onChange={(v) => updateField("producer_contact", v)} />
          </div>

          {/* Coverages */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Coverages</h3>
              <button
                onClick={addCoverage}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Coverage
              </button>
            </div>
            {coverages.map((cov: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={cov.coverage_type}
                  onChange={(e) => updateCoverage(i, "coverage_type", e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  {COVERAGE_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={cov.coverage_limit || ""}
                  onChange={(e) => updateCoverage(i, "coverage_limit", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Limit"
                  className="w-32 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={() => removeCoverage(i)}
                  className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {coverages.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-2">No coverages extracted. Click "Add Coverage" or re-extract.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableField({
  label, value, onChange, type,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
      <input
        type={type || "text"}
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
      />
    </div>
  );
}
