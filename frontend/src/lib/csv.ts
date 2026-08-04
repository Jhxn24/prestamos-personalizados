function escaparCampoCSV(valor: string): string {
  if (/[",\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

/**
 * Descarga un CSV en el navegador, sin librería: Blob + un <a download>
 * temporal. Antepone un BOM UTF-8 para que Excel muestre bien tildes/ñ.
 */
export function descargarCSV(nombreArchivo: string, filas: Record<string, string>[]): void {
  if (filas.length === 0) return;

  const columnas = Object.keys(filas[0]);
  const lineas = [
    columnas.map(escaparCampoCSV).join(","),
    ...filas.map((fila) => columnas.map((columna) => escaparCampoCSV(fila[columna] ?? "")).join(",")),
  ];

  const BOM_UTF8 = "﻿";
  const blob = new Blob([BOM_UTF8 + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
