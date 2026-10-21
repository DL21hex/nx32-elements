# `<nx-password>`: integración

El campo de contraseña: para entrar (la actual) y para crear una nueva con medidor y condiciones.

Archivos: `password.ts` (el elemento), `logic.ts` (condiciones, nivel y k-anonimato, sin DOM; la usa
también `<nx-form>`), `types.ts`, `password.css`, `index.ts`. Pruebas: `test/password.dom.test.ts`.
Solid: `src/solid/password.tsx`. En `<nx-form>`: `type: "password"` con `meter`, `avoid`, `match`,
`differs` y `breachEndpoint`.

- Sin `meter`: el campo con su ojo y el aviso de mayúsculas (`autocomplete="current-password"`).
- Con `meter`: el medidor (4 tramos y el nivel en palabras) y las condiciones: largo (`min-length`, 12),
  sin datos de la persona (`avoid`, JSON o texto con comas), no ser de las más usadas, no aparecer en
  filtraciones (`breach-endpoint`) y distinta de la actual (`differs`, el id de ese campo).
  `match` (el id de la nueva) para la confirmación.
- `nx-password-change` `{strength, ok, rules}` no trae la contraseña. `value` solo por código.

## Filtraciones (k-anonimato)

Con `breach-endpoint="/api/pwned/range"` (del mismo origen o de `allowOrigins`), medio segundo
después de dejar de escribir se pide `GET /api/pwned/range/{5 primeros del SHA-1}`; la respuesta trae
`SUFIJO:VECES` por línea (el formato de Have I Been Pwned) y se busca el resto del hash. La app puede
pasar la consulta tal cual a `https://api.pwnedpasswords.com/range/{prefijo}` con la cabecera
`Add-Padding: true`: la contraseña nunca sale del navegador. Si no se puede revisar, no bloquea.

## BDUI

`Password: "password"` en `src/bdui.ts`. Props: `name`, `required`, `disabled`, `readonly`,
`placeholder`, `autocomplete`, `label`, `meter`, `minLength`, `avoid`, `match`, `differs`,
`breachEndpoint`, `labels`. `value` es `localProps`: una contraseña no llega en un payload, y BDUI la
rechaza con un aviso.
