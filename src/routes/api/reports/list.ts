import { createFileRoute } from "@tanstack/react-router";
import { getReportHistory } from "~/lib/report-generator";

export const Route = createFileRoute("/api/reports/list")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const reports = await getReportHistory();
          return new Response(JSON.stringify({ reports }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err.message || "Failed to list reports" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
