import { createServerFn } from "@tanstack/react-start";
import { getDb, queryAll } from "../db";
import { coverageLabel } from "../utils";

export const getTimeline = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { vendorId: number } }) => {
    await getDb();
    const { vendorId } = data;
    const events: Array<{ id: string; type: string; title: string; description: string; timestamp: string }> = [];

    const vendor = queryAll<{ created_at: string; updated_at: string }>(
      "SELECT created_at, updated_at FROM vendors WHERE id = ?", [vendorId]
    );
    if (vendor.length > 0) {
      events.push({ id: `vendor-created-${vendorId}`, type: "vendor_created", title: "Vendor created", description: "Vendor record was created", timestamp: vendor[0].created_at });
      if (vendor[0].updated_at !== vendor[0].created_at) {
        events.push({ id: `vendor-updated-${vendorId}`, type: "vendor_updated", title: "Vendor updated", description: "Vendor details were modified", timestamp: vendor[0].updated_at });
      }
    }

    const certs = queryAll<{ id: number; file_name: string; created_at: string; status: string }>(
      "SELECT id, file_name, created_at, status FROM certificates WHERE vendor_id = ? ORDER BY created_at DESC", [vendorId]
    );
    for (const c of certs) {
      events.push({ id: `cert-upload-${c.id}`, type: "certificate_uploaded", title: "Certificate uploaded", description: `${c.file_name || "COI"} was uploaded`, timestamp: c.created_at });
    }

    const checks = queryAll<{ id: number; coverage_type: string; is_compliant: number; explanation: string; created_at: string }>(
      "SELECT id, coverage_type, is_compliant, explanation, created_at FROM compliance_checks WHERE vendor_id = ? ORDER BY created_at DESC", [vendorId]
    );
    for (const ch of checks) {
      events.push({
        id: `check-${ch.id}`, type: ch.is_compliant ? "compliance_pass" : "compliance_fail",
        title: ch.is_compliant ? "Compliance check passed" : "Compliance gap found",
        description: ch.explanation || `${ch.coverage_type}: ${ch.is_compliant ? "Compliant" : "Non-compliant"}`,
        timestamp: ch.created_at,
      });
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events;
  }
);

export const getCoverageStatus = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { vendorId: number } }) => {
    await getDb();
    const { vendorId } = data;

    const requirements = queryAll<{ id: number; coverage_type: string; required_amount: number | null; is_required: number; description: string }>(
      "SELECT * FROM coverage_requirements ORDER BY coverage_type"
    );

    const latestCert = queryAll<{ id: number }>(
      "SELECT id FROM certificates WHERE vendor_id = ? AND status != 'rejected' ORDER BY created_at DESC LIMIT 1", [vendorId]
    );

    return requirements.map((req) => {
      const row: any = {
        coverage_type: req.coverage_type, label: coverageLabel(req.coverage_type),
        required_limit: req.required_amount, is_required: !!req.is_required,
        actual_limit: null, compliant: null, gap: null, certificate_id: null,
      };

      if (latestCert.length > 0) {
        const cov = queryAll<{ coverage_limit: number; certificate_id: number }>(
          "SELECT coverage_limit, certificate_id FROM certificate_coverages WHERE certificate_id = ? AND coverage_type = ? ORDER BY coverage_limit DESC LIMIT 1",
          [latestCert[0].id, req.coverage_type]
        );
        if (cov.length > 0) {
          row.actual_limit = cov[0].coverage_limit;
          row.certificate_id = cov[0].certificate_id;
          if (req.is_required) {
            if (req.required_amount != null && cov[0].coverage_limit != null) {
              row.compliant = cov[0].coverage_limit >= req.required_amount;
              if (!row.compliant) {
                row.gap = `${coverageLabel(req.coverage_type)} limit $${(cov[0].coverage_limit || 0).toLocaleString()} is below required $${(req.required_amount || 0).toLocaleString()}`;
              }
            } else {
              row.compliant = true;
            }
          }
        } else if (req.is_required) {
          row.compliant = false;
          row.gap = `${coverageLabel(req.coverage_type)} is required but not present on certificate`;
        }
      } else if (req.is_required) {
        row.compliant = false;
        row.gap = "No certificates uploaded";
      }

      return row;
    });
  }
);

export const getCertificates = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { vendorId: number } }) => {
    await getDb();
    return queryAll(
      "SELECT id, file_name, policy_number, carrier_name, effective_date, expiration_date, status, created_at, updated_at FROM certificates WHERE vendor_id = ? ORDER BY created_at DESC",
      [data.vendorId]
    );
  }
);
