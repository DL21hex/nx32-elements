import { define } from "../../core/define";
import { NxTasks } from "./tasks";

define("nx-tasks", NxTasks);

export { NxTasks, TASKS_LABELS } from "./tasks";
export {
  TASK_GROUPS,
  TASK_MAX_TITLE,
  cleanTaskItems,
  cleanTaskLinks,
  cleanTaskRequests,
  groupTasks,
  paraKey as taskParaKey,
  parseTask,
  requestSummary as taskRequestSummary,
  strongMatch as taskStrongMatch,
  taskCounts,
  taskDueText,
  taskGroup,
  taskShortDate,
} from "./logic";
export type { ParaMatch as TaskParaMatch, TaskCounts, TaskParse, TaskParseOptions } from "./logic";
export type {
  TaskDraft,
  TaskGroupId,
  TaskItem,
  TaskLink,
  TaskLinkTone,
  TaskRequest,
  TaskRequestPerson,
  TasksCapture,
  TasksCommitDetail,
  TasksLabels,
  TasksOpenDetail,
  TasksOptionsDetail,
  TasksPerson,
  TasksSettleResult,
  TasksUndoDetail,
  TasksUnderstand,
} from "./types";

declare global {
  interface HTMLElementTagNameMap {
    "nx-tasks": NxTasks;
  }
  interface HTMLElementEventMap {
    "nx-tasks-commit": CustomEvent<import("./types").TasksCommitDetail>;
    "nx-tasks-undo": CustomEvent<import("./types").TasksUndoDetail>;
    "nx-tasks-open": CustomEvent<import("./types").TasksOpenDetail>;
    "nx-tasks-options": CustomEvent<import("./types").TasksOptionsDetail>;
  }
}
