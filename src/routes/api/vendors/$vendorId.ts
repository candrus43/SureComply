import { createFileRoute } from "@tanstack/react-router";
import { getDb, queryOne, execute, saveDb } from "~/lib/db";

export const Route = createFileRoute("/api/vendors/$vendorId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        await getDb();
        const vendor = queryOne("SELECT * FROM vendors WHERE id = ?", [params.vendorId]);
        return new Response(JSON.stringify(vendor), {
          status: vendor ? 200 : 404,
          headers: { "Content-Type": "application/json" },
        });
      },
      PATCH: async ({ params, request }) => {
        try {
          const d = await request.json();
          await getDb();

          // Check unique company name
          if (d.company_name) {
            const existing = queryOne<{ id: number }>(
              "SELECT id FROM vendors WHERE company_name = ? AND id != ? AND status = 'active'",
              [d.company_name, params.vendorId]
            );
            if (existing) {
              return new Response(
                JSON.stringify({ error: "A vendor with this name already exists." }),
                { status: 409, headers: { "Content-Type": "application/json" } }
              );
            }
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
              d.insurance_agent_phone, params.vendorId,
            ]
          );
          saveDb();

          const vendor = queryOne("SELECT * FROM vendors WHERE id = ?", [params.vendorId]);
          return new Response(JSON.stringify(vendor), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
      DELETE: async ({ params }) => {
        await getDb();
        execute("UPDATE vendors SET status = 'archived', updated_at = datetime('now') WHERE id = ?", [params.vendorId]);
        saveDb();
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
