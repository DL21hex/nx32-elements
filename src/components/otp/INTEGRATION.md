# `<nx-otp>`: integración

El código de verificación en casillas, una por dígito: la verificación en dos pasos, el cambio de un
correo o de un celular, cualquier trámite que mande un código por mensaje.

Archivos: `otp.ts` (el elemento), `logic.ts` (reparto y limpieza, sin DOM), `types.ts`, `otp.css`,
`index.ts`. Pruebas: `test/otp.dom.test.ts`. Solid: `src/solid/otp.tsx`. En `<nx-form>`: `type:
"otp"` (`maxLength` es el número de casillas).

- `length` (4 a 8, 6 por defecto), `kind` (`numeric` o `alphanumeric`), `name`, `required`,
  `disabled`, `label`, `value`.
- `nx-otp-change` `{value, complete}` con cada casilla; `nx-otp-complete` `{value}` una vez por código,
  en el turno siguiente al evento que llenó la última casilla: la app verifica ahí y, si el código no
  sirve, su error no lo borra el mismo `input`. `clear()` vacía y vuelve a la primera.
- En un `<form>`: el código solo si está completo; `required` lo exige entero (`valueMissing`) y uno
  a medias es `tooShort` («Faltan 2»). No se repone al volver con «atrás».

## BDUI

`Otp: "otp"` en `src/bdui.ts`. Props: `value`, `length`, `kind`, `name`, `required`, `disabled`,
`label`, `labels`.
