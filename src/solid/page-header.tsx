/** `<PageHeader>` para SolidJS: envuelve `<nx-page-header>`. Por qué `attr:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/page-header/index";
import type { NxPageHeader } from "../components/page-header/page-header";

export type { NxPageHeader };

export interface PageHeaderProps extends JSX.HTMLAttributes<NxPageHeader> {
  /** El título de la página: un `<h1>`. */
  heading?: string;
  /** Un ícono del registro junto al título: el del módulo («users»). */
  headingIcon?: string;
  /** Una línea bajo el título. */
  subheading?: string;
  /** La ruta (un `<Breadcrumb>`), un hijo con `slot="actions"` (los botones) y uno con
   *  `slot="nav"` (las pestañas a páginas hermanas). */
  children?: JSX.Element;
}

export function PageHeader(props: PageHeaderProps): JSX.Element {
  const [local, rest] = splitProps(props, ["heading", "headingIcon", "subheading", "children"]);
  return (
    <nx-page-header {...rest} attr:heading={local.heading || undefined} attr:heading-icon={local.headingIcon || undefined} attr:subheading={local.subheading || undefined}>
      {local.children}
      {/* Tope de los hijos: ver «Hijos» en ./index.tsx. */}
      <template />
    </nx-page-header>
  );
}
