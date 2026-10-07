import { cpus, totalmem } from "node:os";
import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas en navegador real sobre la galería: interacciones que happy-dom no tiene (Popover API,
 * foco, portapapeles, View Transitions, arrastre) y accesibilidad con axe.
 *
 *   npm run e2e              → Chromium (reutiliza la galería si ya corre en 5173)
 *   npm run check            → todo (Chromium, Firefox y WebKit si la máquina lo abre); lo corre
 *                              el hook pre-push antes de cada envío, con su propia galería en
 *                              `NX_E2E_PORT` (5199), nunca una que ya estuviera abierta
 */
const own = process.env.NX_E2E_PORT;
const port = Number(own ?? 5173);

/**
 * En `npm run check` (el pre-push) la máquina corre todo a la vez, y con los navegadores que pone
 * Playwright por defecto (la mitad de los núcleos: 6 en esta, entre Chromium y Firefox, a ~600 MB cada
 * uno) la RAM se llena, entra la swap y vencen esperas de pruebas que no tienen nada roto: cada
 * corrida, una o dos distintas de Firefox. Ahí van menos navegadores (uno por cada 4 núcleos y por
 * cada 2,5 GB de RAM, lo que alcance primero), más tiempo para esperar y un reintento: una prueba que
 * pasa al reintentar sale como «flaky» en el resumen (no se esconde) y no frena el envío.
 * `NX_E2E_WORKERS` fija cuántos.
 */
const check = process.env.NX_CHECK === "1";
const workers = Number(process.env.NX_E2E_WORKERS) || (check ? Math.max(1, Math.min(Math.floor(cpus().length / 4), Math.floor(totalmem() / 2.5e9))) : undefined);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: true,
  workers,
  retries: check ? 1 : 0,
  reporter: "list",
  timeout: check ? 60_000 : 30_000,
  expect: { timeout: check ? 10_000 : 5_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    locale: "es-CO",
  },
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !own,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
  ],
});
