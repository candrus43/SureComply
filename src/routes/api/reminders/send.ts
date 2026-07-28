import { createFileRoute } from "@tanstack/react-router";
import { sendReminders } from "~/lib/reminders";

export const Route = createFileRoute("/api/reminders/send")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const count = await sendReminders();
          return new Response(JSON.stringify({ count, message: `Sent ${count} reminder(s)` }), {
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
