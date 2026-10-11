/**
 * Galería: «Cabecera de página», la demo de `<nx-page-header>`. Dos páginas de Talento Humano de
 * una empresa inventada: «Empleados» (sin acciones, con la tabla y sus atajos como segmentos sin
 * título propio) y «Contratación» (con acciones a la derecha del título y pestañas a páginas
 * hermanas debajo). Los datos son inventados.
 */
import "../src/components/page-header/index";
import "../src/components/breadcrumb/index";
import "../src/components/button/index";
import "../src/components/grid/index";
import type { GridColumn, GridPreset, GridRow, NxGrid } from "../src/index";

const COLS: GridColumn[] = [
  { key: "name", label: "Empleado", width: 220, sticky: true },
  { key: "doc", label: "Documento", width: 130 },
  { key: "area", label: "Área", width: 160 },
  { key: "boss", label: "Jefe administrativo", width: 200 },
  { key: "state", label: "Estado", type: "status", options: [{ value: "Activo", tone: "success" }, { value: "Inactivo", tone: "neutral" }] },
];

const NAMES = ["Laura Gómez Restrepo", "Andrés Pardo Villa", "Marcela Ruiz Ospina", "Camilo Arango Mejía", "Daniela Henao Toro", "Felipe Zapata Ríos", "Juliana Cardona Gil", "Santiago Montoya Uribe"];
const AREAS = ["Cosecha", "Empaque", "Nómina", "Mantenimiento"];
const ROWS: GridRow[] = NAMES.map((name, i) => ({
  id: i + 1,
  name,
  doc: String(1_020_300_400 + i * 7919),
  area: AREAS[i % AREAS.length],
  boss: i % 3 === 0 ? "Sin asignar" : NAMES[(i + 1) % NAMES.length],
  state: i === 5 ? "Inactivo" : "Activo",
}));

const PRESETS: GridPreset[] = [
  { id: "sin_jefe", label: "Sin jefe asignado", hint: "activos · sus permisos no le llegan a nadie", tone: "warning", filters: [{ key: "boss", op: "in", values: ["Sin asignar"] }] },
  { id: "cosecha", label: "Cosecha", filters: [{ key: "area", op: "in", values: ["Cosecha"] }] },
];

export function mountPageHeaderDemo(root: HTMLElement): void {
  const grid = root.querySelector<NxGrid>("#ph-grid")!;
  grid.columns = COLS;
  grid.rows = ROWS;
  grid.presets = PRESETS;
}
