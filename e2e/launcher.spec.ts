import { expect, test } from "@playwright/test";
import { open } from "./helpers";

/** Con puntero (`hover: hover`), las vistas de una tarjeta están ocultas a la vista (opacity 0, sin
 *  clics) hasta pasar el puntero o enfocarlas; siguen en el árbol de accesibilidad. */
test("vistas con puntero: ocultas no reciben clics; al pasar el puntero se ven y se usan", async ({ page }) => {
  await open(page, "#/launcher");
  const card = page.locator('[data-la-demo="talento"] .nx-launcher__card.has-views').first();
  await expect(card).toBeVisible();
  const views = card.locator(".nx-launcher__views");
  const first = views.locator(".nx-launcher__view").first();
  await page.evaluate(() => {
    const w = window as unknown as { picks: string[] };
    w.picks = [];
    document.addEventListener("nx-launcher-select", (e) => w.picks.push(`${(e as CustomEvent).detail.item.label} › ${(e as CustomEvent).detail.view?.label ?? "-"}`), true);
  });
  await page.mouse.move(0, 0);
  await expect(views).toHaveCSS("opacity", "0");
  // Oculta solo a la vista: sin `visibility` (ni en la transición de salida), y el punto donde está la
  // vista no es de la vista.
  expect(await views.evaluate((el) => [getComputedStyle(el).visibility, getComputedStyle(el).transitionProperty])).toEqual(["visible", expect.not.stringContaining("visibility")]);
  const hit = await first.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!at && (at === el || el.contains(at));
  });
  expect(hit).toBe(false);
  // Con el puntero encima, se ven y el clic llega a la vista.
  await card.hover();
  await expect(views).toHaveCSS("opacity", "1");
  await first.click();
  expect(await page.evaluate(() => (window as unknown as { picks: string[] }).picks)).toEqual(["Certificados laborales › Con salario"]);
});

test("vistas con Tab: el foco las muestra (:focus-within) sin el puntero", async ({ page }) => {
  await open(page, "#/launcher");
  const card = page.locator('[data-la-demo="talento"] .nx-launcher__card.has-views').first();
  await expect(card).toBeVisible();
  await page.mouse.move(0, 0);
  const views = card.locator(".nx-launcher__views");
  await card.locator(".nx-launcher__link").focus();
  await page.keyboard.press("Tab");
  await expect(views.locator(".nx-launcher__view").first()).toBeFocused();
  await expect(views).toHaveCSS("opacity", "1");
  await expect(views).toHaveCSS("pointer-events", "auto");
});

/** La compacta con `pack`: las secciones cortas comparten fila (subgrid) con tarjetas del mismo
 *  ancho que las de una sección larga; angosta, cada sección es una lista. */
test("inicio por secciones: secciones que comparten fila y listas en angosto", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "#/launcher-inicio");
  const la = page.locator("#lh-launcher");
  await expect(la.locator(".nx-launcher__card").first()).toBeVisible();
  const geo = await la.evaluate((el) => {
    const secs = [...el.querySelectorAll<HTMLElement>(".nx-launcher__section")];
    const top = (i: number) => Math.round(secs[i].getBoundingClientRect().top);
    const w = (i: number) => Math.round(secs[i].querySelector(".nx-launcher__card")!.getBoundingClientRect().width);
    return { packed: el.querySelector(".nx-launcher__nav")!.classList.contains("is-packed"), equipo: top(2), documentos: top(3), anchos: [w(0), w(1), w(2), w(3)] };
  });
  expect(geo.packed).toBe(true);
  // «Mi equipo» (2) y «Documentos» (1) van en la misma fila.
  expect(geo.documentos).toBe(geo.equipo);
  // Las tarjetas miden lo mismo en todas las secciones.
  for (const w of geo.anchos) expect(Math.abs(w - geo.anchos[0])).toBeLessThanOrEqual(1);
  // El nombre largo no se corta.
  const name = la.locator('[data-key="vacaciones-equipo"] .nx-launcher__label');
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  await page.locator('[data-lh-width="phone"]').click();
  await expect(la.locator(".nx-launcher__grid").first()).toHaveCSS("display", "block");
  await expect(la.locator(".nx-launcher__card").first()).toHaveCSS("display", "grid");
  expect(await la.evaluate((el) => el.querySelector(".nx-launcher__nav")!.classList.contains("is-packed"))).toBe(false);
});

test("inicio por secciones: escribir para ir sin campo", async ({ page }) => {
  await open(page, "#/launcher-inicio");
  const la = page.locator("#lh-launcher");
  await expect(la.locator(".nx-launcher__card").first()).toBeVisible();
  await page.keyboard.type("vac");
  const pill = la.locator(".nx-launcher__goto");
  await expect(pill).toBeVisible();
  await expect(pill).toContainText("Enter abre Vacaciones");
  await expect(la.locator('[data-key="cesantias"]')).toHaveClass(/is-dim/);
  await page.keyboard.press("Enter");
  await expect(page.locator("#lh-log li").first()).toContainText("Vacaciones");
  await expect(pill).toBeHidden();
});
