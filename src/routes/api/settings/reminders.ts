import { createFileRoute } from "@tanstack/react-router";
import { getDb, queryAll, execute, saveDb } from "~/lib/db";

export const Route = createFileRoute("/api/settings/reminders")({
  server: {
    handlers: {
      GET: async () => {
        await getDb();
        const data = queryAll("SELECT * FROM reminder_configs WHERE user_id = 1 ORDER BY days_before_expiry");
        return new Response(JSON.stringify(data), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
      PUT: async ({ request }) => {
        try {
          const body = await request.json();
          const { days } = body; // number[]

          if (!Array.isArray(days)) {
            return new Response(JSON.stringify({ error: "days must be an array of integers" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }

          execute("DELETE FROM reminder_configs WHERE user_id = 1");
          for (const d of days) {
            execute(
              "INSERT INTO reminder_configs (user_id, days_before_expiry, is_enabled) VALUES (1, ?, 1)",
              [d]
            );
          }
          saveDb();

          const data = queryAll("SELECT * FROM reminder_configs WHERE user_id = 1 ORDER BY days_before_expiry");
          return new Response(JSON.stringify(data), {
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
