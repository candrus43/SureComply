import { createFileRoute } from "@tanstack/react-router";
import { processQuery } from "~/lib/ai-assistant";

export const Route = createFileRoute("/api/ai/query")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { query } = body;

          if (!query || typeof query !== "string" || query.trim().length === 0) {
            return new Response(
              JSON.stringify({ error: "Query is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Use IP or a simple session identifier for rate limiting
          const forwarded = request.headers.get("x-forwarded-for");
          const sessionId = forwarded?.split(",")[0]?.trim() || "default";

          const result = await processQuery(query.trim(), sessionId);

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
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
