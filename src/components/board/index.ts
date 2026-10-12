import { define } from "../../core/define";
import { NxBoard } from "./board";
import { NxBoardPanel } from "./panel";

define("nx-board", NxBoard);
define("nx-board-panel", NxBoardPanel);

export { NxBoard, BOARD_LABELS } from "./board";
export { NxBoardPanel } from "./panel";
export { applyPairs, changedDims, dimList, filterSpec, filtersWithout, markState, matchesFilters, normalizeFilters, parseFilter } from "./logic";
export type { FilterPair } from "./logic";
export type { BoardChangeDetail, BoardDimension, BoardFilters, BoardLabels } from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-board": NxBoard;
    "nx-board-panel": NxBoardPanel;
  }
  interface HTMLElementEventMap {
    "nx-board-change": CustomEvent<import("./types").BoardChangeDetail>;
  }
}
