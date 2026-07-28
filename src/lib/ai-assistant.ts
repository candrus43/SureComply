import { getDb, queryAll, queryOne, execute, saveDb } from "./db";
import { coverageLabel } from "./utils";

export interface AIResponse {
  intent: string;
  results: any[];
  rendered: string;
}

// ──── In-memory rate limiter ────

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(sessionId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ──── Main intent parser ────

export async function processQuery(query: string, sessionId: string): Promise<AIResponse> {
  const startTime = Date.now();

  if (!checkRateLimit(sessionId)) {
    return {
      intent: "rate_limited",
      results: [],
      rendered: "You've reached the rate limit. Please wait a moment before trying again.",
    };
  }

  const q = query.toLowerCase().trim();
  let response: AIResponse;

  // Intent 1: Expiring soon / this month
  if (
    /\bexpir(e|ing)\b.*\b(soon|month|30|next)\b/.test(q) ||
    /\b(what|which|certs?).*\bexpir/.test(q)
  ) {
    response = await handleExpiringSoon();
  }
  // Intent 2: Non-compliant / gaps
  else if (
    /\bnon.compliant\b/.test(q) ||
    /\bdon.t meet/.test(q) ||
    /\bgaps?\b/.test(q) ||
    /\bnot compliant\b/.test(q)
  ) {
    response = await handleNonCompliant();
  }
  // Intent 3: Highest risk / prioritise
  else if (
    /\bhighest risk\b/.test(q) ||
    /\bprioriti[sz]e\b/.test(q) ||
    /\bwhat should i focus on\b/.test(q) ||
    /\btop.*risk\b/.test(q)
  ) {
    response = await handleHighestRisk();
  }
  // Intent 4: Summarise vendor (fuzzy name match)
  else if (/\bsummari[sz]e?\b/i.test(q) || /\bsummary\b/i.test(q) || /\btell me about\b/i.test(q)) {
    response = await handleVendorSummary(q);
  }
  // Intent 5: Count / how many
  else if (/\bhow many\b/.test(q) || /\bcount\b/.test(q) || /\bnumber of\b/.test(q)) {
    response = await handleCount(q);
  }
  // Fallback
  else {
    response = {
      intent: "out_of_scope",
      results: [],
      rendered:
        "I can help with: checking expiring certificates, finding non-compliant vendors, prioritising risks, or summarising a vendor. Try asking about a specific vendor or risk area.",
    };
  }

  const latencyMs = Date.now() - startTime;

  // Log to ai_queries
  try {
    await getDb();
    execute(
      `INSERT INTO ai_queries (query_text, response_text, result_refs, status, latency_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [query, response.rendered, JSON.stringify(response.results), response.intent === "out_of_scope" ? "out_of_scope" : "answered", latencyMs]
    );
    saveDb();
  } catch (e) {
    // Non-critical
  }

  return response;
}

// ──── Intent handlers ────

async function handleExpiringSoon(): Promise<AIResponse> {
  await getDb();
  const rows = queryAll<any>(
    `SELECT c.id as cert_id, c.file_name, c.expiration_date, c.policy_number,
            v.id as vendor_id, v.company_name
     FROM certificates c
     JOIN vendors v ON c.vendor_id = v.id
     WHERE c.expiration_date BETWEEN date('now') AND date('now', '+30 days')
       AND c.status != 'rejected'
     ORDER BY c.expiration_date ASC`
  );

  if (rows.length === 0) {
    return {
      intent: "expiring_soon",
      results: [],
      rendered: "✅ No certificates are expiring in the next 30 days.",
    };
  }

  const lines = rows.map((r: any) => {
    const daysLeft = Math.ceil(
      (new Date(r.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const emoji = daysLeft <= 7 ? "🔴" : daysLeft <= 14 ? "🟡" : "🟢";
    return `${emoji} **${r.company_name}** — ${r.file_name || "COI"} expires ${r.expiration_date} (${daysLeft} day${daysLeft !== 1 ? "s" : ""}) [cert:${r.cert_id}]`;
  });

  return {
    intent: "expiring_soon",
    results: rows.map((r: any) => ({ type: "certificate", id: r.cert_id, vendor_id: r.vendor_id })),
    rendered: `📋 **${rows.length} certificate${rows.length !== 1 ? "s" : ""} expiring in the next 30 days:**\n\n${lines.join("\n")}`,
  };
}

async function handleNonCompliant(): Promise<AIResponse> {
  await getDb();
  const rows = queryAll<any>(
    `SELECT DISTINCT v.id as vendor_id, v.company_name, cc.explanation, cc.coverage_type
     FROM compliance_checks cc
     JOIN vendors v ON cc.vendor_id = v.id
     JOIN certificates c ON cc.certificate_id = c.id
     WHERE cc.is_compliant = 0 AND c.status != 'rejected'
     ORDER BY v.company_name`
  );

  if (rows.length === 0) {
    return {
      intent: "non_compliant",
      results: [],
      rendered: "✅ All vendors are compliant. No gaps found.",
    };
  }

  const lines = rows.map((r: any) =>
    `❌ **${r.company_name}** — ${r.explanation || `${coverageLabel(r.coverage_type)}: non-compliant`} [vendor:${r.vendor_id}]`
  );

  return {
    intent: "non_compliant",
    results: rows.map((r: any) => ({ type: "vendor", id: r.vendor_id })),
    rendered: `⚠️ **${rows.length} vendor${rows.length !== 1 ? "s" : ""} with compliance gaps:**\n\n${lines.join("\n")}`,
  };
}

async function handleHighestRisk(): Promise<AIResponse> {
  await getDb();
  const rows = queryAll<any>(
    `SELECT v.id as vendor_id, v.company_name,
            COALESCE(expired.cnt, 0) * 3 +
            COALESCE(exp30.cnt, 0) * 2 +
            COALESCE(non.cnt, 0) * 3 as risk_score
     FROM vendors v
     LEFT JOIN (
       SELECT vendor_id, COUNT(*) as cnt FROM certificates
       WHERE expiration_date < date('now') AND status != 'rejected'
       GROUP BY vendor_id
     ) expired ON v.id = expired.vendor_id
     LEFT JOIN (
       SELECT vendor_id, COUNT(*) as cnt FROM certificates
       WHERE expiration_date BETWEEN date('now') AND date('now', '+30 days') AND status != 'rejected'
       GROUP BY vendor_id
     ) exp30 ON v.id = exp30.vendor_id
     LEFT JOIN (
       SELECT vendor_id, COUNT(*) as cnt FROM compliance_checks cc
       JOIN certificates c ON cc.certificate_id = c.id
       WHERE cc.is_compliant = 0 AND c.status != 'rejected'
       GROUP BY vendor_id
     ) non ON v.id = non.vendor_id
     WHERE v.status = 'active'
     HAVING risk_score > 0
     ORDER BY risk_score DESC
     LIMIT 5`
  );

  if (rows.length === 0) {
    return {
      intent: "highest_risk",
      results: [],
      rendered: "✅ No high-risk vendors detected. Everything looks good!",
    };
  }

  const lines = rows.map((r: any, i: number) => {
    const icons = ["🔴", "🟠", "🟡", "🔵", "⚪"];
    return `${icons[i] || "⚪"} **${r.company_name}** — Risk Score: ${r.risk_score} [vendor:${r.vendor_id}]`;
  });

  return {
    intent: "highest_risk",
    results: rows.map((r: any) => ({ type: "vendor", id: r.vendor_id })),
    rendered: `🎯 **Top ${rows.length} highest-risk vendors:**\n\n${lines.join("\n")}\n\nRisk score = Expired×3 + Expiring(30d)×2 + Non-Compliant×3`,
  };
}

async function handleVendorSummary(q: string): Promise<AIResponse> {
  await getDb();

  // Extract vendor name by removing intent words
  const vendorName = q
    .replace(/\bsummari[sz]e?\b|\bsummary\b|\btell me about\b|\bwhat can you tell me about\b/gi, "")
    .replace(/['']/g, "")
    .trim();

  if (!vendorName || vendorName.length < 2) {
    return {
      intent: "vendor_summary",
      results: [],
      rendered: "Which vendor would you like me to summarise? Try: \"Summarise ABC Roofing\"",
    };
  }

  // Fuzzy match with ILIKE
  const vendor = queryOne<any>(
    `SELECT id, company_name, contact_name, contact_email, status, created_at
     FROM vendors WHERE LOWER(company_name) LIKE ? AND status = 'active'
     LIMIT 1`,
    [`%${vendorName}%`]
  );

  if (!vendor) {
    return {
      intent: "vendor_summary",
      results: [],
      rendered: `I couldn't find a vendor matching "${vendorName}". Try using a more specific name from your vendor list.`,
    };
  }

  // Get certificates
  const certs = queryAll<any>(
    `SELECT id, file_name, status, expiration_date, policy_number, carrier_name, created_at
     FROM certificates WHERE vendor_id = ? AND status != 'rejected'
     ORDER BY created_at DESC`,
    [vendor.id]
  );

  // Get compliance status
  const checks = queryAll<any>(
    `SELECT cc.coverage_type, cc.is_compliant, cc.explanation
     FROM compliance_checks cc
     JOIN certificates c ON cc.certificate_id = c.id
     WHERE cc.vendor_id = ? AND c.status != 'rejected'
     ORDER BY cc.created_at DESC`,
    [vendor.id]
  );

  const compliantCount = checks.filter((c: any) => c.is_compliant).length;
  const nonCompliantCount = checks.filter((c: any) => !c.is_compliant).length;
  const activeCerts = certs.filter((c: any) => c.status !== "expired").length;

  let rendered = `📋 **${vendor.company_name}** [vendor:${vendor.id}]\n`;
  rendered += `Contact: ${vendor.contact_name || "N/A"} | ${vendor.contact_email || "N/A"}\n`;
  rendered += `Vendor since: ${vendor.created_at?.split("T")[0] || "N/A"}\n\n`;
  rendered += `📊 **Compliance Snapshot**\n`;
  rendered += `• Compliant checks: ${compliantCount}\n`;
  rendered += `• Non-compliant: ${nonCompliantCount}\n`;
  rendered += `• Active certificates: ${activeCerts}\n\n`;

  if (nonCompliantCount > 0) {
    rendered += `⚠️ **Gaps:**\n`;
    const latestGaps = checks
      .filter((c: any) => !c.is_compliant)
      .slice(0, 3);
    for (const g of latestGaps) {
      rendered += `• ${g.explanation || coverageLabel(g.coverage_type)}\n`;
    }
    rendered += "\n";
  }

  if (certs.length > 0) {
    rendered += `📄 **Recent Certificates:**\n`;
    for (const c of certs.slice(0, 5)) {
      const exp = c.expiration_date ? ` — Expires: ${c.expiration_date}` : "";
      rendered += `• ${c.file_name || "COI"} (${c.status})${exp} [cert:${c.id}]\n`;
    }
  } else {
    rendered += `📄 No certificates uploaded yet.\n`;
  }

  return {
    intent: "vendor_summary",
    results: [
      { type: "vendor", id: vendor.id },
      ...certs.slice(0, 5).map((c: any) => ({ type: "certificate", id: c.id })),
    ],
    rendered,
  };
}

async function handleCount(q: string): Promise<AIResponse> {
  await getDb();

  const totalVendors =
    queryOne<{ c: number }>("SELECT COUNT(*) as c FROM vendors WHERE status = 'active'")?.c || 0;
  const totalCerts =
    queryOne<{ c: number }>("SELECT COUNT(*) as c FROM certificates WHERE status != 'rejected'")?.c || 0;
  const expired =
    queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM certificates WHERE expiration_date < date('now') AND status != 'rejected'"
    )?.c || 0;
  const expiring30 =
    queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM certificates WHERE expiration_date BETWEEN date('now') AND date('now', '+30 days') AND status != 'rejected'"
    )?.c || 0;
  const nonCompliant =
    queryOne<{ c: number }>(
      `SELECT COUNT(DISTINCT cc.vendor_id) as c FROM compliance_checks cc
       JOIN certificates c ON cc.certificate_id = c.id
       WHERE cc.is_compliant = 0 AND c.status != 'rejected'`
    )?.c || 0;

  return {
    intent: "count",
    results: [],
    rendered:
      `📊 **SureComply Overview**\n\n` +
      `• Total active vendors: **${totalVendors}**\n` +
      `• Total certificates: **${totalCerts}**\n` +
      `• Expired certificates: **${expired}**\n` +
      `• Expiring in 30 days: **${expiring30}**\n` +
      `• Vendors with compliance gaps: **${nonCompliant}**`,
  };
}
