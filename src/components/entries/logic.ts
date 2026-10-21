/**
 * `<nx-entries>`: la lógica sin DOM. Limpia lo que llega del backend y dice si un esquema son campos
 * o secciones.
 */
import type { EntriesLayout, EntriesSchema, EntryItem, EntryNote, EntryTag, EntryTone } from "./types";

const TONES = new Set<EntryTone>(["neutral", "info", "success", "warning", "danger"]);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function cleanTone(v: unknown, fallback: EntryTone = "neutral"): EntryTone {
  return typeof v === "string" && TONES.has(v as EntryTone) ? (v as EntryTone) : fallback;
}

export function cleanLayout(v: unknown): EntriesLayout {
  return v === "cards" || v === "timeline" ? v : "list";
}

function cleanTags(v: unknown): EntryTag[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((t): EntryTag | null => {
      if (typeof t === "string" || typeof t === "number") return str(t) ? { label: str(t) } : null;
      if (!isObj(t) || !str(t.label)) return null;
      return str(t.icon) ? { label: str(t.label), icon: str(t.icon) } : { label: str(t.label) };
    })
    .filter((t): t is EntryTag => !!t);
}

function cleanNote(v: unknown): EntryNote | undefined {
  if (typeof v === "string") return str(v) ? { text: str(v), tone: "warning" } : undefined;
  if (!isObj(v) || !str(v.text)) return undefined;
  const out: EntryNote = { text: str(v.text), tone: cleanTone(v.tone, "warning") };
  if (str(v.action)) out.action = str(v.action);
  return out;
}

/**
 * Los registros como llegan (BDUI: JSON) → limpios. Sin `id` o sin `title` no sirven; un `id`
 * repetido se queda con el primero. Los textos van siempre como texto.
 */
export function cleanEntries(v: unknown): EntryItem[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: EntryItem[] = [];
  for (const raw of v) {
    if (!isObj(raw)) continue;
    const id = str(raw.id);
    const title = str(raw.title);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const item: EntryItem = { id, title };
    for (const k of ["meta", "detail", "avatar", "icon", "badge", "proof", "removeText"] as const) if (str(raw[k])) item[k] = str(raw[k]);
    if (item.badge) item.badgeTone = cleanTone(raw.badgeTone);
    const tags = cleanTags(raw.tags);
    if (tags.length) item.tags = tags;
    const note = cleanNote(raw.note);
    if (note) item.note = note;
    if (raw.locked === true || str(raw.locked)) item.locked = raw.locked === true ? true : str(raw.locked);
    if (raw.removable === false) item.removable = false;
    if (isObj(raw.values)) item.values = raw.values as EntryItem["values"];
    out.push(item);
  }
  return out;
}

/** Un esquema son secciones si sus elementos traen `fields`; si no, son campos. */
export function isSections(schema: EntriesSchema | null | undefined): boolean {
  return Array.isArray(schema) && schema.length > 0 && isObj(schema[0]) && Array.isArray((schema[0] as Record<string, unknown>).fields);
}

/** Los `id` que no estaban antes (para iluminar lo que se acaba de agregar). */
export function newIds(before: readonly EntryItem[], after: readonly EntryItem[]): string[] {
  const had = new Set(before.map((x) => x.id));
  return after.filter((x) => !had.has(x.id)).map((x) => x.id);
}

/** «Editar {title}» → «Editar Sofía Pérez». */
export function fillTitle(template: string, title: string): string {
  return template.replace("{title}", title);
}
