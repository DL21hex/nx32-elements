import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mod, open } from "./helpers";

const demo = "#tasks-demo";
const row = (page: Page, id: string) => page.locator(`${demo} .nx-tasks__row[data-id="${id}"]`);
const group = (page: Page, g: string) => page.locator(`${demo} [data-group="${g}"] .nx-tasks__row[data-id]`);
const ids = (page: Page, g: string) => group(page, g).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id));
const input = (page: Page) => page.locator(`${demo} .nx-tasks__input`);
const bar = (page: Page) => page.locator(`${demo} .nx-tasks__bar`);
const chips = (page: Page) => page.locator(`${demo} .nx-tasks__read .nx-tasks__chip`);

/** axe sobre el componente (WCAG 2.1 A y AA), cuando terminan las animaciones de entrada. */
async function audit(page: Page, sel = demo) {
  await page.evaluate(async (s) => {
    const running = [...document.querySelectorAll(s)].flatMap((el) => el.getAnimations({ subtree: true })).filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.race([Promise.allSettled(running.map((a) => a.finished)), new Promise((r) => setTimeout(r, 3000))]);
  }, sel);
  const result = await new AxeBuilder({ page }).include(sel).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = result.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await open(page, "#/tasks");
  await expect(row(page, "t1")).toBeVisible();
});

test("lo que se ve: grupos, cifras, otros módulos y lo pedido (con axe, en claro y en oscuro)", async ({ page }) => {
  await expect(page.locator(`${demo} .nx-tasks__heading`)).toHaveText("Tu día");
  await expect(page.locator(`${demo} .nx-tasks__counts li`)).toHaveText(["1 vencida", "2 para hoy", "3 te esperan", "3 pedidas por ti"]);
  expect(await ids(page, "late")).toEqual(["t1"]);
  expect(await ids(page, "today")).toEqual(["t2", "t3"]);
  await expect(row(page, "t1").locator(".nx-tasks__due")).toHaveText("venció hace 3 días");
  await expect(row(page, "t1").getByRole("button", { name: "Marcar como hecha: Enviar el informe de cartera de septiembre" })).toHaveAttribute("aria-pressed", "false");
  await expect(row(page, "l1").getByRole("link", { name: "Firmar: Orden de compra OC-2291 · Aceros del Caribe" })).toBeVisible();
  await expect(row(page, "r1").getByRole("img", { name: "2 de 3 hechas" })).toBeVisible();
  await expect(page.locator(`${demo} .nx-tasks__foot a`)).toHaveText("Ver todos los pendientes");
  await audit(page);
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await audit(page);
});

test("capturar con @: la lista con el teclado, «Entendí» y agregar al instante; deshacer devuelve lo escrito", async ({ page }) => {
  await input(page).click();
  await input(page).pressSequentially("Revisar el contrato @and");
  const list = page.locator(`${demo} [role="listbox"]`);
  await expect(list.getByRole("option", { name: /Andrés Pérez/ })).toBeVisible();
  await expect(input(page)).toHaveAttribute("aria-activedescendant", /.+/);
  await audit(page);
  await page.keyboard.press("Enter");
  await expect(list).toBeHidden();
  await expect(input(page)).toHaveValue("Revisar el contrato @Andrés Pérez ");
  await input(page).pressSequentially("mañana urgente");
  await expect(chips(page)).toHaveText(["Revisar el contrato", "Andrés Pérez", "Vence mañana", "Urgente"]);
  await expect(page.locator(`${demo} .nx-tasks__for`)).toContainText("Para Andrés Pérez");
  await page.keyboard.press("Enter");
  await expect(input(page)).toHaveValue("");
  await expect(bar(page)).toContainText("Le pediste «Revisar el contrato» a Andrés Pérez");
  const created = page.locator(`${demo} [data-group="requests"] .nx-tasks__row`).first();
  await expect(created.locator(".nx-tasks__title")).toHaveText("Revisar el contrato");
  await expect(created.locator(".nx-tasks__who")).toHaveText("Andrés Pérez · pendiente");
  await audit(page);
  await bar(page).getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(`${demo} [data-group="requests"] .nx-tasks__row`)).toHaveCount(3);
  await expect(input(page)).toHaveValue("Revisar el contrato @Andrés Pérez mañana urgente");
  await expect(input(page)).toBeFocused();
  await expect(page.locator("#tasks-log li").first()).toContainText("nx-tasks-undo → create");
  // Esc borra.
  await page.keyboard.press("Escape");
  await expect(input(page)).toHaveValue("");
});

test("marcar con un toque: a «Hechas hoy», Ctrl+Z la devuelve; al terminar el tiempo sale y la app contesta settle", async ({ page }) => {
  await page.locator(demo).evaluate((el) => el.setAttribute("undo", "1500"));
  await row(page, "t3").getByRole("button", { name: /Marcar como hecha/ }).click();
  expect(await ids(page, "today")).toEqual(["t2"]);
  await expect(bar(page)).toContainText("Hecha: «Revisar la cotización de Aceros del Caribe»");
  await expect(page.locator(`${demo} details.nx-tasks__done summary`)).toHaveText("Hechas hoy (2)");
  // El foco quedó en la casilla siguiente: Ctrl+Z deshace.
  await expect(page.locator(":focus")).toHaveClass(/nx-tasks__check/);
  await page.keyboard.press(`${mod(page)}+z`);
  await expect.poll(() => ids(page, "today")).toEqual(["t2", "t3"]);
  await expect(page.locator("#tasks-log li").first()).toContainText("nx-tasks-undo → done");
  // Otra vez, y ahora se deja correr.
  await row(page, "t3").getByRole("button", { name: /Marcar como hecha/ }).click();
  await expect(page.locator("#tasks-log li").filter({ hasText: "nx-tasks-commit → hecha t3" })).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator("#tasks-log li").first()).toContainText("settle(", { timeout: 5000 });
  await expect(bar(page)).not.toHaveAttribute("data-open", "");
  // Reabrir desde «Hechas hoy» con el mismo botón.
  await page.locator(`${demo} details.nx-tasks__done summary`).click();
  await audit(page);
  await row(page, "t3").getByRole("button", { name: /Marcar como hecha/ }).click();
  await expect.poll(() => ids(page, "today")).toEqual(["t2", "t3"]);
  await expect(bar(page)).toContainText("De vuelta en tu lista");
});

test("crear y confirmar: la tarea toma el id del servidor; con el servidor en contra, se revierte y lo dice", async ({ page }) => {
  await page.locator(demo).evaluate((el) => el.setAttribute("undo", "300"));
  await input(page).fill("Pagar la factura de Gases Industriales hoy");
  await expect(chips(page)).toHaveText(["Pagar la factura de Gases Industriales", "Para mí", "Vence hoy"]);
  await input(page).press("Enter");
  await expect(group(page, "today")).toHaveCount(3);
  await expect(page.locator(`${demo} [data-group="today"] .nx-tasks__row[data-id^="srv-"]`)).toHaveText(/Pagar la factura de Gases Industriales/, { timeout: 5000 });
  // El servidor rechaza el próximo cambio.
  await page.locator('[data-sim="tasks-reject"]').click();
  await row(page, "t2").getByRole("button", { name: /Marcar como hecha/ }).click();
  expect(await ids(page, "today")).not.toContain("t2");
  await expect(bar(page)).toHaveAttribute("data-error", "", { timeout: 5000 });
  await expect(bar(page)).toContainText("No se guardó «Llamar a Transportes Rivera por la entrega en Cartagena»: El servidor rechazó el cambio (ejemplo)");
  await expect(bar(page).getByRole("button", { name: "Deshacer" })).toBeHidden();
  expect(await ids(page, "today")).toContain("t2");
  await audit(page);
  await bar(page).getByRole("button", { name: "Cerrar el aviso" }).click();
  await expect(bar(page)).not.toHaveAttribute("data-open", "");
});

test("en el celular: los botones del campo a lo ancho, filas de 52 px y toques de 44 (con axe)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.querySelector<HTMLElement>(".tasks-stage")!.setAttribute("data-width", "phone"));
  const field = await page.locator(`${demo} .nx-tasks__field`).boundingBox();
  const add = await page.locator(`${demo} .nx-tasks__add`).boundingBox();
  const btns = await page.locator(`${demo} .nx-tasks__btns`).boundingBox();
  expect(add!.y).toBeGreaterThan(field!.y + field!.height - 1);
  expect(btns!.width).toBeGreaterThan(field!.width - 2);
  expect(add!.height).toBeGreaterThanOrEqual(44);
  for (const box of await page.locator(`${demo} .nx-tasks__check:visible`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  for (const h of await page.locator(`${demo} .nx-tasks__row:visible`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(52);
  // Nada se sale de lado.
  expect(await page.locator(demo).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await audit(page);
});

test("vacío: el campo y una línea (con axe)", async ({ page }) => {
  const empty = page.locator("#tasks-empty");
  await expect(empty.locator(".nx-tasks__empty")).toHaveText("No tienes nada pendiente. Lo que escribas aquí queda en tu lista.");
  await expect(empty.locator(".nx-tasks__group")).toHaveCount(0);
  await audit(page, "#tasks-empty");
  await empty.locator(".nx-tasks__input").fill("Llamar a mamá mañana");
  await empty.locator(".nx-tasks__input").press("Enter");
  await expect(empty.locator('[data-group="soon"] .nx-tasks__row')).toHaveCount(1);
  await expect(empty.locator(".nx-tasks__empty")).toHaveCount(0);
});
