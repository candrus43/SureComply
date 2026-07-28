import { createFileRoute } from "@tanstack/react-router";
import { getDb, execute, queryOne, saveDb } from "~/lib/db";
import * as fs from "fs";
import * as path from "path";

export const Route = createFileRoute("/api/portal/upload")({
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
          const tokenStr = formData.get("token") as string;

          if (!file) {
            return new Response(
              JSON.stringify({ error: "No file provided" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (!tokenStr) {
            return new Response(
              JSON.stringify({ error: "No token provided" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          await getDb();

          // Validate token
          const tokenRow = queryOne<{
            id: number;
            vendor_id: number;
            expires_at: string;
            revoked_at: string | null;
          }>(
            "SELECT id, vendor_id, expires_at, revoked_at FROM vendor_tokens WHERE token = ?",
            [tokenStr]
          );

          if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
            return new Response(
              JSON.stringify({ error: "Invalid or expired token" }),
              { status: 403, headers: { "Content-Type": "application/json" } }
            );
          }

          const vendorId = tokenRow.vendor_id;

          // Validate file type
          const allowedTypes = [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
          ];
          if (!allowedTypes.includes(file.type)) {
            return new Response(
              JSON.stringify({ error: "Unsupported file type. Please upload PDF, PNG, JPG, or WebP." }),
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

          // Create admin notification
          execute(
            `INSERT INTO admin_notifications (type, vendor_id, certificate_id, message)
             VALUES ('portal_upload', ?, ?, ?)`,
            [
              vendorId,
              cert?.id || null,
              `New COI uploaded via vendor portal: ${file.name}`,
            ]
          );
          saveDb();

          // Update token last_accessed_at
          execute(
            "UPDATE vendor_tokens SET last_accessed_at = datetime('now') WHERE id = ?",
            [tokenRow.id]
          );
          saveDb();

          return new Response(
            JSON.stringify({
              success: true,
              certificateId: cert?.id,
              message: "Certificate uploaded successfully. It will be reviewed shortly.",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          console.error("Portal upload error:", err);
          return new Response(
            JSON.stringify({ error: err.message || "Upload failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
