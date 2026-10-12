/**
 * La lógica de `<nx-parts>`, sin DOM: qué partes se pintan, con qué color y cuánto suman.
 */
import { foldOthers, slotOf } from "../../core/chart";
import type { PartItem, ShownPart } from "./types";

/** Cuántas partes caben antes de plegar en «Otros» (las ocho de la paleta). */
export const MAX_PARTS = 8;

const isSlot = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 8;

/**
 * Las partes que se pintan: sin las que no tienen nombre ni las de valor negativo o no finito, en el
 * orden que llegan (la app decide el orden). El color es su `slot` o, si no trae, su posición. Más
 * de ocho: desde la octava se pliegan en una sola `other` con el color atenuado.
 */
export function shownParts(input: unknown, other: string): { parts: ShownPart[]; total: number } {
  const list = (Array.isArray(input) ? input : []).filter(
    (p): p is PartItem => !!p && typeof p === "object" && typeof p.label === "string" && typeof p.value === "number" && Number.isFinite(p.value) && p.value >= 0,
  );
  const shown: ShownPart[] = list.map((item, i) => ({ item, slot: isSlot(item.slot) ? String(item.slot) : slotOf(i) }));
  const parts = foldOthers(shown, MAX_PARTS, (rest) => ({
    item: { id: "", label: other, value: rest.reduce((s, p) => s + p.item.value, 0) },
    slot: "m",
    others: rest.map((p) => p.item),
  }));
  return { parts, total: parts.reduce((s, p) => s + p.item.value, 0) };
}
