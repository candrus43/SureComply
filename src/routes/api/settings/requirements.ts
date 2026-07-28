import { createFileRoute } from "@tanstack/react-router";
import { getDb, queryAll, execute, queryOne, saveDb } from "~/lib/db";

export const Route = createFileRoute("/api/settings/requirements")({
  server: {
    handlers: {
      GET: async () => {
        await getDb();
        const data = queryAll("SELECT * FROM coverage_requirements ORDER BY coverage_type");
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { coverage_type, required_amount, is_required, description } = body;

          if (!coverage_type) {
            return new Response(JSON.stringify({ error: "Coverage type is required" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }

          const existing = queryOne<{ id: number }>(
            "SELECT id FROM coverage_requirements WHERE coverage_type = ?", [coverage_type]
          );
          if (existing) {
            return new Response(JSON.stringify({ error: "A requirement for this coverage type already exists" }), {
              status: 409, headers: { "Content-Type": "application/json" },
            });
          }

          execute(
            `INSERT INTO coverage_requirements (user_id, coverage_type, required_amount, is_required, description)
             VALUES (1, ?, ?, ?, ?)`,
            [coverage_type, required_amount ?? null, is_required ? 1 : 0, description || null]
          );
          saveDb();

          const data = queryAll("SELECT * FROM coverage_requirements ORDER BY coverage_type");
          return new Response(JSON.stringify(data), {
            status: 201, headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
      PATCH: async ({ request }) => {
        try {
          const body = await request.json();
          const { id, coverage_type, required_amount, is_required, description } = body;

          if (!id) {
            return new Response(JSON.stringify({ error: "ID is required" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }

          execute(
            `UPDATE coverage_requirements SET
              coverage_type = COALESCE(?, coverage_type),
              required_amount = COALESCE(?, required_amount),
              is_required = COALESCE(?, is_required),
              description = COALESCE(?, description),
              updated_at = datetime('now')
             WHERE id = ?`,
            [
              coverage_type ?? null,
              required_amount !== undefined ? required_amount : null,
              is_required !== undefined ? (is_required ? 1 : 0) : null,
              description !== undefined ? description : null,
              id,
            ]
          );
          saveDb();

          const data = queryAll("SELECT * FROM coverage_requirements ORDER BY coverage_type");
          return new Response(JSON.stringify(data), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
      DELETE: async ({ request }) => {
        try {
          const body = await request.json();
          const { id } = body;

          if (!id) {
            return new Response(JSON.stringify({ error: "ID is required" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }

          execute("DELETE FROM coverage_requirements WHERE id = ?", [id]);
          saveDb();

          const data = queryAll("SELECT * FROM coverage_requirements ORDER BY coverage_type");
          return new Response(JSON.stringify(data), {
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
