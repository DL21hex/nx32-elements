/** `<Password>` para SolidJS: envuelve `<nx-password>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/password/index";
import type { NxPassword } from "../components/password/password";
import type { PasswordChangeDetail, PasswordLabels, PasswordRule, PasswordRuleId, PasswordStrength } from "../components/password/types";

export type { NxPassword, PasswordChangeDetail, PasswordLabels, PasswordRule, PasswordRuleId, PasswordStrength };

export interface PasswordProps extends Omit<JSX.HTMLAttributes<NxPassword>, "onChange" | "children"> {
  /** Solo por código (nunca va a un atributo). */
  value?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  placeholder?: string;
  /** `current-password` (por defecto) o `new-password` (por defecto con `meter`). */
  autocomplete?: string;
  label?: string;
  /** Una contraseña nueva: medidor y condiciones. */
  meter?: boolean;
  /** El largo mínimo con `meter` (12 por defecto). */
  minLength?: number;
  /** Lo que no puede llevar: nombre, apellidos, documento. */
  avoid?: string[];
  /** El id del campo que tiene que repetir. */
  match?: string;
  /** El id del campo del que tiene que ser distinta. */
  differs?: string;
  /** Revisión de filtraciones por k-anonimato (del mismo origen). */
  breachEndpoint?: string;
  labels?: Partial<PasswordLabels>;
  onChange?: (e: CustomEvent<PasswordChangeDetail>) => void;
  children?: never;
}

export function Password(props: PasswordProps): JSX.Element {
  const [local, rest] = splitProps(props, ["value", "name", "required", "disabled", "readonly", "placeholder", "autocomplete", "label", "meter", "minLength", "avoid", "match", "differs", "breachEndpoint", "labels", "onChange", "children"]);
  return (
    <nx-password
      {...rest}
      prop:value={local.value}
      prop:avoid={local.avoid}
      prop:labels={local.labels}
      attr:name={local.name}
      attr:placeholder={local.placeholder}
      attr:autocomplete={local.autocomplete}
      attr:label={local.label}
      attr:min-length={local.minLength === undefined ? undefined : String(local.minLength)}
      attr:match={local.match}
      attr:differs={local.differs}
      attr:breach-endpoint={local.breachEndpoint}
      bool:required={!!local.required}
      bool:disabled={!!local.disabled}
      bool:readonly={!!local.readonly}
      bool:meter={!!local.meter}
      on:nx-password-change={(e) => e.target === e.currentTarget && local.onChange?.(e)}
    />
  );
}
