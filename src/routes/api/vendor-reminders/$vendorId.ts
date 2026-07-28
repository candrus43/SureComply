import { createFileRoute } from "@tanstack/react-router";
import { getDb, queryOne, execute, saveDb } from "~/lib/db";

export const Route = createFileRoute("/api/vendor-reminders/$vendorId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        await getDb();
        const vendorId = parseInt(params.vendorId);
        const vendor = queryOne<{ reminders_paused: number; reminders_paused_at: string | null; reminders_paused_reason: string | null }>(
          "SELECT reminders_paused, reminders_paused_at, reminders_paused_reason FROM vendors WHERE id = ?",
          [vendorId]
        );
        if (!vendor) {
          return new Response(JSON.stringify({ error: "Vendor not found" }), {
            status: 404, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          paused: !!vendor.reminders_paused,
          pausedAt: vendor.reminders_paused_at,
          reason: vendor.reminders_paused_reason,
        }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
      PATCH: async ({ params, request }) => {
        try {
          const vendorId = parseInt(params.vendorId);
          const body = await request.json();
          const { paused, reason } = body;

          if (paused) {
            execute(
              "UPDATE vendors SET reminders_paused = 1, reminders_paused_at = datetime('now'), reminders_paused_reason = ?, updated_at = datetime('now') WHERE id = ?",
              [reason || null, vendorId]
            );
            // Cancel any queued reminders for this vendor
            execute(
              "UPDATE reminders SET status = 'cancelled', cancelled_reason = 'vendor_paused' WHERE vendor_id = ? AND status = 'queued'",
              [vendorId]
            );
          } else {
            execute(
              "UPDATE vendors SET reminders_paused = 0, reminders_paused_at = NULL, reminders_paused_reason = NULL, updated_at = datetime('now') WHERE id = ?",
              [vendorId]
            );
          }
          saveDb();

          const vendor = queryOne<{ reminders_paused: number }>(
            "SELECT reminders_paused FROM vendors WHERE id = ?", [vendorId]
          );

          return new Response(JSON.stringify({
            paused: !!vendor?.reminders_paused,
            message: paused ? "Reminders paused" : "Reminders resumed",
          }), {
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
