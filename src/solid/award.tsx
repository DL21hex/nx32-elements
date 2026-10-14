/** `<Award>` para SolidJS: envuelve `<nx-award>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/award/index";
import type { NxAward } from "../components/award/award";
import type { AwardAdviseDetail, AwardAllocation, AwardChangeDetail, AwardChoice, AwardCriterion, AwardEvent, AwardFilter, AwardItem, AwardLabels, AwardLens, AwardQuote, AwardSplit, AwardSubmitDetail, AwardSupplier } from "../components/award/types";

export type { NxAward, AwardAdviseDetail, AwardAllocation, AwardChangeDetail, AwardChoice, AwardCriterion, AwardEvent, AwardFilter, AwardItem, AwardLabels, AwardLens, AwardQuote, AwardSplit, AwardSubmitDetail, AwardSupplier };

export interface AwardProps extends Omit<JSX.HTMLAttributes<NxAward>, "onChange" | "onSubmit" | "children"> {
  /** Los proveedores `{id, name, detail?, alert?, blocked?}`, en el orden de las columnas. */
  suppliers: AwardSupplier[];
  /** Los artículos `{id, name, qty?, qtyText?, unit?, code?, group?}`. */
  items: AwardItem[];
  /** Las cotizaciones `{item, supplier, price, offered?, leadTime?, original?, note?}`; `price` es el unitario comparable. */
  quotes: AwardQuote[];
  /** `{id, label, weight}`: la leyenda del puntaje y los deslizadores de «Criterios». */
  criteria?: AwardCriterion[];
  /** Sin `endpoint`: la recomendación como eventos del protocolo. */
  advice?: AwardEvent[];
  /** Lo que el comprador ya decidió `[{item, allocations, reason?}]` (un borrador guardado). */
  choices?: AwardChoice[];
  /** Una adjudicación guardada `[{item, supplier, qty?}]`: la fija tal cual (con `readonly`, para consultarla). */
  value?: AwardAllocation[];
  excluded?: string[];
  /** Los motivos que se sugieren al apartarse de la sugerencia. */
  reasons?: string[];
  scenario?: string;
  /** Los pesos `{criterio: peso}` (relativos). Cambiarlos vuelve a pedir la recomendación. */
  weights?: Record<string, number>;
  /** Qué filas se ven: `all` (por defecto), `alerts` o `changed`. */
  filter?: AwardFilter;
  /** Lo que muestran las celdas: `price` (por defecto), `total`, `lead` o `score`. */
  lens?: AwardLens;
  /** `POST {weights, excluded}` → NDJSON. Sin él, `onAdvise`. */
  endpoint?: string;
  /** Sin `endpoint`, la app responde `onAdvise` cada vez (pesos y exclusiones a la vista). */
  adjustable?: boolean;
  /** Plazo de una recomendación, en ms (60 000 por defecto). */
  timeout?: number;
  heading?: string;
  /** Moneda de los precios: ISO («COP») o un símbolo. */
  currency?: string;
  /** El motivo de la decisión (toda la adjudicación). */
  motive?: string;
  readonly?: boolean;
  requireReason?: boolean;
  requireReview?: boolean;
  requireMotive?: boolean;
  /** Cambios sin guardar (la app lo apaga al guardar; `wait()` del envío lo apaga solo). */
  dirty?: boolean;
  locale?: string;
  labels?: Partial<AwardLabels>;
  /** Sin `endpoint`: recomienda con `e.detail.weights` y `e.detail.excluded` y llama `e.detail.respond(events)` (o `preventDefault()` y responde después). */
  onAdvise?: (e: CustomEvent<AwardAdviseDetail>) => void;
  /** El estado completo tras cada cambio (para guardar un borrador): `kind`, `value`, `choices`, `motive`… */
  onChange?: (e: CustomEvent<AwardChangeDetail>) => void;
  /** Lo adjudicado y las órdenes por proveedor. Para guardar en el servidor, `e.detail.wait(promesa)`. */
  onSubmit?: (e: CustomEvent<AwardSubmitDetail>) => void;
  /** Sin hijos: el componente pinta todo su contenido. */
  children?: never;
}

export function Award(props: AwardProps): JSX.Element {
  const [local, rest] = splitProps(props, ["suppliers", "items", "quotes", "criteria", "advice", "choices", "value", "excluded", "reasons", "scenario", "weights", "filter", "lens", "endpoint", "adjustable", "timeout", "heading", "currency", "motive", "readonly", "requireReason", "requireReview", "requireMotive", "dirty", "locale", "labels", "onAdvise", "onChange", "onSubmit", "children"]);
  return (
    <nx-award
      {...rest}
      prop:suppliers={local.suppliers}
      prop:items={local.items}
      prop:quotes={local.quotes}
      prop:criteria={local.criteria}
      prop:advice={local.advice}
      prop:choices={local.choices}
      prop:value={local.value}
      prop:excluded={local.excluded}
      prop:reasons={local.reasons}
      prop:weights={local.weights}
      prop:filter={local.filter}
      prop:labels={local.labels}
      prop:motive={local.motive}
      prop:dirty={local.dirty}
      attr:scenario={local.scenario}
      attr:lens={local.lens}
      attr:endpoint={local.endpoint}
      attr:timeout={local.timeout === undefined ? undefined : String(local.timeout)}
      attr:heading={local.heading}
      attr:currency={local.currency}
      attr:locale={local.locale}
      bool:adjustable={!!local.adjustable}
      bool:readonly={!!local.readonly}
      bool:require-reason={!!local.requireReason}
      bool:require-review={!!local.requireReview}
      bool:require-motive={!!local.requireMotive}
      on:nx-award-advise={(e) => e.target === e.currentTarget && local.onAdvise?.(e)}
      on:nx-award-change={(e) => e.target === e.currentTarget && local.onChange?.(e)}
      on:nx-award-submit={(e) => e.target === e.currentTarget && local.onSubmit?.(e)}
    />
  );
}
