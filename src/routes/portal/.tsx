import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  FileX,
  Upload,
  Loader2,
  CheckCircle,
  FileText,
  Clock,
  Building2,
} from "lucide-react";

// ──── Route ────

export const Route = createFileRoute("/portal/$token")({
  loader: async ({ params }) => {
    const { token } = params as { token: string };
    const resp = await fetch(`/api/portal/${token}`);
    if (!resp.ok) {
      const err = await resp.json();
      return { error: err.error || "This link is invalid or has expired." };
    }
    const data = await resp.json();
    return { ...data, token };
  },
  component: PortalPage,
});

// ──── Component ────

function PortalPage() {
  const data = Route.useLoaderData();

  if ("error" in data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mb-6">
            <FileX className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Link Unavailable</h1>
          <p className="text-zinc-500">{data.error}</p>
        </div>
      </div>
    );
  }

  const { vendor, requirements, overallStatus, certificates, token, tokenExpiresAt } = data;
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<{
    status: "idle" | "uploading" | "complete" | "error";
    message?: string;
    fileName?: string;
  }>({ status: "idle" });
  const [certs, setCerts] = useState(certificates || []);

  const statusConfig = {
    Compliant: {
      icon: ShieldCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      label: "Compliant",
    },
    "Action Needed": {
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      label: "Action Needed",
    },
    Expired: {
      icon: FileX,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      label: "Expired",
    },
  };

  const config = statusConfig[overallStatus as keyof typeof statusConfig] || statusConfig["Action Needed"];
  const StatusIcon = config.icon;

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadState({ status: "uploading", fileName: file.name });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);

      try {
        const resp = await fetch("/api/portal/upload", {
          method: "POST",
          body: formData,
        });
        if (resp.ok) {
          const result = await resp.json();
          setUploadState({ status: "complete", message: result.message });
          // Refresh certs list
          setCerts((prev: any[]) => [
            {
              id: result.certificateId,
              file_name: file.name,
              status: "pending_review",
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
          // Reset after 3s
          setTimeout(() => setUploadState({ status: "idle" }), 3000);
        } else {
          const err = await resp.json();
          setUploadState({ status: "error", message: err.error || "Upload failed" });
        }
      } catch {
        setUploadState({ status: "error", message: "Network error" });
      }

      // Reset file input
      if (uploadRef.current) uploadRef.current.value = "";
    },
    [token]
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[640px] mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">{vendor.company_name}</h1>
              <p className="text-sm text-zinc-500">Insurance Compliance Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${config.bg} ${config.color} ${config.border}`}
            >
              <StatusIcon className="w-4 h-4" />
              {config.label}
            </span>
            {tokenExpiresAt && (
              <span className="text-xs text-zinc-400">
                Link expires {new Date(tokenExpiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[640px] mx-auto px-6 py-8 space-y-8">
        {/* Requirements Panel */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-500" />
            Coverage Requirements
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            {requirements.map((req: any) => {
              const statusIcon =
                req.status === "compliant" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : req.status === "non_compliant" || req.status === "not_provided" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                ) : null;

              const statusText =
                req.status === "compliant"
                  ? "Compliant"
                  : req.status === "non_compliant"
                  ? "Non-Compliant"
                  : req.status === "not_provided"
                  ? "Not Provided"
                  : "Not Required";

              const statusColor =
                req.status === "compliant"
                  ? "text-emerald-600"
                  : req.status === "non_compliant" || req.status === "not_provided"
                  ? "text-amber-600"
                  : "text-zinc-400";

              return (
                <div key={req.coverage_type} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{req.label}</p>
                    {req.is_required && req.required_limit && (
                      <p className="text-xs text-zinc-500">
                        Required: ${req.required_limit.toLocaleString()}
                      </p>
                    )}
                    {req.gap && <p className="text-xs text-red-500 mt-0.5">{req.gap}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {req.actual_limit && (
                      <span className="text-xs text-zinc-500">
                        ${req.actual_limit.toLocaleString()}
                      </span>
                    )}
                    <span className={`text-xs font-medium ${statusColor} flex items-center gap-1`}>
                      {statusIcon}
                      {statusText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Upload Panel */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4 text-zinc-500" />
            Upload New Certificate
          </h2>
          <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors">
            <input
              ref={uploadRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleUpload}
            />
            {uploadState.status === "idle" && (
              <button
                onClick={() => uploadRef.current?.click()}
                className="flex flex-col items-center gap-2 w-full"
              >
                <div className="p-3 rounded-xl bg-zinc-100">
                  <Upload className="w-5 h-5 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-600">
                  <span className="text-zinc-900 font-medium">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-zinc-400">PDF, PNG, JPG, WebP — up to 25 MB</p>
              </button>
            )}
            {uploadState.status === "uploading" && (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                <p className="text-sm text-zinc-600">Uploading {uploadState.fileName}...</p>
              </div>
            )}
            {uploadState.status === "complete" && (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <p className="text-sm text-emerald-600 font-medium">Uploaded successfully!</p>
                <p className="text-xs text-zinc-400">{uploadState.message}</p>
              </div>
            )}
            {uploadState.status === "error" && (
              <div className="flex flex-col items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-500">{uploadState.message}</p>
                <button
                  onClick={() => {
                    setUploadState({ status: "idle" });
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-500 font-medium"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </section>

        {/* History Panel */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500" />
            Certificate History
          </h2>
          {certs.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
              <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No certificates uploaded yet</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left text-xs font-medium text-zinc-500 px-4 py-3">File</th>
                    <th className="text-left text-xs font-medium text-zinc-500 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-zinc-500 px-4 py-3">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((cert: any) => (
                    <tr key={cert.id} className="border-b border-zinc-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="text-sm text-zinc-900">{cert.file_name || "COI"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          cert.status === "reviewed" || cert.status === "active"
                            ? "bg-emerald-50 text-emerald-600"
                            : cert.status === "expired"
                            ? "bg-red-50 text-red-600"
                            : "bg-zinc-100 text-zinc-600"
                        }`}>
                          {cert.status === "pending_review" ? "Pending Review" : cert.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500">
                        {cert.created_at ? new Date(cert.created_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
