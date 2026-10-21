/**
 * `<nx-documents>`: la lógica sin DOM. El estado de cada documento con la fecha de hoy, el orden
 * (lo que falta primero) y el resumen para una pestaña o un aviso.
 */
import type { DocumentItem, DocumentKind, DocumentsLabels, DocumentState, DocumentStateKey, DocumentStatus, DocumentsSummary, DocumentUse } from "./types";

/** Desde cuántos días antes un documento está «por vencer». */
export const DOCUMENTS_SOON = 60;
const STATUSES = new Set<DocumentStatus>(["ok", "missing", "review", "rejected"]);
const KINDS = new Set<DocumentKind>(["id", "page", "passport", "card", "photo", "signature", "stack", "medical"]);
const ISO = /^\d{4}-\d{2}-\d{2}/;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const iso = (v: unknown): string | undefined => (typeof v === "string" && ISO.test(v) ? v.slice(0, 10) : undefined);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** Los documentos como llegan → limpios. Sin `id` o sin `name` no sirven; un `id` repetido se ignora. */
export function cleanDocuments(v: unknown): DocumentItem[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: DocumentItem[] = [];
  for (const raw of v) {
    if (!isObj(raw)) continue;
    const id = str(raw.id);
    const name = str(raw.name);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const d: DocumentItem = { id, name, status: STATUSES.has(raw.status as DocumentStatus) ? (raw.status as DocumentStatus) : "ok" };
    if (KINDS.has(raw.kind as DocumentKind)) d.kind = raw.kind as DocumentKind;
    for (const k of ["thumbnail", "detail", "reason", "addedBy", "note", "href"] as const) if (str(raw[k])) d[k] = str(raw[k]);
    for (const k of ["expires", "issued", "addedAt"] as const) if (iso(raw[k])) d[k] = iso(raw[k]);
    const asked = strs(raw.askedBy);
    if (asked.length) d.askedBy = asked;
    const checks = strs(raw.checks);
    if (checks.length) d.checks = checks;
    if (Array.isArray(raw.uses)) {
      const uses = raw.uses.filter(isObj).map((u): DocumentUse | null => (iso(u.at) && str(u.by) ? { at: iso(u.at)!, by: str(u.by), ...(str(u.purpose) ? { purpose: str(u.purpose) } : {}) } : null)).filter((u): u is DocumentUse => !!u);
      if (uses.length) d.uses = uses.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    }
    if (Array.isArray(raw.fields)) {
      const fields = raw.fields.filter(isObj).filter((f) => str(f.label) && str(f.value)).map((f) => ({ label: str(f.label), value: str(f.value) }));
      if (fields.length) d.fields = fields;
    }
    if (raw.replaceable === false) d.replaceable = false;
    out.push(d);
  }
  return out;
}

/** Días entre dos fechas ISO (sin horas: el cambio de horario no corre un día). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** Hoy en ISO, con la hora local. */
export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** Qué estado tiene, sin textos: lo que falta o se rechazó primero, luego el vencimiento con la
 *  fecha de hoy (un vencido gana a «en revisión»). */
export function stateKey(d: DocumentItem, today: string, soon = DOCUMENTS_SOON): { key: DocumentStateKey; days?: number } {
  const status = d.status ?? "ok";
  if (status === "missing" || status === "rejected") return { key: status };
  const days = d.expires ? daysBetween(today, d.expires) : undefined;
  if (days !== undefined && days < 0) return { key: "expired", days };
  if (status === "review") return { key: "review", days };
  if (days !== undefined && days <= soon) return { key: "expiring", days };
  return { key: "ok", days };
}

const TONE: Record<DocumentStateKey, DocumentState["tone"]> = { missing: "warning", rejected: "danger", expired: "danger", review: "info", expiring: "warning", ok: "success" };

/** El estado que se ve, con su texto: «Falta», «Vence en 49 días», «Vigente hasta 14 oct 2036»… */
export function documentState(d: DocumentItem, today: string, L: DocumentsLabels, date: (iso: string) => string, soon = DOCUMENTS_SOON): DocumentState {
  const { key, days } = stateKey(d, today, soon);
  let label: string;
  switch (key) {
    case "missing":
      label = L.missing;
      break;
    case "rejected":
      label = L.rejected;
      break;
    case "expired":
      label = L.expired;
      break;
    case "review":
      label = L.review;
      break;
    case "expiring":
      label = days === 0 ? L.expiresToday : days === 1 ? L.expiresTomorrow : fill(L.expiresIn, { n: days! });
      break;
    default:
      label = d.expires ? fill(L.validUntil, { date: date(d.expires) }) : L.valid;
  }
  return days === undefined ? { key, tone: TONE[key], label } : { key, tone: TONE[key], label, days };
}

const RANK: Record<DocumentStateKey, number> = { missing: 0, rejected: 0, expired: 1, expiring: 2, review: 3, ok: 4 };

/** Lo que pide atención primero (falta o se rechazó, vencido, por vencer, en revisión), y dentro de
 *  cada grupo el orden en que llegaron. */
export function sortDocuments(items: readonly DocumentItem[], today: string, soon = DOCUMENTS_SOON): DocumentItem[] {
  return items
    .map((d, i) => ({ d, i, r: RANK[stateKey(d, today, soon).key] }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.d);
}

/** Cuántos hay de cada cosa que pide atención. */
export function documentsSummary(items: readonly DocumentItem[], today: string, soon = DOCUMENTS_SOON): DocumentsSummary {
  const out: DocumentsSummary = { total: items.length, missing: 0, rejected: 0, expired: 0, expiring: 0, review: 0 };
  for (const d of items) {
    const k = stateKey(d, today, soon).key;
    if (k !== "ok") out[k]++;
  }
  return out;
}

/** El resumen en palabras: «Faltan 2 · 1 por vencer», o `sumOk` si no hay nada. */
export function summaryText(s: DocumentsSummary, L: DocumentsLabels): string {
  const missing = s.missing + s.rejected;
  const parts = [
    missing === 1 ? L.sumMissingOne : missing > 1 ? fill(L.sumMissing, { n: missing }) : "",
    s.expired === 1 ? L.sumExpiredOne : s.expired ? fill(L.sumExpired, { n: s.expired }) : "",
    s.expiring ? fill(L.sumExpiring, { n: s.expiring }) : "",
    s.review ? fill(L.sumReview, { n: s.review }) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : L.sumOk;
}

/** Qué tanto de la vigencia ya pasó (0 a 1), si se sabe desde cuándo y hasta cuándo. */
export function elapsed(d: DocumentItem, today: string): number | null {
  if (!d.issued || !d.expires) return null;
  const total = daysBetween(d.issued, d.expires);
  if (total <= 0) return null;
  return Math.max(0, Math.min(1, daysBetween(d.issued, today) / total));
}
