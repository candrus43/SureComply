import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookie, getSessionFromRequest, deleteSession } from "~/lib/auth";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Read session cookie and delete from DB
        const cookieHeader = request.headers.get("cookie");
        if (cookieHeader) {
          const cookies = parseCookies(cookieHeader);
          const sessionId = cookies["session"];
          if (sessionId) {
            await deleteSession(sessionId);
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": clearSessionCookie(),
          },
        });
      },
    },
  },
});

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > 0) {
      result[part.substring(0, idx).trim()] = decodeURIComponent(
        part.substring(idx + 1).trim()
      );
    }
  });
  return result;
}
