import { createFileRoute } from "@tanstack/react-router";
import {
  generateComplianceReport,
  generateExpiredReport,
  generateUpcomingRenewalsReport,
} from "~/lib/report-generator";

export const Route = createFileRoute("/api/reports/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { report_type, format, start_date, end_date } = body;

          if (!report_type || !format) {
            return new Response(
              JSON.stringify({ error: "report_type and format are required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          if (!["csv", "html"].includes(format)) {
            return new Response(
              JSON.stringify({ error: "format must be csv or html" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          let report;
          switch (report_type) {
            case "compliance":
              report = await generateComplianceReport(format as "csv" | "html");
              break;
            case "expired":
              report = await generateExpiredReport(format as "csv" | "html");
              break;
            case "upcoming_renewals":
              if (!start_date || !end_date) {
                return new Response(
                  JSON.stringify({ error: "start_date and end_date required for upcoming_renewals" }),
                  { status: 400, headers: { "Content-Type": "application/json" } }
                );
              }
              report = await generateUpcomingRenewalsReport(
                format as "csv" | "html",
                start_date,
                end_date
              );
              break;
            default:
              return new Response(
                JSON.stringify({ error: "Invalid report_type" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
          }

          return new Response(JSON.stringify({ success: true, report }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err.message || "Failed to generate report" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
