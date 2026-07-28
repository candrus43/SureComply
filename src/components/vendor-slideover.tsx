import { useState, useEffect, useCallback } from "react";
import { X, Building2 } from "lucide-react";

export interface VendorFormData {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  vendor_type: string;
  notes: string;
  insurance_agent_name: string;
  insurance_agent_email: string;
  insurance_agent_phone: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: VendorFormData) => Promise<void>;
  initialData?: Partial<VendorFormData>;
  title?: string;
}

const VENDOR_TYPES = ["Contractor", "Supplier", "Service Provider", "Consultant", "Other"];

export function VendorSlideover({ open, onClose, onSubmit, initialData, title }: Props) {
  const [form, setForm] = useState<VendorFormData>(getEmptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && initialData) {
      setForm({ ...getEmptyForm(), ...initialData });
    } else if (open) {
      setForm(getEmptyForm());
    }
    if (open) {
      setErrors({});
      setDirty(false);
    }
  }, [open, initialData]);

  const handleClose = useCallback(() => {
    if (dirty) {
      if (!confirm("You have unsaved changes. Close without saving?")) return;
    }
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.company_name.trim()) e.company_name = "Company name is required";
    if (!form.contact_name.trim()) e.contact_name = "Contact name is required";
    if (!form.contact_email.trim()) e.contact_email = "Contact email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email))
      e.contact_email = "Invalid email format";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.state.trim() || form.state.length !== 2) e.state = "2-letter state required";
    if (!form.zip.trim()) e.zip = "ZIP code is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
      setDirty(false);
      onClose();
    } catch (err: any) {
      setErrors({ submit: err.message || "Failed to save" });
    } finally {
      setSubmitting(false);
    }
  };

  const update = (key: keyof VendorFormData, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setDirty(true);
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={handleClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-zinc-900 border-l border-zinc-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{title || "Add Vendor"}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Company Info */}
          <fieldset>
            <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Company Info</legend>
            <div className="space-y-3">
              <InputField label="Company Name" required value={form.company_name} onChange={(v) => update("company_name", v)} error={errors.company_name} />
              <SelectField label="Vendor Type" value={form.vendor_type} onChange={(v) => update("vendor_type", v)} options={VENDOR_TYPES} />
            </div>
          </fieldset>

          {/* Contact Info */}
          <fieldset>
            <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Contact</legend>
            <div className="space-y-3">
              <InputField label="Contact Name" required value={form.contact_name} onChange={(v) => update("contact_name", v)} error={errors.contact_name} />
              <InputField label="Contact Email" required type="email" value={form.contact_email} onChange={(v) => update("contact_email", v)} error={errors.contact_email} />
              <InputField label="Contact Phone" value={form.contact_phone} onChange={(v) => update("contact_phone", v)} />
            </div>
          </fieldset>

          {/* Address */}
          <fieldset>
            <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Address</legend>
            <div className="space-y-3">
              <InputField label="Street" value={form.address_line1} onChange={(v) => update("address_line1", v)} />
              <InputField label="Apt / Suite" value={form.address_line2} onChange={(v) => update("address_line2", v)} />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <InputField label="City" required value={form.city} onChange={(v) => update("city", v)} error={errors.city} />
                </div>
                <div>
                  <InputField label="State" required value={form.state} onChange={(v) => update("state", v)} error={errors.state} maxLength={2} />
                </div>
                <div>
                  <InputField label="ZIP" required value={form.zip} onChange={(v) => update("zip", v)} error={errors.zip} />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Notes */}
          <fieldset>
            <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Notes</legend>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-colors"
            />
          </fieldset>

          {errors.submit && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{errors.submit}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-colors"
          >
            {submitting ? "Saving..." : initialData ? "Save Changes" : "Add Vendor"}
          </button>
        </div>
      </div>
    </>
  );
}

function InputField({
  label, required, value, onChange, error, type, maxLength,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className={`w-full px-3 py-2 bg-zinc-800 border rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors ${
          error ? "border-red-500/50" : "border-zinc-700"
        }`}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function getEmptyForm(): VendorFormData {
  return {
    company_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
    vendor_type: "Contractor",
    notes: "",
    insurance_agent_name: "",
    insurance_agent_email: "",
    insurance_agent_phone: "",
  };
}
