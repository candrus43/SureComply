import { createFileRoute } from "@tanstack/react-router";
import { getDb, queryOne } from "~/lib/db";

export const Route = createFileRoute("/api/reminders/status")({
  server: {
    handlers: {
      GET: async () => {
        await getDb();
        const pending = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM reminders WHERE status = 'queued'")?.c || 0;
        const sentToday = queryOne<{ c: number }>(
          "SELECT COUNT(*) as c FROM reminders WHERE status = 'sent' AND date(sent_at) = date('now')"
        )?.c || 0;
        const failed = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM reminders WHERE status = 'failed'")?.c || 0;
        return new Response(JSON.stringify({ pending, sentToday, failed }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
