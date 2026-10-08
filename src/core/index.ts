/**
 * `nx32-elements/core`: las utilidades del núcleo SIN registrar ningún componente. La raíz
 * (`nx32-elements`) importa con efectos los 52 elementos; una app que importa por componente
 * (`nx32-elements/grid`) y además necesita `registerIcons` o `allowOrigins` los toma de aquí y no
 * arrastra la librería entera. Está fuera de `sideEffects`: lo que no se usa se descarta.
 */
export { registerIcons, hasIcon } from "./icons";
export { nxFormat, resolveLocale, canonicalLocale, type NxFormat, type MoneyLike } from "./locale";
export { allowOrigins, safeEndpoint, safeHref } from "./dom";
export { nxSupported, type NxSupport, type NxFeature } from "./support";
export {
  colombiaHolidayList,
  colombiaHolidays,
  easterDay,
  holidayLookup,
  workdayTest,
  workdaysBetween,
  restAround,
  suggestBreaks,
  type Holiday,
  type HolidaySource,
  type WorkCalendar,
  type RestSpan,
  type BreakSuggestion,
  type BreakOptions,
} from "./holidays";
