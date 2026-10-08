/**
 * Demo del inicio de un empleado: `<nx-intent>` (¿qué necesitas?), `<nx-stats>` (las cifras de
 * entrada), `<nx-timeline>` (su año: pagos, descansos, permisos y cesantías) y `<nx-tracker>` (lo
 * que tiene en camino y una sugerencia de vacaciones calculada con `suggestBreaks`). Datos de
 * ejemplo con «hoy» fijo en el jueves 8 de octubre de 2026, para que la demo diga siempre lo mismo.
 * Los enlaces no navegan: los eventos (cancelados) se anotan abajo.
 */
import "../src/components/intent/index";
import "../src/components/stats/index";
import "../src/components/timeline/index";
import "../src/components/tracker/index";
import type { IntentDef, NxIntent } from "../src/components/intent/index";
import type { NxStats, StatItem } from "../src/components/stats/index";
import type { NxTimeline, TimelineItem, TimelineLane } from "../src/components/timeline/index";
import type { NxTracker, TrackerItem } from "../src/components/tracker/index";
import { suggestBreaks, workdaysBetween } from "../src/core/holidays";

const TODAY = "2026-10-08";
const nf = new Intl.NumberFormat("es-CO");
const cop = (n: number) => `$ ${nf.format(n)}`;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Quincenas de 2026: el neto base y lo que cambia (horas extra, prima, intereses). */
function payslips(): { date: string; label: string; net: number; extra: number; note: string }[] {
  const out: { date: string; label: string; net: number; extra: number; note: string }[] = [];
  const special: Record<string, [number, string]> = {
    "2026-01-31": [468000, "con los intereses de cesantías"],
    "2026-03-31": [64400, "con 2 horas extra nocturnas"],
    "2026-06-30": [2100000, "con la prima de servicios"],
    "2026-09-15": [92000, "con 4 horas extra diurnas"],
  };
  for (let m = 1; m <= 12; m++) {
    for (const day of [15, new Date(Date.UTC(2026, m, 0)).getUTCDate()]) {
      const date = `2026-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const [extra, note] = special[date] ?? [0, ""];
      out.push({ date, label: `Quincena del ${day === 15 ? 1 : 16} al ${day} de ${MONTHS[m - 1]}`, net: 1882000 + extra, extra, note });
    }
  }
  return out;
}

const PAYS = payslips();
const PAID = PAYS.filter((p) => p.date <= TODAY);
const LAST = PAID[PAID.length - 1];

const LANES: TimelineLane[] = [
  { id: "pagos", label: "Pagos", kind: "bars" },
  { id: "descansos", label: "Descansos", kind: "ranges" },
  { id: "permisos", label: "Permisos", kind: "points" },
  { id: "cesantias", label: "Cesantías", kind: "points", shape: "diamond" },
];

function timelineItems(): TimelineItem[] {
  const items: TimelineItem[] = PAYS.map((p) => ({
    id: `pago-${p.date}`,
    lane: "pagos",
    date: p.date,
    value: p.net,
    extra: p.extra,
    label: p.label,
    detail: [p.date <= TODAY ? `${cop(p.net)} netos` : `Unos ${cop(p.net)} netos`, p.note].filter(Boolean),
    href: `#pago-${p.date}`,
    action: p.date <= TODAY ? "Abrir el desprendible" : undefined,
    caption: p === PAYS[PAID.length] ? "en 7 días" : undefined,
  }));
  items.push(
    { id: "vac-1", lane: "descansos", start: "2026-03-30", end: "2026-04-01", label: "Vacaciones · Semana Santa", detail: ["3 días hábiles", "Descansaste del 28 de marzo al 5 de abril"] },
    { id: "vac-2", lane: "descansos", start: "2026-07-14", end: "2026-07-17", label: "Vacaciones", detail: ["4 días hábiles"] },
    { id: "inc-1", lane: "descansos", start: "2026-05-20", end: "2026-05-22", tone: "neutral", label: "Incapacidad", detail: ["3 días · enfermedad general"] },
    { id: "vac-3", lane: "descansos", start: "2026-12-28", end: "2027-01-08", state: "pending", label: "Vacaciones por aprobar", detail: ["9 días hábiles", "Con Marcela Ruiz desde ayer"], href: "#vacaciones" },
    { id: "per-1", lane: "permisos", date: "2026-05-14", label: "Diligencia personal", detail: ["8:00 a 11:00 a. m.", "Aprobado"] },
    { id: "per-2", lane: "permisos", date: "2026-09-03", label: "Cita médica", detail: ["2:00 a 4:00 p. m.", "Aprobado"] },
    { id: "per-3", lane: "permisos", date: "2026-10-14", state: "pending", label: "Cita odontológica", detail: ["7:00 a 9:00 a. m."], href: "#permisos" },
    { id: "ces-1", lane: "cesantias", date: "2026-02-13", label: "Cesantías de 2025 al fondo", detail: [`${cop(3900000)} consignadas`] },
    { id: "ces-2", lane: "cesantias", date: "2026-08-20", label: "Retiro parcial · vivienda", detail: [`${cop(5000000)} entregados`] },
  );
  return items;
}

const INTENTS: IntentDef[] = [
  {
    id: "certificado",
    label: "Certificado laboral",
    icon: "file-text",
    keywords: ["certificado", "constancia", "carta laboral"],
    exclude: ["retencion", "ingresos y"],
    href: "#certificados",
    slots: [
      {
        name: "salario",
        type: "option",
        options: [
          { value: "con", label: "con salario", keywords: ["con salario", "banco", "credito", "prestamo", "arriendo", "embajada", "visa"], href: "#certificado-con-salario.pdf", newTab: true },
          { value: "sin", label: "sin salario", keywords: ["sin salario"], href: "#certificado-sin-salario.pdf", newTab: true, default: true },
        ],
      },
    ],
  },
  {
    id: "pagos",
    label: "Desprendible de pago",
    icon: "receipt",
    keywords: ["desprendible", "colilla", "pago", "nomina", "quincena"],
    href: "#pagos",
    slots: [
      {
        name: "periodo",
        type: "option",
        options: [...PAID].reverse().map((p, i) => ({
          value: p.date,
          label: p.label,
          keywords: [MONTHS[Number(p.date.slice(5, 7)) - 1], ...(i === 0 ? ["ultimo", "ultima"] : [])],
          href: `#pago-${p.date}.pdf`,
          newTab: true,
          default: i === 0,
        })),
      },
    ],
  },
  { id: "vacaciones", label: "Vacaciones", icon: "calendar-range", keywords: ["vacacion", "descansar", "puente"], href: "#vacaciones", slots: [{ name: "mes", type: "month" }, { name: "desde", type: "date", label: "desde el" }] },
  { id: "permisos", label: "Permiso", icon: "calendar", keywords: ["permiso", "cita", "diligencia", "calamidad"], href: "#permisos", slots: [{ name: "dia", type: "date" }, { name: "hora", type: "time", label: "a las" }] },
  { id: "cesantias", label: "Cesantías", icon: "wallet", keywords: ["cesantia"], href: "#cesantias", slots: [{ name: "monto", type: "amount" }] },
  { id: "retenciones", label: "Ingresos y retenciones", icon: "file-text", keywords: ["retencion", "renta", "ingresos y retenciones", "220"], href: "#retenciones" },
];

function trackerItems(): TrackerItem[] {
  const [best] = suggestBreaks({ from: "2026-10-13", to: "2027-02-28", available: 12 });
  const items: TrackerItem[] = [
    {
      id: "per-3",
      icon: "calendar",
      title: "Permiso · cita odontológica",
      subtitle: "miércoles 14 de octubre · 7:00 a 9:00 a. m.",
      status: { label: "Por aprobar", tone: "warning" },
      steps: [
        { label: "Enviado", detail: "Ayer, 4:12 p. m.", state: "done" },
        { label: "Con tu jefe", detail: "Marcela Ruiz", state: "current" },
        { label: "Aprobado", state: "todo" },
      ],
      href: "#permisos",
    },
    {
      id: "vac-3",
      icon: "calendar-range",
      title: "Vacaciones de fin de año",
      subtitle: `28 dic – 8 ene · ${workdaysBetween("2026-12-28", "2027-01-08")} días hábiles`,
      status: { label: "Por aprobar", tone: "warning" },
      steps: [
        { label: "Enviadas", detail: "Hoy, 9:12 a. m.", state: "done" },
        { label: "Con tu jefe", detail: "Marcela Ruiz", state: "current" },
        { label: "Talento humano", state: "todo" },
        { label: "Aprobadas", state: "todo" },
      ],
      days: { start: "2026-12-28", end: "2027-01-08" },
      href: "#vacaciones",
    },
  ];
  if (best) {
    items.push({
      id: "idea",
      icon: "calendar",
      eyebrow: "Para ti",
      title: `${best.days} días de descanso con ${best.workdays} de vacaciones`,
      subtitle: `Si pides del ${best.start.slice(8)}/${best.start.slice(5, 7)} al ${best.end.slice(8)}/${best.end.slice(5, 7)}, descansas del ${best.from.slice(8)}/${best.from.slice(5, 7)} al ${best.to.slice(8)}/${best.to.slice(5, 7)}.`,
      days: { start: best.start, end: best.end },
      actions: [{ label: "Pedir esas fechas", href: `#vacaciones?desde=${best.start}&hasta=${best.end}`, primary: true }],
    });
  }
  return items;
}

const STATS: StatItem[] = [
  { id: "pago", label: "Último pago", value: LAST.net, format: "money", currency: "COP", note: LAST.label, badge: { label: "Sin abrir" }, trend: PAID.slice(-10).map((p) => p.net), href: `#pago-${LAST.date}.pdf`, newTab: true },
  { id: "vacaciones", label: "Vacaciones en 2026", value: "7 días", note: "9 más por aprobar", meter: { value: 7, max: 15 } },
  { id: "tramite", label: "En trámite", value: 2, note: "Un permiso y unas vacaciones", ring: { value: 1, max: 2, text: "1/2" } },
];

export function mountHomeDemo(root: HTMLElement): void {
  const log = root.querySelector<HTMLOListElement>("#ho-log")!;
  const add = (text: string) => {
    const li = document.createElement("li");
    li.textContent = text;
    log.prepend(li);
    while (log.children.length > 6) log.lastElementChild!.remove();
  };
  const intent = root.querySelector<NxIntent>("#ho-intent")!;
  intent.intents = INTENTS;
  intent.examples = ["Certificado para el banco", "Mi último desprendible", "Vacaciones en diciembre", "Permiso el viernes a las 3"];
  intent.addEventListener("nx-intent-submit", (e) => {
    e.preventDefault();
    add(`nx-intent-submit → ${e.detail.intent.label} · ${e.detail.href}${e.detail.newTab ? " (otra pestaña)" : ""}`);
  });

  const stats = root.querySelector<NxStats>("#ho-stats")!;
  stats.items = STATS;
  stats.addEventListener("nx-stats-select", (e) => {
    e.preventDefault();
    add(`nx-stats-select → ${e.detail.item.label} · ${e.detail.href}`);
  });

  const timeline = root.querySelector<NxTimeline>("#ho-timeline")!;
  timeline.lanes = LANES;
  timeline.items = timelineItems();
  timeline.summary = `${cop(PAID.reduce((s, p) => s + p.net, 0))} recibidos en ${PAID.length} quincenas`;
  timeline.legend = [
    { mark: "bar", label: "Pagado" },
    { mark: "bar-upcoming", label: "Por llegar" },
    { mark: "bar-extra", label: "Prima, intereses o extras" },
    { mark: "range", label: "Vacaciones" },
    { mark: "range-pending", label: "Por aprobar" },
    { mark: "point", label: "Permiso" },
    { mark: "holiday", label: "Festivo" },
  ];
  timeline.addEventListener("nx-timeline-select", (e) => {
    e.preventDefault();
    add(`nx-timeline-select → ${e.detail.item.label}${e.detail.href ? ` · ${e.detail.href}` : ""}`);
  });

  const tracker = root.querySelector<NxTracker>("#ho-tracker")!;
  tracker.items = trackerItems();
  tracker.addEventListener("nx-tracker-select", (e) => {
    e.preventDefault();
    add(`nx-tracker-select → ${e.detail.item.title}${e.detail.action ? ` › ${e.detail.action.label}` : ""} · ${e.detail.href}`);
  });
}
