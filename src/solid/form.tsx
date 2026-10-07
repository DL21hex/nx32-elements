/** `<Form>` para SolidJS: envuelve `<nx-form>`. Por qué `prop:`, `attr:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/form/index";
import type { NxForm } from "../components/form/form";
import type {
  FormChangeDetail,
  FormCondition,
  FormField,
  FormFieldType,
  FormFillDetail,
  FormLabels,
  FormMode,
  FormOption,
  FormRule,
  FormSection,
  FormSource,
  FormSubmitDetail,
  FormValue,
  FormVariant,
} from "../components/form/types";

export type { NxForm, FormChangeDetail, FormCondition, FormField, FormFieldType, FormFillDetail, FormLabels, FormMode, FormOption, FormRule, FormSection, FormSource, FormSubmitDetail, FormValue, FormVariant };

export interface FormProps extends Omit<JSX.HTMLAttributes<NxForm>, "onChange" | "onSubmit" | "onCancel"> {
  sections?: FormSection[];
  /** Un formulario de una sola sección, sin título de sección. */
  fields?: FormField[];
  /** Carga un registro. Lo escrito se lee con `ref.values` o en `onChange`. */
  values?: Record<string, FormValue>;
  /** Errores del servidor por clave. */
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
  hints?: Record<string, string>;
  heading?: string;
  submitLabel?: string;
  cancelLabel?: string;
  /** La clave del borrador en este navegador. */
  draft?: string;
  mode?: FormMode;
  variant?: FormVariant;
  index?: "auto" | "none";
  noFooter?: boolean;
  currency?: string;
  locale?: string;
  labels?: Partial<FormLabels>;
  onChange?: (e: CustomEvent<FormChangeDetail>) => void;
  onFill?: (e: CustomEvent<FormFillDetail>) => void;
  onUndo?: (e: CustomEvent<{ keys: string[] }>) => void;
  onSubmit?: (e: CustomEvent<FormSubmitDetail>) => void;
  onCancel?: (e: CustomEvent<Record<string, never>>) => void;
  /** Con `slot="tools"`, bajo el título (los botones para llenar desde afuera). */
  children?: JSX.Element;
}

export function Form(props: FormProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "sections",
    "fields",
    "values",
    "errors",
    "warnings",
    "hints",
    "heading",
    "submitLabel",
    "cancelLabel",
    "draft",
    "mode",
    "variant",
    "index",
    "noFooter",
    "currency",
    "locale",
    "labels",
    "onChange",
    "onFill",
    "onUndo",
    "onSubmit",
    "onCancel",
    "children",
  ]);
  return (
    <nx-form
      {...rest}
      prop:sections={local.sections}
      prop:fields={local.fields}
      prop:values={local.values}
      prop:errors={local.errors}
      prop:warnings={local.warnings}
      prop:hints={local.hints}
      prop:labels={local.labels}
      attr:heading={local.heading}
      attr:submit-label={local.submitLabel}
      attr:cancel-label={local.cancelLabel}
      attr:draft={local.draft}
      attr:mode={local.mode}
      attr:variant={local.variant}
      attr:index={local.index}
      attr:currency={local.currency}
      attr:locale={local.locale}
      bool:no-footer={!!local.noFooter}
      on:nx-form-change={(e) => e.target === e.currentTarget && local.onChange?.(e)}
      on:nx-form-fill={(e) => e.target === e.currentTarget && local.onFill?.(e)}
      on:nx-form-undo={(e) => e.target === e.currentTarget && local.onUndo?.(e)}
      on:nx-form-submit={(e) => e.target === e.currentTarget && local.onSubmit?.(e)}
      on:nx-form-cancel={(e) => e.target === e.currentTarget && local.onCancel?.(e)}
    >
      {local.children}
      {/* Tope de los hijos: ver «Hijos» en ./index.tsx. */}
      <template />
    </nx-form>
  );
}
