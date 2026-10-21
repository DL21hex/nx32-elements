/** `<Otp>` para SolidJS: envuelve `<nx-otp>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/otp/index";
import type { NxOtp } from "../components/otp/otp";
import type { OtpChangeDetail, OtpCompleteDetail, OtpKind, OtpLabels } from "../components/otp/types";

export type { NxOtp, OtpChangeDetail, OtpCompleteDetail, OtpKind, OtpLabels };

export interface OtpProps extends Omit<JSX.HTMLAttributes<NxOtp>, "onChange" | "children"> {
  value?: string;
  /** Casillas: de 4 a 8 (6 por defecto). */
  length?: number;
  kind?: OtpKind;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Nombre del grupo para el lector (si no hay un `<label>`). */
  label?: string;
  labels?: Partial<OtpLabels>;
  onChange?: (e: CustomEvent<OtpChangeDetail>) => void;
  /** La última casilla se llenó: verifica aquí. */
  onComplete?: (e: CustomEvent<OtpCompleteDetail>) => void;
  children?: never;
}

export function Otp(props: OtpProps): JSX.Element {
  const [local, rest] = splitProps(props, ["value", "length", "kind", "name", "required", "disabled", "label", "labels", "onChange", "onComplete", "children"]);
  return (
    <nx-otp
      {...rest}
      prop:value={local.value}
      prop:labels={local.labels}
      attr:length={local.length === undefined ? undefined : String(local.length)}
      attr:kind={local.kind}
      attr:name={local.name}
      attr:label={local.label}
      bool:required={!!local.required}
      bool:disabled={!!local.disabled}
      on:nx-otp-change={(e) => e.target === e.currentTarget && local.onChange?.(e)}
      on:nx-otp-complete={(e) => e.target === e.currentTarget && local.onComplete?.(e)}
    />
  );
}
