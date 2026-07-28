import * as fs from "fs";

// ACORD 25 regex-based extraction
// This is a rule-based parser that works with extracted PDF text

interface ExtractedCoverage {
  type: string;
  limit: number | null;
  limit_raw: string;
}

interface ExtractionResult {
  carrier_name: string | null;
  policy_number: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  named_insured: string | null;
  additional_insured: boolean;
  certificate_holder: string | null;
  producer_name: string | null;
  producer_contact: string | null;
  coverages: ExtractedCoverage[];
}

export async function extractFromFile(filePath: string): Promise<ExtractionResult> {
  const text = await readFileText(filePath);

  const result: ExtractionResult = {
    carrier_name: extractCarrier(text),
    policy_number: extractPolicyNumber(text),
    effective_date: extractEffectiveDate(text),
    expiration_date: extractExpirationDate(text),
    named_insured: extractNamedInsured(text),
    additional_insured: checkAdditionalInsured(text),
    certificate_holder: extractCertificateHolder(text),
    producer_name: extractProducerName(text),
    producer_contact: extractProducerContact(text),
    coverages: extractCoverages(text),
  };

  return result;
}

async function readFileText(filePath: string): Promise<string> {
  const ext = filePath.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const buffer = fs.readFileSync(filePath);
    return extractTextFromPdfBuffer(buffer);
  }

  // For images, we can't extract text without OCR — return empty
  // The user will need to manually enter data
  if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
    return `[IMAGE: ${filePath}]`;
  }

  // Plain text fallback
  return fs.readFileSync(filePath, "utf-8");
}

function extractTextFromPdfBuffer(_buffer: Buffer): string {
  // Very basic: look for text between stream/endstream and BT/ET blocks
  // This is a best-effort fallback
  const str = _buffer.toString("latin1");
  const textBlocks: string[] = [];

  // Find BT...ET blocks
  const btRegex = /BT\s*([\s\S]*?)\s*ET/g;
  let match;
  while ((match = btRegex.exec(str)) !== null) {
    // Extract text from Tj, TJ, ' operators
    const content = match[1];
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(content)) !== null) {
      textBlocks.push(tjMatch[1]);
    }
  }

  return textBlocks.join("\n");
}

// ──── Extraction helpers ────

function extractCarrier(text: string): string | null {
  // Look for common ACORD patterns
  const patterns = [
    /INSURER\s*A?\s*:?\s*(.+?)(?:\n|$)/i,
    /INSURANCE\s+COMPANY\s*:?\s*(.+?)(?:\n|$)/i,
    /COMPANY\s*:?\s*(.+?)(?:\n|$)/i,
    /CARRIER\s*:?\s*(.+?)(?:\n|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]?.trim()?.length > 2) return m[1].trim();
  }
  return null;
}

function extractPolicyNumber(text: string): string | null {
  const patterns = [
    /POLICY\s+NUMBER\s*:?\s*([A-Z0-9\-]+)/i,
    /POLICY\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
    /Policy\s+No\.?\s*:?\s*([A-Z0-9\-]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]?.trim().length > 2) return m[1].trim();
  }
  return null;
}

function extractEffectiveDate(text: string): string | null {
  const patterns = [
    /EFFECTIVE\s+DATE\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /EFFECTIVE\s+DATE\s*:?\s*([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})/i,
    /EFFECTIVE\s+DATE\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return normalizeDate(m[1].trim());
  }
  return null;
}

function extractExpirationDate(text: string): string | null {
  const patterns = [
    /EXPIRATION\s+DATE\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /EXPIRATION\s+DATE\s*:?\s*([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})/i,
    /EXPIRATION\s+DATE\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
    /EXPIRES?\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return normalizeDate(m[1].trim());
  }
  return null;
}

function extractNamedInsured(text: string): string | null {
  const patterns = [
    /NAMED\s+INSURED\s*:?\s*(.+?)(?:\n\s*\n|\n[A-Z])/is,
    /INSURED\s*:?\s*(.+?)(?:\n|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]?.trim()?.length > 2) return m[1].trim().substring(0, 200);
  }
  return null;
}

function checkAdditionalInsured(text: string): boolean {
  return /ADDITIONAL\s+INSURED/i.test(text) && !/ADDITIONAL\s+INSURED\s*:?\s*No/i.test(text);
}

function extractCertificateHolder(text: string): string | null {
  const patterns = [
    /CERTIFICATE\s+HOLDER\s*:?\s*(.+?)(?:\n\s*\n|\n[A-Z])/is,
    /HOLDER\s*:?\s*(.+?)(?:\n|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]?.trim()?.length > 2) return m[1].trim().substring(0, 300);
  }
  return null;
}

function extractProducerName(text: string): string | null {
  const patterns = [
    /PRODUCER\s*:?\s*(.+?)(?:\n|$)/i,
    /AGENT\s*:?\s*(.+?)(?:\n|$)/i,
    /BROKER\s*:?\s*(.+?)(?:\n|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]?.trim()?.length > 2) return m[1].trim().substring(0, 200);
  }
  return null;
}

function extractProducerContact(text: string): string | null {
  // Try to find address/phone after producer
  const producerMatch = text.match(/PRODUCER[\s\S]{0,500}?(?:PHONE|TEL|FAX)\s*:?\s*([\d\s\-().]+)/i);
  if (producerMatch) return producerMatch[1].trim();
  return null;
}

// ──── Coverage extraction ────

const COVERAGE_KEYWORDS: Record<string, string[]> = {
  general_liability: ["general liability", "commercial general liability", "CGL", "each occurrence", "general aggregate"],
  workers_comp: ["workers compensation", "workers' compensation", "WC statutory", "employers liability"],
  auto_liability: ["automobile liability", "auto liability", "business auto", "combined single limit"],
  umbrella_excess: ["umbrella", "excess liability", "umbrella liability", "excess"],
  professional_liability: ["professional liability", "errors and omissions", "E&O", "professional"],
  pollution_liability: ["pollution liability", "pollution", "environmental"],
  builders_risk: ["builders risk", "builder's risk", "course of construction"],
  cyber_liability: ["cyber liability", "cyber", "data breach", "privacy"],
};

function extractCoverages(text: string): ExtractedCoverage[] {
  const coverages: ExtractedCoverage[] = [];

  // Look for the coverage table (common in ACORD 25)
  // Types: GL, AUTO, UMBRELLA, WC, etc. followed by limits
  const lines = text.split("\n");

  for (const [covType, keywords] of Object.entries(COVERAGE_KEYWORDS)) {
    for (const kw of keywords) {
      // Look through the text for keyword + nearby dollar amounts
      const idx = text.toLowerCase().indexOf(kw.toLowerCase());
      if (idx >= 0) {
        // Extract nearby dollar amounts
        const context = text.substring(Math.max(0, idx - 50), idx + 200);
        const limit = extractDollarAmount(context);
        if (limit != null || coverages.every(c => c.type !== covType)) {
          coverages.push({
            type: covType,
            limit,
            limit_raw: limit != null ? `$${limit.toLocaleString()}` : "Unknown",
          });
        }
        break; // Found this coverage type
      }
    }
  }

  // If we didn't find coverages via keywords, try to parse the table structure
  if (coverages.length === 0) {
    // Look for number patterns that look like dollar amounts near coverage labels
    const dollarRegex = /\$\s*([\d,]+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/|per|each)/gi;
    // This is a simplified approach — production would need more sophisticated parsing
  }

  return coverages;
}

function extractDollarAmount(text: string): number | null {
  // $2,000,000 or $2000000 or 2M or 500K
  const patterns = [
    /\$\s*([\d,]+(?:,\d{3})*(?:\.\d{2})?)/,
    /(\d[\d,]*)\s*(?:million|M)/i,
    /(\d[\d,]*)\s*(?:thousand|K)/i,
    /(\d{5,})\b/, // raw numbers >= 10000 are likely dollar amounts
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = m[1].replace(/,/g, "");
      const num = parseFloat(val);
      if (!isNaN(num)) {
        if (/M/i.test(m[0])) return Math.round(num * 1_000_000);
        if (/K/i.test(m[0])) return Math.round(num * 1_000);
        return Math.round(num);
      }
    }
  }

  return null;
}

function normalizeDate(dateStr: string): string {
  // Try MM/DD/YYYY
  let m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    return `${year}-${String(parseInt(m[1])).padStart(2, "0")}-${String(parseInt(m[2])).padStart(2, "0")}`;
  }

  // Try Month DD, YYYY
  m = dateStr.match(/^([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (m) {
    const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const monthIdx = months.indexOf(m[1].toLowerCase());
    if (monthIdx >= 0) {
      return `${m[3]}-${String(monthIdx + 1).padStart(2, "0")}-${String(parseInt(m[2])).padStart(2, "0")}`;
    }
  }

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  return dateStr;
}
