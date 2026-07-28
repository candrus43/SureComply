import { getDb, queryAll, execute, saveDb } from "./db";
import { coverageLabel } from "./utils";

interface ComplianceResult {
  certificate_id: number;
  vendor_id: number;
  coverage_type: string;
  required_amount: number | null;
  actual_amount: number | null;
  is_compliant: boolean;
  explanation: string;
}

export async function runComplianceCheck(certificateId: number): Promise<ComplianceResult[]> {
  const db = await getDb();

  // Get certificate info
  const cert = queryAll<{ vendor_id: number }>(
    "SELECT vendor_id FROM certificates WHERE id = ?",
    [certificateId]
  );
  if (cert.length === 0) throw new Error("Certificate not found");
  const vendorId = cert[0].vendor_id;

  // Get requirements
  const requirements = queryAll<{
    id: number; coverage_type: string; required_amount: number | null; is_required: number;
  }>("SELECT * FROM coverage_requirements WHERE is_required = 1");

  // Get coverages for this certificate
  const coverages = queryAll<{ coverage_type: string; coverage_limit: number | null }>(
    "SELECT coverage_type, coverage_limit FROM certificate_coverages WHERE certificate_id = ?",
    [certificateId]
  );

  // Clear old checks for this certificate
  execute("DELETE FROM compliance_checks WHERE certificate_id = ?", [certificateId]);

  const results: ComplianceResult[] = [];

  for (const req of requirements) {
    const coverage = coverages.find((c) => c.coverage_type === req.coverage_type);
    const actualAmount = coverage?.coverage_limit ?? null;

    let isCompliant = false;
    let explanation = "";

    if (!coverage) {
      isCompliant = false;
      const limitStr = req.required_amount != null ? `$${req.required_amount.toLocaleString()}` : "required";
      explanation = `${coverageLabel(req.coverage_type)} is required but not present on certificate. Minimum required: ${limitStr}`;
    } else if (req.required_amount != null && actualAmount != null && actualAmount < req.required_amount) {
      isCompliant = false;
      explanation = `${coverageLabel(req.coverage_type)} limit $${actualAmount.toLocaleString()} is below required $${req.required_amount.toLocaleString()}`;
    } else {
      isCompliant = true;
      explanation = `${coverageLabel(req.coverage_type)} meets requirements`;
    }

    // Store in DB
    execute(
      `INSERT INTO compliance_checks (certificate_id, vendor_id, coverage_type, requirement_id, is_compliant, explanation, required_amount, actual_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [certificateId, vendorId, req.coverage_type, req.id, isCompliant ? 1 : 0, explanation, req.required_amount, actualAmount]
    );

    results.push({
      certificate_id: certificateId,
      vendor_id: vendorId,
      coverage_type: req.coverage_type,
      required_amount: req.required_amount,
      actual_amount: actualAmount,
      is_compliant: isCompliant,
      explanation,
    });
  }

  // Mark not-required coverages as not_applicable
  const notRequired = queryAll<{ id: number; coverage_type: string }>(
    "SELECT id, coverage_type FROM coverage_requirements WHERE is_required = 0"
  );
  for (const nr of notRequired) {
    const coverage = coverages.find((c) => c.coverage_type === nr.coverage_type);
    execute(
      `INSERT INTO compliance_checks (certificate_id, vendor_id, coverage_type, requirement_id, is_compliant, explanation, required_amount, actual_amount)
       VALUES (?, ?, ?, ?, 1, 'Not required', ?, ?)`,
      [certificateId, vendorId, nr.coverage_type, nr.id, nr.required_amount, coverage?.coverage_limit ?? null]
    );
  }

  saveDb();
  return results;
}
