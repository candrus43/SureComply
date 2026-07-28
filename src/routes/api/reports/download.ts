import { createFileRoute } from "@tanstack/react-router";
import { getDb, queryOne } from "~/lib/db";
import * as fs from "fs";

export const Route = createFileRoute("/api/reports/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) {
            return new Response(
              JSON.stringify({ error: "Report ID is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          await getDb();
          const report = queryOne<{
            id: number;
            file_name: string;
            file_path: string;
            format: string;
          }>("SELECT id, file_name, file_path, format FROM reports WHERE id = ?", [parseInt(id)]);

          if (!report || !fs.existsSync(report.file_path)) {
            return new Response(
              JSON.stringify({ error: "Report not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          const content = fs.readFileSync(report.file_path);
          const contentType =
            report.format === "csv"
              ? "text/csv"
              : "text/html";

          return new Response(content, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="${report.file_name}"`,
            },
          });
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err.message || "Download failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
