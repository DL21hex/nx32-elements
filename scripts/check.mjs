// Todo lo que haría un CI, en local: `npm run check`. Lo corre el hook `pre-push` (.githooks), así
// nada se envía sin pasar. Se detiene en el primer paso que falle.
//
// Navegadores: por defecto solo Chromium (Chrome, Edge, Brave… son casi todos los usuarios de
// escritorio). Con `--all` (o `NX_CHECK_ALL=1`, que también sirve al empujar: `NX_CHECK_ALL=1 git
// push`), también Firefox y WebKit, si esta máquina lo puede abrir (en Linux necesita librerías del
// sistema: `sudo npx playwright install-deps webkit`). Ojo: en iPhone todos los navegadores son
// WebKit por dentro.
//
// `--nx32` (o `npm run check:nx32`): solo lo de los componentes que usa nx32. Los lee del código de
// nx32 (`NX32_DIR`, por defecto ../nx32/frontend/src) y deja fuera las pruebas que son de otros
// componentes; lo común (núcleo, API, dist, SSR, transversal, accesibilidad) siempre corre.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { webkit } from "@playwright/test";

const argv = process.argv.slice(2);
const all = argv.includes("--all") || process.env.NX_CHECK_ALL === "1";
const nx32 = argv.includes("--nx32");

async function canLaunch(type) {
  try {
    const b = await type.launch();
    await b.close();
    return true;
  } catch {
    return false;
  }
}

const browsers = ["chromium"];
let withWebkit = false;
if (all) {
  browsers.push("firefox");
  withWebkit = await canLaunch(webkit);
  if (withWebkit) browsers.push("webkit");
}

/** Los componentes de la librería (carpetas de src/components). */
const components = readdirSync("src/components").filter((d) => statSync(join("src/components", d)).isDirectory());
/** ¿El archivo de prueba es de este componente? («grid.coalesce.dom.test.ts», «solid-button-select.test.tsx»). */
const owns = (file, name) => new RegExp(`(^|[.\\-_])${name}([.\\-_]|$)`).test(file);

/** Los componentes que usa nx32: lo que importa de nx32-elements y las etiquetas `<nx-*>` que pinta. */
function usedByNx32() {
  const dir = process.env.NX32_DIR ?? "../nx32/frontend/src";
  if (!existsSync(dir)) {
    console.error(`✗ --nx32: no encuentro el código de nx32 en ${dir} (NX32_DIR)`);
    process.exit(1);
  }
  const used = new Set();
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) {
        if (f !== "node_modules") walk(p);
      } else if (/\.(tsx?|jsx?)$/.test(f)) {
        const src = readFileSync(p, "utf8");
        for (const m of src.matchAll(/nx32-elements\/(?:solid\/)?([a-z-]+)/g)) used.add(m[1]);
        for (const m of src.matchAll(/<nx-([a-z-]+)/g)) used.add(m[1]);
      }
    }
  };
  walk(dir);
  // `<nx-board-panel>` es de board; `<nx-date-range>` es su carpeta.
  return components.filter((c) => [...used].some((u) => u === c || u.startsWith(`${c}-`)));
}

let vitestFiles = [];
let e2eFiles = [];
if (nx32) {
  const mine = usedByNx32();
  const others = components.filter((c) => !mine.includes(c));
  // Una prueba queda fuera solo si es de otro componente y de ninguno de los de nx32.
  const keep = (f) => !others.some((c) => owns(f, c)) || mine.some((c) => owns(f, c));
  vitestFiles = readdirSync("test").filter((f) => /\.test\.tsx?$/.test(f) && keep(f)).map((f) => `test/${f}`);
  e2eFiles = readdirSync("e2e").filter((f) => f.endsWith(".spec.ts") && keep(f)).map((f) => `e2e/${f}`);
  console.log(`Componentes de nx32 (${mine.length}): ${mine.join(", ")}`);
}

const steps = [
  ["Tipos", "npm", ["run", "typecheck"]],
  // El build va antes de las pruebas: `test/dist.test.ts` revisa el dist/ recién construido, no el
  // de una build anterior.
  ["Build y límites de peso", "npm", ["run", "build"]],
  ["Pruebas de lógica y DOM", "npx", ["vitest", "run", ...vitestFiles]],
  ["Contraste de los tokens", "npm", ["run", "contrast"]],
  [`Navegador (${browsers.join(", ")}) y accesibilidad`, "npx", ["playwright", "test", ...e2eFiles, ...browsers.map((b) => `--project=${b}`)]],
];

const done = [];
for (const [name, cmd, args] of steps) {
  console.log(`\n▶ ${name}`);
  const t0 = performance.now();
  // Playwright levanta su propia galería en un puerto aparte: una `vite` abierta en 5173 (quizá de
  // otro worktree) no se prueba por error.
  // `NX_CHECK`: Playwright corre con menos navegadores a la vez y más margen (playwright.config.ts).
  const env = { ...process.env, NX_E2E_PORT: process.env.NX_E2E_PORT ?? "5199", NX_CHECK: "1" };
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env });
  const s = ((performance.now() - t0) / 1000).toFixed(1);
  done.push(`${r.status === 0 ? "✓" : "✗"} ${name} · ${s} s`);
  if (r.status !== 0) {
    console.log(`\n${done.join("\n")}\n\nFalló «${name}». No se envía nada hasta que pase.`);
    process.exit(1);
  }
}
console.log(`\n${done.join("\n")}`);
if (!all) console.log("· Solo Chromium. Para Firefox y WebKit: npm run check -- --all (o NX_CHECK_ALL=1 git push).");
else if (!withWebkit) console.log("· WebKit no se probó: esta máquina no lo puede abrir (sudo npx playwright install-deps webkit).");
if (nx32) console.log("· Solo los componentes de nx32: no sirve para publicar (el push corre todo).");
