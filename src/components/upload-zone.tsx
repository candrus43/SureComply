import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
  certificateId?: number;
  xhr?: XMLHttpRequest;
}

interface Props {
  vendorId: number;
  onComplete?: (certId: number) => void;
}

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];

export function UploadZone({ vendorId, onComplete }: Props) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (selected: FileList | File[]) => {
      const newFiles: UploadFile[] = [];
      for (const f of Array.from(selected)) {
        if (!ALLOWED_TYPES.includes(f.type)) {
          newFiles.push({
            id: crypto.randomUUID(),
            file: f,
            progress: 0,
            status: "error",
            error: `Unsupported file type: ${f.type || "unknown"}`,
          });
          continue;
        }
        if (f.size > MAX_SIZE) {
          newFiles.push({
            id: crypto.randomUUID(),
            file: f,
            progress: 0,
            status: "error",
            error: "File exceeds 25 MB limit",
          });
          continue;
        }
        newFiles.push({
          id: crypto.randomUUID(),
          file: f,
          progress: 0,
          status: "uploading",
        });
      }

      setFiles((prev) => [...prev, ...newFiles]);

      // Start uploads for valid files
      for (const nf of newFiles) {
        if (nf.status === "uploading") {
          startUpload(nf);
        }
      }
    },
    [vendorId]
  );

  const startUpload = (uf: UploadFile) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", uf.file);
    formData.append("vendor_id", String(vendorId));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setFiles((prev) =>
          prev.map((f) => (f.id === uf.id ? { ...f, progress: pct } : f))
        );
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const resp = JSON.parse(xhr.responseText);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uf.id
              ? { ...f, status: "complete" as const, progress: 100, certificateId: resp.certificateId }
              : f
          )
        );
        onComplete?.(resp.certificateId);
      } else {
        let errMsg = "Upload failed";
        try {
          errMsg = JSON.parse(xhr.responseText).error || errMsg;
        } catch {}
        setFiles((prev) =>
          prev.map((f) => (f.id === uf.id ? { ...f, status: "error" as const, error: errMsg } : f))
        );
      }
    };

    xhr.onerror = () => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uf.id
            ? { ...f, status: "error" as const, error: "Network error — please retry" }
            : f
        )
      );
    };

    xhr.open("POST", "/api/upload");
    xhr.send(formData);

    setFiles((prev) => prev.map((f) => (f.id === uf.id ? { ...f, xhr } : f)));
  };

  const cancelUpload = (uf: UploadFile) => {
    uf.xhr?.abort();
    setFiles((prev) => prev.filter((f) => f.id !== uf.id));
  };

  const removeFile = (uf: UploadFile) => {
    setFiles((prev) => prev.filter((f) => f.id !== uf.id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-zinc-700 hover:border-zinc-600 bg-zinc-900/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          <div className={`p-3 rounded-xl ${dragOver ? "bg-emerald-500/20" : "bg-zinc-800"}`}>
            <Upload className={`w-5 h-5 ${dragOver ? "text-emerald-400" : "text-zinc-500"}`} />
          </div>
          <p className="text-sm text-zinc-400">
            <span className="text-white font-medium">Drag COI here</span> or click to browse
          </p>
          <p className="text-xs text-zinc-600">PDF, PNG, JPG, WebP — up to 25 MB</p>
        </div>
      </div>

      {/* Progress cards */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uf) => (
            <div
              key={uf.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900"
            >
              <div className="flex-shrink-0">
                {uf.status === "uploading" && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                {uf.status === "complete" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {uf.status === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <p className="text-sm text-white truncate">{uf.file.name}</p>
                </div>
                {uf.status === "uploading" && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${uf.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500">{uf.progress}%</span>
                  </div>
                )}
                {uf.status === "error" && (
                  <p className="text-xs text-red-400 mt-0.5">{uf.error}</p>
                )}
              </div>
              {(uf.status === "uploading" || uf.status === "error") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    uf.status === "uploading" ? cancelUpload(uf) : removeFile(uf);
                  }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
