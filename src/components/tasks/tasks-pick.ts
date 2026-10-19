/**
 * `<nx-tasks>`: el `@` del campo de captura y el «para Nombre», con la misma lista de sugerencias de
 * `<nx-thread>` (`ThreadPicker`: listbox con `aria-activedescendant`, ↑/↓, Enter o Tab, Esc). Se
 * carga con `import()` al entrar al campo con `people-source`: quien solo marca tareas no la baja.
 */
import { h, safeImageSrc } from "../../core/dom";
import { initials } from "../../core/icons";
import { hueOf } from "../presence/logic";
import { cleanPerson } from "../thread/logic";
import { ThreadPicker, fetchList } from "../thread/thread-pick";
import { strongMatch, type ParaMatch } from "./logic";
import type { TasksPerson } from "./types";

export interface TasksPickHost {
  readonly el: HTMLElement;
  readonly uid: string;
  /** `people-source`, tal como viene (la lista lo valida con `safeEndpoint`). */
  source(): string | null;
  /** El nombre de la lista. */
  label(): string;
  /** Se eligió a alguien: `name` es el texto que quedó en el campo, después de la «@». */
  picked(input: HTMLInputElement, person: TasksPerson): void;
}

/** La foto o las iniciales, con el tono del nombre (como en el hilo). */
function avatar(u: TasksPerson): HTMLElement {
  const src = safeImageSrc(u.avatar);
  return h("span", { class: "nx-tasks__av", "aria-hidden": "true", style: `--h:${hueOf(u.id)}` }, src ? h("img", { src, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : initials(u.name));
}

/** La lista del `@`, la del hilo con las clases `nx-tasks__pick`. */
export function tasksPicker(host: TasksPickHost): ThreadPicker {
  return new ThreadPicker({
    el: host.el,
    uid: host.uid,
    prefix: "nx-tasks",
    refs: new Map(),
    labels: () => ({ people: host.label(), refs: host.label() }),
    patterns: () => [],
    // Solo personas: un «#» no busca nada.
    source: (kind) => (kind === "mention" ? host.source() : null),
    avatar,
    picked: (box, p, item) => host.picked(box as HTMLInputElement, { ...(item as TasksPerson), name: p.text.slice(1) }),
    learned: () => {},
  });
}

/** «para laura gomez» → la persona, si `people-source?q=laura` trae una sola que coincide fuerte. */
export async function findPara(src: string, words: readonly string[], signal: AbortSignal): Promise<ParaMatch> {
  const raw = await fetchList(src, words[0], signal);
  return strongMatch(
    words,
    raw.map(cleanPerson).filter((p): p is TasksPerson => !!p),
  );
}
