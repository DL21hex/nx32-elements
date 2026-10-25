import { expect, test } from "@playwright/test";
import { open } from "./helpers";

// <nx-date> dentro de <nx-form>, en un navegador real: el popover, el foco y el teclado del calendario.
test("elegir con el teclado salta lo bloqueado y «hasta» sigue a «desde»", async ({ page }) => {
  await open(page, "#/form");
  const form = page.locator("#frm-permiso");
  const desde = form.locator('nx-field[data-key="desde"]');
  // La caja se llama como el campo (el <label for> es del elemento, no de la caja de adentro).
  await expect(form.getByRole("textbox", { name: "Desde" })).toBeVisible();
  await expect(form.getByRole("button", { name: "Abrir calendario: Hasta" })).toBeVisible();
  await desde.locator(".nx-date__input").fill("12/11/2026");
  await desde.locator(".nx-date__input").press("Tab");
  await expect(form.locator('nx-field[data-key="hasta"] .nx-date__input')).toHaveValue("12/11/2026");
  // El 16 es festivo: tachado, con su nombre, y Enter no lo elige.
  await form.locator('nx-field[data-key="hasta"] .nx-date__btn').click();
  const pop = form.locator('nx-field[data-key="hasta"] .nx-date__pop');
  await expect(pop).toBeVisible();
  await expect(pop.locator(".nx-date__day[aria-selected=true]")).toHaveText("12");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(pop).toBeVisible();
  await expect(pop.locator(".nx-date__note")).toContainText("Independencia de Cartagena");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(pop).toBeHidden();
  await expect(form.locator('nx-field[data-key="hasta"] .nx-date__input')).toHaveValue("17/11/2026");
  await expect(form.locator('nx-field[data-key="hasta"] .nx-date__input')).toBeFocused();
});

test("los tipos se piden con la empresa elegida", async ({ page }) => {
  await open(page, "#/form");
  const form = page.locator("#frm-permiso");
  const tipo = form.locator('nx-field[data-key="tipo"] nx-select');
  await expect(tipo).toHaveAttribute("disabled", "");
  await form.locator('nx-field[data-key="empresa"]').getByText("Crear").click();
  await expect(tipo).not.toHaveAttribute("disabled", "");
  await tipo.locator(".nx-select__field").click();
  await expect(page.getByRole("option", { name: /No remunerado/ })).toBeVisible();
});
