import { createFileRoute } from "@tanstack/react-router";
import { checkReminders } from "~/lib/reminders";

export const Route = createFileRoute("/api/reminders/check")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const count = await checkReminders();
          return new Response(JSON.stringify({ count, message: `Created ${count} new reminder(s)` }), {
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
