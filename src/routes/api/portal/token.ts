import { createFileRoute } from "@tanstack/react-router";
import { getDb, execute, queryOne, saveDb } from "~/lib/db";
import * as crypto from "crypto";

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function getExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export const Route = createFileRoute("/api/portal/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const vendorId = body.vendor_id;

          if (!vendorId) {
            return new Response(
              JSON.stringify({ error: "vendor_id is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          await getDb();

          // Verify vendor exists
          const vendor = queryOne<{ id: number; company_name: string }>(
            "SELECT id, company_name FROM vendors WHERE id = ?",
            [vendorId]
          );
          if (!vendor) {
            return new Response(
              JSON.stringify({ error: "Vendor not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          // Revoke all existing active tokens for this vendor
          execute(
            "UPDATE vendor_tokens SET revoked_at = datetime('now') WHERE vendor_id = ? AND revoked_at IS NULL",
            [vendorId]
          );

          // Generate new token
          const token = generateToken();
          const expiresAt = getExpiryDate();

          execute(
            "INSERT INTO vendor_tokens (vendor_id, token, expires_at) VALUES (?, ?, ?)",
            [vendorId, token, expiresAt]
          );
          saveDb();

          const created = queryOne<{ id: number; token: string; expires_at: string }>(
            "SELECT id, token, expires_at, created_at FROM vendor_tokens WHERE token = ?",
            [token]
          );

          return new Response(
            JSON.stringify({
              success: true,
              token: created?.token,
              expires_at: created?.expires_at,
              portal_url: `/portal/${created?.token}`,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err.message || "Internal error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },

      DELETE: async ({ request }) => {
        try {
          const body = await request.json();
          const vendorId = body.vendor_id;

          if (!vendorId) {
            return new Response(
              JSON.stringify({ error: "vendor_id is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          await getDb();
          execute(
            "UPDATE vendor_tokens SET revoked_at = datetime('now') WHERE vendor_id = ? AND revoked_at IS NULL",
            [vendorId]
          );
          saveDb();

          return new Response(
            JSON.stringify({ success: true, message: "Token revoked" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err.message || "Internal error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
