/** Minúsculas y sin tildes. Es la regla por omisión de la librería: para buscar en texto escrito
 *  por personas («porteria» encuentra «Portería», «configuracion» a «Configuración») y para ENTENDER
 *  lo que alguien escribe o dicta («mañana» en un rango de fechas, «cada lunes», una orden de voz,
 *  «millones» en un monto, el encabezado «Telefono» de un archivo): ahí una tilde que falta no debe
 *  estorbar. Para buscar con tildes y ñ exactas, `matchText`. Conserva la longitud de un texto en NFC con letras latinas (cada letra con tilde vuelve a ocupar
 *  una posición). */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Minúsculas y en NFC, CON sus tildes y su ñ: buscar sin distinguir mayúsculas pero sí tildes.
 *  «peña» encuentra «PEÑA» y «Peña», pero «pena» no encuentra «Peña», ni «tecnico» a «TÉCNICO», ni
 *  «Llinas» a «Llinás»: peña es peña, no pena. Es opcional (`accents="exact"` de `<nx-grid>`), para
 *  datos de un ERP en mayúsculas cuyo servidor compara igual: filtrar en el navegador (cuando caben
 *  todos los datos) y en el servidor da lo mismo. NFC hace iguales una «é» compuesta y una «e» +
 *  U+0301; nunca se quitan marcas. Una letra latina en NFC conserva su posición (sirve para
 *  resaltar lo encontrado). Los dos lados de una comparación pasan por la misma: lo escrito y el
 *  dato. */
export function matchText(text: string): string {
  return text.toLowerCase().normalize("NFC");
}
