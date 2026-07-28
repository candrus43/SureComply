import { createFileRoute } from "@tanstack/react-router";
import { getDb, queryOne, queryAll } from "~/lib/db";
import { coverageLabel } from "~/lib/utils";

export const Route = createFileRoute("/api/portal/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { token } = params as { token: string };
          if (!token) {
            return new Response(
              JSON.stringify({ error: "Invalid link" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          await getDb();

          // Look up token — must be active (not revoked, not expired)
          const tokenRow = queryOne<{
            id: number;
            vendor_id: number;
            token: string;
            expires_at: string;
            revoked_at: string | null;
          }>(
            `SELECT id, vendor_id, token, expires_at, revoked_at
             FROM vendor_tokens WHERE token = ?`,
            [token]
          );

          // Generic error — never reveal whether token was valid vs expired
          if (!tokenRow || tokenRow.revoked_at) {
            return new Response(
              JSON.stringify({
                error: "This link is invalid or has expired. Please contact your SureComply administrator for a new link.",
              }),
              { status: 403, headers: { "Content-Type": "application/json" } }
            );
          }

          // Check expiry
          if (new Date(tokenRow.expires_at) < new Date()) {
            return new Response(
              JSON.stringify({
                error: "This link is invalid or has expired. Please contact your SureComply administrator for a new link.",
              }),
              { status: 403, headers: { "Content-Type": "application/json" } }
            );
          }

          // Get vendor
          const vendor = queryOne<{
            id: number;
            company_name: string;
            contact_name: string;
            contact_email: string;
          }>("SELECT id, company_name, contact_name, contact_email FROM vendors WHERE id = ?", [
            tokenRow.vendor_id,
          ]);

          if (!vendor) {
            return new Response(
              JSON.stringify({
                error: "This link is invalid or has expired. Please contact your SureComply administrator for a new link.",
              }),
              { status: 403, headers: { "Content-Type": "application/json" } }
            );
          }

          // Get requirements
          const requirements = queryAll<{
            id: number;
            coverage_type: string;
            required_amount: number | null;
            is_required: number;
            description: string;
          }>("SELECT * FROM coverage_requirements ORDER BY display_order, coverage_type");

          // Get vendor's latest certificate's coverages and compliance
          const latestCert = queryOne<{ id: number }>(
            "SELECT id FROM certificates WHERE vendor_id = ? AND status != 'rejected' ORDER BY created_at DESC LIMIT 1",
            [vendor.id]
          );

          let coverages: any[] = [];
          if (latestCert) {
            coverages = queryAll<any>(
              "SELECT coverage_type, coverage_limit FROM certificate_coverages WHERE certificate_id = ?",
              [latestCert.id]
            );
          }

          // Compute per-requirement status
          const reqStatus = requirements.map((req) => {
            const cov = coverages.find((c: any) => c.coverage_type === req.coverage_type);
            let status: "compliant" | "non_compliant" | "not_provided" | "not_required" = "not_required";
            let gap: string | null = null;

            if (!req.is_required) {
              status = "not_required";
            } else if (!cov) {
              status = "not_provided";
              gap = `${coverageLabel(req.coverage_type)} is required but not provided`;
            } else if (
              req.required_amount != null &&
              cov.coverage_limit != null &&
              cov.coverage_limit < req.required_amount
            ) {
              status = "non_compliant";
              gap = `Limit $${cov.coverage_limit.toLocaleString()} is below required $${req.required_amount.toLocaleString()}`;
            } else {
              status = "compliant";
            }

            return {
              coverage_type: req.coverage_type,
              label: coverageLabel(req.coverage_type),
              required_limit: req.required_amount,
              is_required: !!req.is_required,
              actual_limit: cov?.coverage_limit ?? null,
              status,
              gap,
            };
          });

          // Determine overall status
          const hasNonCompliant = reqStatus.some((r) => r.status === "non_compliant");
          const hasMissing = reqStatus.some((r) => r.status === "not_provided");
          let overallStatus: string;
          if (hasNonCompliant || hasMissing) {
            overallStatus = "Action Needed";
          } else {
            overallStatus = "Compliant";
          }

          // Get certificate history
          const certificates = queryAll<any>(
            `SELECT id, file_name, status, expiration_date, policy_number, created_at
             FROM certificates WHERE vendor_id = ? AND status != 'rejected'
             ORDER BY created_at DESC`,
            [vendor.id]
          );

          return new Response(
            JSON.stringify({
              vendor,
              requirements: reqStatus,
              overallStatus,
              certificates,
              tokenExpiresAt: tokenRow.expires_at,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              error: "This link is invalid or has expired. Please contact your SureComply administrator for a new link.",
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
