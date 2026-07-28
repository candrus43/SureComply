import { getDb, execute, queryOne, saveDb } from "./db";

export async function ensureTables(): Promise<void> {
  const db = await getDb();

  // Add vendor_type column if missing
  const vendorCols = db.exec("PRAGMA table_info(vendors)");
  const hasVendorType = vendorCols[0]?.values?.some((r: any) => r[1] === "vendor_type");
  if (!hasVendorType) {
    execute("ALTER TABLE vendors ADD COLUMN vendor_type TEXT DEFAULT 'Contractor'");
  }

  // Ensure coverage_requirements have defaults if empty
  const reqCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM coverage_requirements");
  if (reqCount && reqCount.c === 0) {
    const defaults = [
      ["general_liability", 2000000, 1, "General Liability"],
      ["workers_comp", 500000, 1, "Workers Compensation"],
      ["auto_liability", 1000000, 1, "Auto Liability"],
      ["umbrella_excess", 5000000, 0, "Umbrella / Excess"],
      ["professional_liability", 2000000, 0, "Professional Liability"],
      ["pollution_liability", null, 0, "Pollution Liability"],
      ["builders_risk", null, 0, "Builders Risk"],
      ["cyber_liability", null, 0, "Cyber Liability"],
    ];
    for (const [type, amount, required, desc] of defaults) {
      execute(
        "INSERT INTO coverage_requirements (user_id, coverage_type, required_amount, is_required, description) VALUES (1, ?, ?, ?, ?)",
        [type, amount, required, desc]
      );
    }
  }

  saveDb();
}
