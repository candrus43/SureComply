import { createServerFn } from "@tanstack/react-start";
import { getSessionFromRequest } from "./auth";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async ({ request }: { request?: Request }) => {
    if (!request) return null;
    return getSessionFromRequest(request);
  }
);
