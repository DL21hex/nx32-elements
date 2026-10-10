import { define } from "../../core/define";
import { NxLauncher } from "./launcher";

define("nx-launcher", NxLauncher);

export { NxLauncher, LAUNCHER_LABELS } from "./launcher";
export { accentOf, balanceColumns, firstTarget, fitColumns, matchItem, moveIndex, packSpans, sparkPaths } from "./logic";
export type { LauncherAccent, LauncherDensity, LauncherItem, LauncherLabels, LauncherProgress, LauncherSelectDetail, LauncherSignal, LauncherTone, LauncherView } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-launcher": NxLauncher;
  }
  interface HTMLElementEventMap {
    "nx-launcher-select": CustomEvent<import("./types").LauncherSelectDetail>;
  }
}
