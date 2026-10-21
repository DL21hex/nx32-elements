/** `<PageHeader>` para SolidJS: envuelve `<nx-page-header>`. Por qué `attr:` y `prop:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/page-header/index";
import type { NxPageHeader } from "../components/page-header/page-header";
import type { PageHeaderAvatarDetail, PageHeaderKpi, PageHeaderLabels, PageHeaderLink, PageHeaderTone } from "../components/page-header/types";

export type { NxPageHeader, PageHeaderAvatarDetail, PageHeaderKpi, PageHeaderLabels, PageHeaderLink, PageHeaderTone };

export interface PageHeaderProps extends JSX.HTMLAttributes<NxPageHeader> {
  /** El título de la página: un `<h1>`. */
  heading?: string;
  /** Un ícono del registro junto al título: el del módulo («users»). */
  headingIcon?: string;
  /** Una línea bajo el título. */
  subheading?: string;
  /** La página de una persona: su nombre (iniciales) o la dirección de su foto. */
  avatar?: string;
  /** El botón del avatar («Cambiar la foto»): `onAvatar`. */
  avatarAction?: string;
  onAvatar?: (e: CustomEvent<PageHeaderAvatarDetail>) => void;
  /** Las cifras bajo el título: `{id?, label, value, delta?, tone?, hint?}`. */
  kpis?: PageHeaderKpi[];
  /** Los enlaces bajo el título: `{label, href, icon?, newTab?, download?}`. */
  links?: PageHeaderLink[];
  labels?: Partial<PageHeaderLabels>;
  /** Formato de las cifras numéricas (por defecto, el `lang` más cercano). */
  locale?: string;
  /** La ruta (un `<Breadcrumb>`), un hijo con `slot="actions"` (los botones) y uno con
   *  `slot="nav"` (las pestañas a páginas hermanas). */
  children?: JSX.Element;
}

export function PageHeader(props: PageHeaderProps): JSX.Element {
  const [local, rest] = splitProps(props, ["heading", "headingIcon", "subheading", "avatar", "avatarAction", "onAvatar", "kpis", "links", "labels", "locale", "children"]);
  return (
    <nx-page-header
      {...rest}
      attr:heading={local.heading || undefined}
      attr:heading-icon={local.headingIcon || undefined}
      attr:subheading={local.subheading || undefined}
      attr:avatar={local.avatar || undefined}
      attr:avatar-action={local.avatarAction || undefined}
      on:nx-page-header-avatar={(e) => e.target === e.currentTarget && local.onAvatar?.(e)}
      attr:locale={local.locale}
      prop:kpis={local.kpis}
      prop:links={local.links}
      prop:labels={local.labels}
    >
      {local.children}
      {/* Tope de los hijos: ver «Hijos» en ./index.tsx. */}
      <template />
    </nx-page-header>
  );
}
