import { createFileRoute } from "@tanstack/react-router";
import { getDb, execute, queryOne, saveDb } from "~/lib/db";
import * as fs from "fs";
import * as path from "path";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") || "";
          if (!contentType.includes("multipart/form-data")) {
            return new Response(
              JSON.stringify({ error: "Expected multipart/form-data" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const formData = await request.formData();
          const file = formData.get("file") as File | null;
          const vendorIdStr = formData.get("vendor_id") as string;

          if (!file) {
            return new Response(
              JSON.stringify({ error: "No file provided" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (!vendorIdStr) {
            return new Response(
              JSON.stringify({ error: "No vendor_id provided" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const vendorId = parseInt(vendorIdStr);
          if (isNaN(vendorId)) {
            return new Response(
              JSON.stringify({ error: "Invalid vendor_id" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Validate file type
          const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
          if (!allowedTypes.includes(file.type)) {
            return new Response(
              JSON.stringify({ error: "Unsupported file type" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Validate size
          if (file.size > 25 * 1024 * 1024) {
            return new Response(
              JSON.stringify({ error: "File exceeds 25 MB limit" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Ensure DB
          await getDb();

          // Save file
          const ext = path.extname(file.name) || ".pdf";
          const uuid = crypto.randomUUID();
          const vendorDir = path.join("/home/team/shared/uploads", String(vendorId));
          fs.mkdirSync(vendorDir, { recursive: true });
          const filePath = path.join(vendorDir, `${uuid}${ext}`);

          const buffer = Buffer.from(await file.arrayBuffer());
          fs.writeFileSync(filePath, buffer);

          // Create certificate record
          execute(
            `INSERT INTO certificates (vendor_id, user_id, file_path, file_name, status)
             VALUES (?, 1, ?, ?, 'pending_review')`,
            [vendorId, filePath, file.name]
          );
          saveDb();

          const cert = queryOne<{ id: number }>(
            "SELECT id FROM certificates WHERE vendor_id = ? AND file_name = ? ORDER BY id DESC LIMIT 1",
            [vendorId, file.name]
          );

          return new Response(
            JSON.stringify({ success: true, certificateId: cert?.id, filePath }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          console.error("Upload error:", err);
          return new Response(
            JSON.stringify({ error: err.message || "Upload failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
