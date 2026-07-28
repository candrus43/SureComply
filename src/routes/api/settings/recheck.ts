import { createFileRoute } from "@tanstack/react-router";
import { getDb, queryAll } from "~/lib/db";
import { runComplianceCheck } from "~/lib/compliance";

export const Route = createFileRoute("/api/settings/recheck")({
  server: {
    handlers: {
      POST: async () => {
        try {
          await getDb();
          const certs = queryAll<{ id: number }>("SELECT id FROM certificates WHERE status != 'rejected'");
          let count = 0;
          for (const c of certs) {
            await runComplianceCheck(c.id);
            count++;
          }
          return new Response(JSON.stringify({ count, message: `Rechecked ${count} certificates` }), {
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
