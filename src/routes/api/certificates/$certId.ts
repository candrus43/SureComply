import { createFileRoute } from "@tanstack/react-router";
import { getDb, queryOne, queryAll, execute, saveDb } from "~/lib/db";
import { runComplianceCheck } from "~/lib/compliance";

export const Route = createFileRoute("/api/certificates/$certId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        await getDb();
        const cert = queryOne("SELECT * FROM certificates WHERE id = ?", [params.certId]);
        if (!cert) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(cert), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
      PATCH: async ({ params, request }) => {
        try {
          const d = await request.json();
          await getDb();

          execute(
            `UPDATE certificates SET
              carrier_name = ?, policy_number = ?, effective_date = ?,
              expiration_date = ?, named_insured = ?,
              additional_insured = ?, certificate_holder = ?,
              producer_name = ?, producer_contact = ?,
              status = 'reviewed', updated_at = datetime('now')
             WHERE id = ?`,
            [
              d.carrier_name ?? null, d.policy_number ?? null,
              d.effective_date ?? null, d.expiration_date ?? null,
              d.named_insured ?? null, d.additional_insured ?? null,
              d.certificate_holder ?? null, d.producer_name ?? null,
              d.producer_contact ?? null, params.certId,
            ]
          );

          // Upsert coverages
          if (d.coverages && Array.isArray(d.coverages)) {
            execute("DELETE FROM certificate_coverages WHERE certificate_id = ?", [params.certId]);
            for (const cov of d.coverages) {
              if (cov.coverage_type) {
                execute(
                  "INSERT INTO certificate_coverages (certificate_id, coverage_type, coverage_limit) VALUES (?, ?, ?)",
                  [params.certId, cov.coverage_type, cov.coverage_limit ?? null]
                );
              }
            }
          }

          saveDb();

          // Run compliance check
          await runComplianceCheck(parseInt(params.certId as string));

          const cert = queryOne("SELECT * FROM certificates WHERE id = ?", [params.certId]);
          return new Response(JSON.stringify(cert), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
