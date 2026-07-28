import { createFileRoute } from "@tanstack/react-router";
import { signup, setSessionCookie } from "~/lib/auth";

export const Route = createFileRoute("/api/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as {
            email?: string;
            password?: string;
            name?: string;
          };
          const email = body.email?.trim();
          const password = body.password;
          const name = body.name?.trim();

          if (!email || !password || !name) {
            return new Response(
              JSON.stringify({ error: "Name, email, and password are required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          if (password.length < 6) {
            return new Response(
              JSON.stringify({ error: "Password must be at least 6 characters" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const result = await signup(email, password, name);
          if (!result) {
            return new Response(
              JSON.stringify({ error: "An account with this email already exists" }),
              { status: 409, headers: { "Content-Type": "application/json" } }
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
          console.error("Signup error:", err);
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
