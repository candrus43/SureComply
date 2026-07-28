import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { RouterContext } from "../router";
import appCss from "~/styles/app.css?url";
import { getCurrentUser } from "~/lib/auth-check";
import { Sidebar } from "~/components/sidebar";
import { LandingNav } from "~/components/landing-nav";

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SureComply — Vendor Insurance Compliance" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p>Page not found</p>
      </div>
    </div>
  ),
  beforeLoad: async () => {
    const user = await getCurrentUser();
    return { user };
  },
  component: RootComponent,
});

function RootComponent() {
  const { user } = Route.useRouteContext();
  const isAuthenticated = user !== null;

  return (
    <RootDocument>
      {isAuthenticated ? (
        <div className="flex h-screen bg-zinc-950">
          <Sidebar user={user!} />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      ) : (
        <div className="min-h-screen bg-zinc-950">
          <LandingNav />
          <Outlet />
        </div>
      )}
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-zinc-950 text-white antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
