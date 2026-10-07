/** `<Field>` para SolidJS: envuelve `<nx-field>`. Por qué `attr:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/field/index";
import type { NxField } from "../components/field/field";
import type { FieldActionDetail, FieldLabels, FieldSpan } from "../components/field/types";

export type { NxField, FieldActionDetail, FieldLabels, FieldSpan };

export interface FieldProps extends JSX.HTMLAttributes<NxField> {
  label?: string;
  hint?: string;
  /** El error, en rojo. Se borra cuando la persona cambia el control. */
  error?: string;
  /** Un aviso que no bloquea, en ámbar. */
  warning?: string;
  /** Un botón junto al error o al aviso («Usar gmail.com»). */
  action?: string;
  required?: boolean;
  /** «Opcional» junto a la etiqueta. */
  optional?: boolean;
  /** De dónde vino el dato («Cédula»), hasta que la persona lo cambia. */
  source?: string;
  sourceDetail?: string;
  /** Columnas de `.nx-form-grid` (1 a 6). */
  span?: number;
  /** En lectura: el valor como texto en lugar del control. */
  text?: string;
  locked?: boolean;
  labels?: Partial<FieldLabels>;
  onAction?: (e: CustomEvent<FieldActionDetail>) => void;
  /** El control: un `<input>`, `<select>`, `<NumberInput>`… o un grupo de radios. */
  children?: JSX.Element;
}

export function Field(props: FieldProps): JSX.Element {
  const [local, rest] = splitProps(props, ["label", "hint", "error", "warning", "action", "required", "optional", "source", "sourceDetail", "span", "text", "locked", "labels", "onAction", "children"]);
  return (
    <nx-field
      {...rest}
      prop:labels={local.labels}
      attr:label={local.label}
      attr:hint={local.hint}
      attr:error={local.error}
      attr:warning={local.warning}
      attr:action={local.action}
      attr:source={local.source}
      attr:source-detail={local.sourceDetail}
      attr:span={local.span === undefined ? undefined : String(local.span)}
      attr:text={local.text}
      bool:required={!!local.required}
      bool:optional={!!local.optional}
      bool:locked={!!local.locked}
      on:nx-field-action={(e) => e.target === e.currentTarget && local.onAction?.(e)}
    >
      {local.children}
      {/* Tope de los hijos: ver «Hijos» en ./index.tsx. */}
      <template />
    </nx-field>
  );
}
