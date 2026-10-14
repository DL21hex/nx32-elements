import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers";

/** La galería con la recomendación ya llegada (la demo la transmite en ~2 s). */
async function ready(page: Page) {
  await open(page, "#/award");
  const el = page.locator("#award-demo");
  await expect(el.locator('tr[data-item="A01"] td[data-rec]').first()).toBeVisible();
  await expect(el).not.toHaveAttribute("data-busy", /.*/, { timeout: 15_000 });
  return el;
}

test("la recomendación llega y reparte el cable entre dos proveedores", async ({ page }) => {
  const el = await ready(page);
  const row = el.locator('tr[data-item="A01"]');
  await expect(row.locator("td[data-chosen]")).toHaveCount(2);
  expect((await row.locator("td[data-chosen] .nx-award__q").allInnerTexts()).sort()).toEqual(["1.050 m", "450 m"]);
});

test("repartir a mano: lo escrito gana, el foco se queda en el campo y un clic dentro del detalle no se pierde", async ({ page }) => {
  const el = await ready(page);
  const row = el.locator('tr[data-item="A02"]');
  await row.locator("th").click();
  const detail = el.locator(".nx-award__detail");
  await expect(detail).toBeVisible();
  const inputs = detail.locator(".nx-award__qty");
  expect(await inputs.count()).toBeGreaterThan(1);
  const second = inputs.nth(1);
  await second.fill("100");
  await second.press("Enter");
  // El detalle se rehízo con el reparto nuevo, y el campo sigue enfocado.
  await expect(row.locator("td[data-chosen]")).toHaveCount(2);
  await expect(second).toBeFocused();
  await expect(second).toHaveValue("100");
  // Escribir otra cantidad y, sin salir del campo, pulsar otro proveedor: el clic cuenta.
  await second.fill("50");
  const pick = detail.locator(".nx-award__pick").first();
  const name = (await pick.innerText()).trim();
  await pick.click();
  await expect(detail.locator(".nx-award__pick", { hasText: name })).toHaveAttribute("aria-pressed", "true");
  await expect(row.locator("td[data-chosen]")).toHaveCount(1);
});

test("teclado: flechas por la grilla, Espacio elige, Supr vuelve a la sugerencia", async ({ page }) => {
  const el = await ready(page);
  const first = el.locator('tr[data-item="A03"] th');
  await first.focus();
  await page.keyboard.press("ArrowRight");
  const cell = el.locator('tr[data-item="A03"] td').first();
  await expect(cell).toBeFocused();
  if ((await cell.getAttribute("data-none")) === null && (await cell.getAttribute("data-blocked")) === null) {
    await page.keyboard.press(" ");
    await expect(cell).toHaveAttribute("data-chosen", "");
    await page.keyboard.press("Delete");
  }
  await page.keyboard.press("ArrowDown");
  await expect(el.locator('tr[data-item="A04"] td').first()).toBeFocused();
});

test("generar las órdenes: «Generando…» mientras guarda y un doble clic envía una sola vez", async ({ page }) => {
  const el = await ready(page);
  const btn = el.locator(".nx-award__btn--primary");
  await btn.dblclick();
  await expect(btn).toHaveText("Generando…");
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveText("Generar órdenes", { timeout: 5000 });
  await expect(page.locator("#award-log li", { hasText: "nx-award-submit" })).toHaveCount(1);
});
