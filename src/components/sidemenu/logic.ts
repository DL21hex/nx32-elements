/**
 * Lógica pura del sidemenu: sin DOM, para probarse en node. Portada de nx32
 * (`utils/menu-landing.ts`, `components/menu-flyout-keys.ts`, `utils/nav-active.ts`).
 */
import { foldText as fold } from "../../core/text";
import type { MenuItem } from "./types";

export { listKeyStep as flyoutKeyStep, type KeyStep } from "../../core/keys";

/** Minúsculas y sin tildes, recortado: la forma de comparar una consulta. */
export function foldText(text: string): string {
  return fold(text).trim();
}

/** Con pocos hijos un buscador estorba: se ven todos de un vistazo. Solo con MÁS de este número. */
export const SEARCH_MIN_CHILDREN = 3;

export function panelHasSearch(children: readonly unknown[]): boolean {
  return children.length > SEARCH_MIN_CHILDREN;
}

/** Los ítems cuyo nombre o descripción contienen la consulta; vacía ⇒ todos. */
export function filterItems(items: readonly MenuItem[], query: string): MenuItem[] {
  const q = foldText(query);
  if (!q) return items.filter((c) => c && typeof c === "object");
  // `label` y `description` vienen del backend: un número o un `null` no rompen la búsqueda.
  return items.filter((c) => c && typeof c === "object" && (foldText(String(c.label ?? "")).includes(q) || foldText(String(c.description ?? "")).includes(q)));
}

export interface MenuGroup<T = MenuItem> {
  label: string | null;
  items: T[];
}

/** Agrupa por `section` en orden de aparición; sin secciones, un único grupo sin título. */
export function groupBySection<T extends { section?: string }>(items: readonly T[]): MenuGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const key = it.section ?? "";
    const list = groups.get(key);
    if (list) list.push(it);
    else groups.set(key, [it]);
  }
  return [...groups].map(([label, list]) => ({ label: label || null, items: list }));
}

/** Desde cuántos hijos (sin contar los chips del pie) el panel flotante va en dos columnas. Con menos,
 *  una sola columna cabe en su alto (440 px) sin desplazarse, aun con títulos de sección. */
export const TWO_COLUMNS_MIN_CHILDREN = 12;

/** Un grupo dentro de una columna. `cont`: sigue al grupo con el que termina la columna anterior
 *  (no repite el título). */
export interface PanelGroup<T = MenuItem> extends MenuGroup<T> {
  cont: boolean;
}

/** El alto relativo de una fila del panel (una con descripción es más alta) y el de un título. */
function rowWeight(it: { description?: unknown }): number {
  return it.description ? 1.6 : 1;
}
const HEADER_WEIGHT = 0.8;
/** Lo que se tolera de desbalance para no partir una sección en dos columnas. */
const SPLIT_PENALTY = 2;

/**
 * Reparte los grupos del panel en columnas. Con `max` 1, o con menos de `TWO_COLUMNS_MIN_CHILDREN`
 * hijos, una sola. Si no, dos que se leen en orden (la primera, de arriba abajo, y luego la segunda),
 * cortadas donde las alturas quedan más parejas. El corte cae entre secciones; solo parte una sección
 * (la segunda columna la continúa sin repetir el título) si así se evita un desbalance de más de dos
 * filas, como una sección enorme junto a otra corta. Sin secciones, la lista se parte por la mitad.
 */
export function panelColumns<T extends { description?: unknown }>(groups: readonly MenuGroup<T>[], max: 1 | 2): PanelGroup<T>[][] {
  const whole = groups.map((g) => ({ ...g, cont: false }));
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  if (max < 2 || count < TWO_COLUMNS_MIN_CHILDREN) return [whole];

  const weights = groups.map((g) => g.items.map(rowWeight));
  const total = groups.reduce((n, g, gi) => n + (g.label ? HEADER_WEIGHT : 0) + weights[gi].reduce((a, b) => a + b, 0), 0);
  // Cada corte posible: antes de la fila `i` del grupo `gi` (i = 0 es entre secciones). La primera
  // columna nunca queda vacía ni termina en un título suelto.
  let best = { gi: 0, i: 0, cost: Infinity, left: 0 };
  let left = 0;
  groups.forEach((g, gi) => {
    if (g.label) left += HEADER_WEIGHT;
    weights[gi].forEach((w, i) => {
      const atStart = i === 0;
      const cut = atStart ? left - (g.label ? HEADER_WEIGHT : 0) : left;
      if (cut > 0) {
        const cost = Math.max(cut, total - cut) + (atStart ? 0 : SPLIT_PENALTY);
        // Empate: gana la primera columna más alta (se lee primero).
        if (cost < best.cost || (cost === best.cost && cut > best.left)) best = { gi, i, cost, left: cut };
      }
      left += w;
    });
  });
  if (best.cost === Infinity) return [whole];

  const first: PanelGroup<T>[] = whole.slice(0, best.gi);
  const second: PanelGroup<T>[] = whole.slice(best.gi + 1);
  const g = groups[best.gi];
  if (best.i === 0) second.unshift({ ...g, cont: false });
  else {
    first.push({ label: g.label, items: g.items.slice(0, best.i), cont: false });
    second.unshift({ label: g.label, items: g.items.slice(best.i), cont: true });
  }
  return [first, second];
}

/** El texto de un badge, o `null` si no hay nada que mostrar: `0`, negativos, vacío. */
export function formatBadge(value: unknown): string | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? (value > 99 ? "99+" : String(Math.floor(value))) : null;
  if (typeof value === "string") return value.trim() || null;
  return null;
}

/** Reparte los hijos en pantallas de trabajo y utilitarios, cada grupo en su orden original. */
export function splitUtility<T extends { utility?: boolean }>(items: readonly T[]): { work: T[]; utilities: T[] } {
  const work: T[] = [];
  const utilities: T[] = [];
  for (const c of items) (c.utility ? utilities : work).push(c);
  return { work, utilities };
}

/** La ruta de un href para comparar: sin query ni hash, sin barra final, y sin un último
 *  segmento `index…` (`/ventas/index.html`, `/sig/docs/index__for_employees` → su carpeta). */
function basePath(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  let path = href.split(/[?#]/)[0].replace(/\/+$/, "");
  path = path.replace(/\/index(?:[._][^/]*)?$/, "");
  return path || "/";
}

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export interface ActiveMatch {
  /** El ítem (hoja) activo, o `null`. */
  item: MenuItem | null;
  /** Los padres que lo contienen, del más externo al más interno. */
  trail: MenuItem[];
}

/**
 * Qué ítem corresponde a `active` (un href o un id). Gana, en orden:
 * 1. un `href` idéntico;
 * 2. un `id` idéntico;
 * 3. el `href` cuya ruta base es el prefijo más largo, por segmentos, de `active`
 *    (`/ventas/pedidos/42` enciende `/ventas/pedidos`, nunca `/ventas/pedidos-viejos`);
 * 4. el `id` de un PADRE: enciende al padre sin hoja activa. Es para una pantalla que pertenece a
 *    un grupo pero no es ninguno de sus hijos (una ficha de detalle, una página interna).
 */
export function resolveActive(items: readonly MenuItem[], active: string | null | undefined): ActiveMatch {
  const none: ActiveMatch = { item: null, trail: [] };
  if (!active) return none;

  const leaves: { item: MenuItem; trail: MenuItem[] }[] = [];
  const parents: MenuItem[][] = [];
  const walk = (list: readonly MenuItem[], trail: MenuItem[]) => {
    for (const it of list) {
      if (!it || typeof it !== "object") continue;
      if (it.children?.length) {
        parents.push([...trail, it]);
        walk(it.children, [...trail, it]);
      } else leaves.push({ item: it, trail });
    }
  };
  walk(items, []);

  const byHref = leaves.find((l) => l.item.href === active);
  if (byHref) return byHref;
  const byId = leaves.find((l) => l.item.id === active);
  if (byId) return byId;

  const byParentId = () => {
    const path = parents.find((p) => p[p.length - 1].id === active);
    return path ? { item: null, trail: path } : none;
  };

  const target = basePath(active);
  if (!target) return byParentId();
  const targetSegs = segments(target);
  let best: { item: MenuItem; trail: MenuItem[] } | null = null;
  let bestLen = -1;
  for (const l of leaves) {
    const base = l.item.href ? basePath(l.item.href) : null;
    if (!base) continue;
    const segs = segments(base);
    if (segs.length > targetSegs.length || segs.length <= bestLen) continue;
    if (segs.every((s, i) => s === targetSegs[i])) {
      best = l;
      bestLen = segs.length;
    }
  }
  // La raíz "/" solo gana si `active` es exactamente la raíz: si no, todo encendería «Inicio».
  if (best && bestLen === 0 && targetSegs.length > 0) best = null;
  return best ?? byParentId();
}
