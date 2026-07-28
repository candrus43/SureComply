import { createFileRoute } from "@tanstack/react-router";
import { login, setSessionCookie } from "~/lib/auth";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { email?: string; password?: string };
          const email = body.email?.trim();
          const password = body.password;

          if (!email || !password) {
            return new Response(
              JSON.stringify({ error: "Email and password are required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const result = await login(email, password);
          if (!result) {
            return new Response(
              JSON.stringify({ error: "Invalid email or password" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ user: result.user }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Set-Cookie": setSessionCookie(result.sessionId),
              },
            }
          );
        } catch (err) {
          console.error("Login error:", err);
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
