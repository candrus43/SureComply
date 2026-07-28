import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getDb, queryAll, queryOne } from "../lib/db";
import { useState, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Building2,
  ShieldCheck,
  AlertTriangle,
  FileX,
  Clock,
} from "lucide-react";

// ──── Types ────

interface VendorRow {
  id: number;
  company_name: string;
  contact_name: string;
  contact_email: string;
  status: string;
  active_cois: number;
  compliance_status: string;
  last_updated: string;
}

interface VendorsData {
  vendors: VendorRow[];
  total: number;
  page: number;
  perPage: number;
}

// ──── Server function ────

const getVendors = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data?: { search?: string; filter?: string; page?: number; perPage?: number } }) => {
    const db = await getDb();
    const search = data?.search || "";
    const filter = data?.filter || "all";
    const page = data?.page || 1;
    const perPage = data?.perPage || 20;
    const offset = (page - 1) * perPage;

    let where = "WHERE v.status = 'active'";
    const params: any[] = [];

    if (search) {
      where +=
        " AND (v.company_name LIKE ? OR v.contact_name LIKE ? OR v.contact_email LIKE ? OR v.city LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (filter === "compliant") {
      where += ` AND v.id IN (
        SELECT DISTINCT cc.vendor_id FROM compliance_checks cc
        JOIN certificates c ON cc.certificate_id = c.id
        WHERE cc.is_compliant = 1 AND c.expiration_date > date('now')
        GROUP BY cc.vendor_id
        HAVING SUM(CASE WHEN cc.is_compliant = 0 THEN 1 ELSE 0 END) = 0
      )`;
    } else if (filter === "non_compliant") {
      where += ` AND v.id IN (
        SELECT DISTINCT cc.vendor_id FROM compliance_checks cc
        JOIN certificates c ON cc.certificate_id = c.id
        WHERE cc.is_compliant = 0 AND c.expiration_date > date('now')
      )`;
    } else if (filter === "expiring_30") {
      where += ` AND v.id IN (
        SELECT DISTINCT c.vendor_id FROM certificates c
        WHERE c.expiration_date BETWEEN date('now') AND date('now', '+30 days')
        AND c.status != 'rejected'
      )`;
    } else if (filter === "expired") {
      where += ` AND v.id IN (
        SELECT DISTINCT c.vendor_id FROM certificates c
        WHERE c.expiration_date < date('now') AND c.status != 'rejected'
      )`;
    }

    const countRow = queryOne<{ c: number }>(
      `SELECT COUNT(*) as c FROM vendors v ${where}`,
      params
    );
    const total = countRow?.c || 0;

    const vendors = queryAll<VendorRow>(
      `SELECT 
        v.id,
        v.company_name,
        v.contact_name,
        v.contact_email,
        v.status,
        (SELECT COUNT(*) FROM certificates c2 WHERE c2.vendor_id = v.id AND c2.expiration_date > date('now') AND c2.status != 'rejected') as active_cois,
        COALESCE(
          (SELECT 
            CASE 
              WHEN SUM(CASE WHEN cc2.is_compliant = 0 THEN 1 ELSE 0 END) > 0 THEN 'non_compliant'
              WHEN COUNT(cc2.id) > 0 THEN 'compliant'
              ELSE 'no_certs'
            END
           FROM compliance_checks cc2 
           JOIN certificates c3 ON cc2.certificate_id = c3.id 
           WHERE cc2.vendor_id = v.id AND c3.expiration_date > date('now')
          ), 'no_certs'
        ) as compliance_status,
        COALESCE(v.updated_at, v.created_at) as last_updated
      FROM vendors v
      ${where}
      ORDER BY v.company_name ASC
      LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    return { vendors, total, page, perPage };
  }
);

// ──── Route ────

export const Route = createFileRoute("/vendors")({
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  validateSearch: (search: Record<string, string>) => ({
    filter: search.filter || "all",
    q: search.q || "",
    page: parseInt(search.page) || 1,
  }),
  loaderDeps: ({ search }) => ({
    filter: search.filter,
    q: search.q,
    page: search.page,
  }),
  loader: ({ deps }) =>
    getVendors({ data: { search: deps.q, filter: deps.filter, page: deps.page, perPage: 20 } }),
  component: VendorsPage,
});

// ──── Component ────

const filters = [
  { key: "all", label: "All" },
  { key: "compliant", label: "Compliant" },
  { key: "non_compliant", label: "Non-Compliant" },
  { key: "expiring_30", label: "Expiring" },
  { key: "expired", label: "Expired" },
];

function VendorsPage() {
  const data = Route.useLoaderData();
  const { filter, q } = Route.useSearch();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const updateSearch = useCallback(
    (value: string) => {
      setSearchText(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigate({
          to: "/vendors",
          search: { filter, q: value || undefined, page: undefined } as any,
          replace: true,
        });
      }, 300);
    },
    [filter, navigate]
  );

  const setFilter = useCallback(
    (f: string) => {
      navigate({
        to: "/vendors",
        search: { filter: f, q: q || undefined, page: undefined } as any,
        replace: true,
      });
    },
    [q, navigate]
  );

  const setPage = useCallback(
    (p: number) => {
      navigate({
        to: "/vendors",
        search: { filter, q: q || undefined, page: p > 1 ? p : undefined } as any,
        replace: true,
      });
    },
    [filter, q, navigate]
  );

  const totalPages = Math.ceil(data.total / data.perPage);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendors</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {data.total} vendor{data.total !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => updateSearch(e.target.value)}
            placeholder="Search vendors..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table / Empty state */}
      {data.vendors.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-800 mb-4">
            <Building2 className="w-7 h-7 text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">No vendors found</h3>
          <p className="text-zinc-400 text-sm mb-6">
            {q
              ? "No vendors match your search. Try a different term."
              : "Add your first vendor to get started."}
          </p>
          {q && (
            <button
              onClick={() => {
                setSearchText("");
                navigate({
                  to: "/vendors",
                  search: { filter, page: undefined } as any,
                  replace: true,
                });
              }}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                    Company Name
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                    Contact
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                    Active COIs
                  </th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.vendors.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    onClick={() => navigate({ to: `/vendors/${v.id}` })}
                  >
                    <td className="px-4 py-3">
                      <span className="text-white font-medium text-sm">
                        {v.company_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white text-sm">{v.contact_name}</p>
                        <p className="text-zinc-500 text-xs">{v.contact_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={v.compliance_status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{v.active_cois}</td>
                    <td className="px-4 py-3 text-sm text-zinc-500">
                      {formatDate(v.last_updated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {data.vendors.map((v) => (
              <Link
                key={v.id}
                to={`/vendors/${v.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-white font-medium text-sm">
                    {v.company_name}
                  </span>
                  <StatusBadge status={v.compliance_status} />
                </div>
                <div className="text-xs text-zinc-500 space-y-0.5">
                  <p>{v.contact_name}</p>
                  <p>{v.contact_email}</p>
                  <p>
                    {v.active_cois} active COI{v.active_cois !== 1 ? "s" : ""} ·{" "}
                    {formatDate(v.last_updated)}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                Showing {(data.page - 1) * data.perPage + 1}–
                {Math.min(data.page * data.perPage, data.total)} of {data.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(data.page - 1)}
                  disabled={data.page <= 1}
                  className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-zinc-400">
                  {data.page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(data.page + 1)}
                  disabled={data.page >= totalPages}
                  className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "compliant":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium">
          <ShieldCheck className="w-3 h-3" /> Compliant
        </span>
      );
    case "non_compliant":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-xs font-medium">
          <AlertTriangle className="w-3 h-3" /> Action Needed
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-xs font-medium">
          <FileX className="w-3 h-3" /> Expired
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-xs font-medium">
          <Clock className="w-3 h-3" /> No COIs
        </span>
      );
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
