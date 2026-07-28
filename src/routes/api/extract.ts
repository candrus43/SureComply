import { createFileRoute } from "@tanstack/react-router";
import { getDb, execute, queryOne, saveDb } from "~/lib/db";
import { extractFromFile } from "~/lib/extraction";

export const Route = createFileRoute("/api/extract")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { certificate_id: number };
          if (!body.certificate_id) {
            return new Response(JSON.stringify({ error: "certificate_id required" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }

          await getDb();
          const cert = queryOne<{ file_path: string; id: number }>(
            "SELECT id, file_path FROM certificates WHERE id = ?",
            [body.certificate_id]
          );
          if (!cert) {
            return new Response(JSON.stringify({ error: "Certificate not found" }), {
              status: 404, headers: { "Content-Type": "application/json" },
            });
          }

          const result = await extractFromFile(cert.file_path);

          // Update certificate
          execute(
            `UPDATE certificates SET
              carrier_name = ?, policy_number = ?, effective_date = ?,
              expiration_date = ?, named_insured = ?,
              additional_insured = ?, certificate_holder = ?,
              producer_name = ?, producer_contact = ?,
              raw_extracted_data = ?, status = 'extracted',
              updated_at = datetime('now')
             WHERE id = ?`,
            [
              result.carrier_name, result.policy_number,
              result.effective_date, result.expiration_date,
              result.named_insured,
              result.additional_insured ? "Yes" : null,
              result.certificate_holder,
              result.producer_name, result.producer_contact,
              JSON.stringify(result), cert.id,
            ]
          );

          // Store coverages
          execute("DELETE FROM certificate_coverages WHERE certificate_id = ?", [cert.id]);
          for (const cov of result.coverages) {
            execute(
              "INSERT INTO certificate_coverages (certificate_id, coverage_type, coverage_limit) VALUES (?, ?, ?)",
              [cert.id, cov.type, cov.limit]
            );
          }

          saveDb();

          return new Response(JSON.stringify({ success: true, certificate_id: cert.id, ...result }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("Extraction error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
