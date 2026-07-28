import { getDb, queryAll, queryOne, execute, saveDb } from "./db";
import { coverageLabel } from "./utils";
import * as fs from "fs";
import * as path from "path";

const REPORTS_DIR = "/home/team/shared/reports";

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

export interface ReportMeta {
  id: number;
  report_type: string;
  format: string;
  file_name: string;
  file_path: string;
  created_at: string;
}

// ──── Report generators ────

export async function generateComplianceReport(format: "csv" | "html"): Promise<ReportMeta> {
  await getDb();
  const rows = queryAll<any>(
    `SELECT v.id as vendor_id, v.company_name, v.contact_name, v.contact_email,
            cr.coverage_type, cr.required_amount, cr.is_required,
            (SELECT cc.coverage_limit FROM certificate_coverages cc
             JOIN certificates c ON cc.certificate_id = c.id
             WHERE c.vendor_id = v.id AND cc.coverage_type = cr.coverage_type AND c.status != 'rejected'
             ORDER BY c.created_at DESC LIMIT 1) as actual_limit,
            (SELECT cc.is_compliant FROM compliance_checks cc
             JOIN certificates c ON cc.certificate_id = c.id
             WHERE c.vendor_id = v.id AND cc.coverage_type = cr.coverage_type AND c.status != 'rejected'
             ORDER BY cc.created_at DESC LIMIT 1) as is_compliant
     FROM vendors v
     CROSS JOIN coverage_requirements cr
     WHERE v.status = 'active'
     ORDER BY v.company_name, cr.coverage_type`
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `compliance-report-${timestamp}.${format}`;
  const filePath = path.join(REPORTS_DIR, fileName);

  ensureReportsDir();

  if (format === "csv") {
    const header = "Vendor,Contact,Email,Coverage Type,Required Limit,Actual Limit,Status\n";
    const body = rows.map((r: any) => {
      const status = r.is_compliant === 1 ? "Compliant" : r.is_compliant === 0 ? "Non-Compliant" : r.is_required ? "Not Provided" : "Not Required";
      const reqLimit = r.required_amount ? `$${r.required_amount.toLocaleString()}` : "N/A";
      const actLimit = r.actual_limit ? `$${r.actual_limit.toLocaleString()}` : "N/A";
      return `"${r.company_name}","${r.contact_name || ""}","${r.contact_email || ""}","${coverageLabel(r.coverage_type)}","${reqLimit}","${actLimit}","${status}"`;
    }).join("\n");
    fs.writeFileSync(filePath, header + body);
  } else {
    // HTML
    const groups: Record<string, any[]> = {};
    for (const r of rows) {
      if (!groups[r.company_name]) groups[r.company_name] = [];
      groups[r.company_name].push(r);
    }
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Compliance Report</title>
<style>body{font-family:system-ui,sans-serif;background:#18181b;color:#fff;padding:2rem}
h1{font-size:1.5rem;margin-bottom:.5rem}h2{font-size:1.1rem;margin-top:1.5rem}
table{width:100%;border-collapse:collapse;margin-top:.5rem}
th,td{padding:.5rem .75rem;text-align:left;font-size:.875rem;border-bottom:1px solid #27272a}
th{color:#a1a1aa;font-weight:600}.compliant{color:#34d399}.non-compliant{color:#f87171}
.not-provided{color:#fbbf24}</style></head><body>
<h1>Compliance Report</h1><p>Generated: ${new Date().toLocaleDateString()}</p>`;
    for (const [company, items] of Object.entries(groups)) {
      html += `<h2>${company}</h2><table><tr><th>Coverage</th><th>Required</th><th>Actual</th><th>Status</th></tr>`;
      for (const r of items) {
        const status = r.is_compliant === 1 ? "Compliant" : r.is_compliant === 0 ? "Non-Compliant" : r.is_required ? "Not Provided" : "Not Required";
        const cls = r.is_compliant === 1 ? "compliant" : r.is_compliant === 0 ? "non-compliant" : "not-provided";
        html += `<tr><td>${coverageLabel(r.coverage_type)}</td><td>${r.required_amount ? "$" + r.required_amount.toLocaleString() : "N/A"}</td><td>${r.actual_limit ? "$" + r.actual_limit.toLocaleString() : "N/A"}</td><td class="${cls}">${status}</td></tr>`;
      }
      html += `</table>`;
    }
    html += `</body></html>`;
    fs.writeFileSync(filePath, html);
  }

  const meta = await saveReportMeta("compliance", format, fileName, filePath);
  return meta;
}

export async function generateExpiredReport(format: "csv" | "html"): Promise<ReportMeta> {
  await getDb();
  const rows = queryAll<any>(
    `SELECT v.id as vendor_id, v.company_name, v.contact_name, v.contact_email,
            c.file_name, c.policy_number, c.carrier_name, c.expiration_date, c.status
     FROM certificates c
     JOIN vendors v ON c.vendor_id = v.id
     WHERE c.expiration_date < date('now') AND c.status != 'rejected'
     ORDER BY v.company_name, c.expiration_date ASC`
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `expired-vendors-${timestamp}.${format}`;
  const filePath = path.join(REPORTS_DIR, fileName);

  ensureReportsDir();

  if (format === "csv") {
    const header = "Vendor,Contact,Email,File,Policy #,Carrier,Expiration Date,Status\n";
    const body = rows.map((r: any) =>
      `"${r.company_name}","${r.contact_name || ""}","${r.contact_email || ""}","${r.file_name || "COI"}","${r.policy_number || ""}","${r.carrier_name || ""}","${r.expiration_date}","${r.status}"`
    ).join("\n");
    fs.writeFileSync(filePath, header + body);
  } else {
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Expired Vendors Report</title>
<style>body{font-family:system-ui,sans-serif;background:#18181b;color:#fff;padding:2rem}
h1{font-size:1.5rem;margin-bottom:.5rem}
table{width:100%;border-collapse:collapse;margin-top:1rem}
th,td{padding:.5rem .75rem;text-align:left;font-size:.875rem;border-bottom:1px solid #27272a}
th{color:#a1a1aa;font-weight:600}.expired{color:#f87171}</style></head><body>
<h1>Expired Vendors</h1><p>Generated: ${new Date().toLocaleDateString()} | ${rows.length} expired certificate${rows.length !== 1 ? "s" : ""}</p>
<table><tr><th>Vendor</th><th>Contact</th><th>File</th><th>Policy #</th><th>Carrier</th><th>Expiration</th></tr>`;
    for (const r of rows) {
      html += `<tr><td>${r.company_name}</td><td>${r.contact_name || ""}<br><small>${r.contact_email || ""}</small></td><td>${r.file_name || "COI"}</td><td>${r.policy_number || "—"}</td><td>${r.carrier_name || "—"}</td><td class="expired">${r.expiration_date}</td></tr>`;
    }
    html += `</table></body></html>`;
    fs.writeFileSync(filePath, html);
  }

  const meta = await saveReportMeta("expired", format, fileName, filePath);
  return meta;
}

export async function generateUpcomingRenewalsReport(
  format: "csv" | "html",
  startDate: string,
  endDate: string
): Promise<ReportMeta> {
  await getDb();
  const rows = queryAll<any>(
    `SELECT v.id as vendor_id, v.company_name, v.contact_name, v.contact_email,
            c.file_name, c.policy_number, c.carrier_name, c.expiration_date, c.status
     FROM certificates c
     JOIN vendors v ON c.vendor_id = v.id
     WHERE c.expiration_date BETWEEN ? AND ? AND c.status != 'rejected'
     ORDER BY c.expiration_date ASC`,
    [startDate, endDate]
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `upcoming-renewals-${timestamp}.${format}`;
  const filePath = path.join(REPORTS_DIR, fileName);

  ensureReportsDir();

  if (format === "csv") {
    const header = "Vendor,Contact,Email,File,Policy #,Carrier,Expiration Date,Days Left\n";
    const body = rows.map((r: any) => {
      const daysLeft = Math.ceil((new Date(r.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return `"${r.company_name}","${r.contact_name || ""}","${r.contact_email || ""}","${r.file_name || "COI"}","${r.policy_number || ""}","${r.carrier_name || ""}","${r.expiration_date}","${daysLeft}"`;
    }).join("\n");
    fs.writeFileSync(filePath, header + body);
  } else {
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Upcoming Renewals</title>
<style>body{font-family:system-ui,sans-serif;background:#18181b;color:#fff;padding:2rem}
h1{font-size:1.5rem;margin-bottom:.5rem}
table{width:100%;border-collapse:collapse;margin-top:1rem}
th,td{padding:.5rem .75rem;text-align:left;font-size:.875rem;border-bottom:1px solid #27272a}
th{color:#a1a1aa;font-weight:600}.soon{color:#f87171}.medium{color:#fbbf24}.later{color:#34d399}</style></head><body>
<h1>Upcoming Renewals</h1><p>Generated: ${new Date().toLocaleDateString()} | Range: ${startDate} to ${endDate} | ${rows.length} certificate${rows.length !== 1 ? "s" : ""}</p>
<table><tr><th>Vendor</th><th>Contact</th><th>File</th><th>Policy #</th><th>Carrier</th><th>Expiration</th><th>Days Left</th></tr>`;
    for (const r of rows) {
      const daysLeft = Math.ceil((new Date(r.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const cls = daysLeft <= 14 ? "soon" : daysLeft <= 30 ? "medium" : "later";
      html += `<tr><td>${r.company_name}</td><td>${r.contact_name || ""}<br><small>${r.contact_email || ""}</small></td><td>${r.file_name || "COI"}</td><td>${r.policy_number || "—"}</td><td>${r.carrier_name || "—"}</td><td>${r.expiration_date}</td><td class="${cls}">${daysLeft} days</td></tr>`;
    }
    html += `</table></body></html>`;
    fs.writeFileSync(filePath, html);
  }

  const meta = await saveReportMeta("upcoming_renewals", format, fileName, filePath);
  return meta;
}

async function saveReportMeta(
  reportType: string,
  format: string,
  fileName: string,
  filePath: string
): Promise<ReportMeta> {
  execute(
    `INSERT INTO reports (report_type, format, file_name, file_path)
     VALUES (?, ?, ?, ?)`,
    [reportType, format, fileName, filePath]
  );
  saveDb();

  const row = queryOne<ReportMeta>(
    "SELECT id, report_type, format, file_name, file_path, created_at FROM reports WHERE file_path = ? ORDER BY id DESC LIMIT 1",
    [filePath]
  );
  return row!;
}

export async function getReportHistory(): Promise<ReportMeta[]> {
  await getDb();
  return queryAll<ReportMeta>(
    "SELECT id, report_type, format, file_name, file_path, created_at FROM reports ORDER BY created_at DESC LIMIT 50"
  );
}

export function getReportDownloadPath(id: number): string | null {
  const row = queryOne<{ file_path: string }>(
    "SELECT file_path FROM reports WHERE id = ?",
    [id]
  );
  return row?.file_path || null;
}
