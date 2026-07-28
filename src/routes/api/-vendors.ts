import { createServerFn } from "@tanstack/react-start";
import { getDb, execute, queryOne, saveDb } from "../../lib/db";

export type VendorRow = {
  id: number;
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
  status: string;
  created_at: string;
  updated_at: string;
};

export const createVendor = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: Record<string, any> }) => {
    const db = await getDb();
    const d = data;

    // Check unique company name
    const existing = queryOne<{ id: number }>(
      "SELECT id FROM vendors WHERE company_name = ? AND status = 'active'",
      [d.company_name]
    );
    if (existing) throw new Error("A vendor with this name already exists.");

    // Check unique email
    if (d.contact_email) {
      const emailExists = queryOne<{ id: number }>(
        "SELECT id FROM vendors WHERE contact_email = ? AND status = 'active'",
        [d.contact_email]
      );
      if (emailExists) throw new Error("A vendor with this email already exists.");
    }

    execute(
      `INSERT INTO vendors (user_id, company_name, contact_name, contact_email, contact_phone,
        address_line1, address_line2, city, state, zip, vendor_type, notes,
        insurance_agent_name, insurance_agent_email, insurance_agent_phone)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.company_name, d.contact_name, d.contact_email || null, d.contact_phone || null,
        d.address_line1 || null, d.address_line2 || null, d.city || null,
        d.state || null, d.zip || null, d.vendor_type || "Contractor", d.notes || null,
        d.insurance_agent_name || null, d.insurance_agent_email || null,
        d.insurance_agent_phone || null,
      ]
    );
    saveDb();

    const vendor = queryOne<VendorRow>(
      "SELECT * FROM vendors WHERE company_name = ? ORDER BY id DESC LIMIT 1",
      [d.company_name]
    );
    return vendor;
  }
);

export const getVendor = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { id: number } }) => {
    await getDb();
    return queryOne<VendorRow>("SELECT * FROM vendors WHERE id = ?", [data.id]);
  }
);

export const updateVendor = createServerFn({ method: "PATCH" }).handler(
  async ({ data }: { data: { id: number } & Record<string, any> }) => {
    const db = await getDb();
    const d = data;

    // Check unique company name (excluding self)
    if (d.company_name) {
      const existing = queryOne<{ id: number }>(
        "SELECT id FROM vendors WHERE company_name = ? AND id != ? AND status = 'active'",
        [d.company_name, d.id]
      );
      if (existing) throw new Error("A vendor with this name already exists.");
    }

    execute(
      `UPDATE vendors SET
        company_name = COALESCE(?, company_name),
        contact_name = COALESCE(?, contact_name),
        contact_email = COALESCE(?, contact_email),
        contact_phone = COALESCE(?, contact_phone),
        address_line1 = COALESCE(?, address_line1),
        address_line2 = COALESCE(?, address_line2),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        zip = COALESCE(?, zip),
        vendor_type = COALESCE(?, vendor_type),
        notes = COALESCE(?, notes),
        insurance_agent_name = COALESCE(?, insurance_agent_name),
        insurance_agent_email = COALESCE(?, insurance_agent_email),
        insurance_agent_phone = COALESCE(?, insurance_agent_phone),
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        d.company_name, d.contact_name, d.contact_email, d.contact_phone,
        d.address_line1, d.address_line2, d.city, d.state, d.zip,
        d.vendor_type, d.notes, d.insurance_agent_name, d.insurance_agent_email,
        d.insurance_agent_phone, d.id,
      ]
    );
    saveDb();
    return queryOne<VendorRow>("SELECT * FROM vendors WHERE id = ?", [d.id]);
  }
);

export const archiveVendor = createServerFn({ method: "DELETE" }).handler(
  async ({ data }: { data: { id: number } }) => {
    execute("UPDATE vendors SET status = 'archived', updated_at = datetime('now') WHERE id = ?", [data.id]);
    saveDb();
    return { success: true };
  }
);
