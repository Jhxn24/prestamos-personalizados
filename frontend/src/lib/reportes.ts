import { cuotasVencidas, diasAtrasoMaximo, esMoroso, montoVencido } from "@/components/clientes/columnas-morosos";
import type { Pago, Prestamo } from "./types";

function claveMes(iso: string): string {
  const fecha = new Date(iso);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function etiquetaMes(clave: string): string {
  const [anio, mes] = clave.split("-").map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

export interface FilaGananciaMes {
  mes: string;
  interesGanado: number;
  capitalRecuperado: number;
  totalCobrado: number;
}

/** Ganancias por mes (RF-31): agrupa por mes de fechaConfirmacion. */
export function agruparGananciasPorMes(pagosConfirmados: Pago[]): FilaGananciaMes[] {
  const acumulado = new Map<string, FilaGananciaMes>();

  for (const pago of pagosConfirmados) {
    if (!pago.fechaConfirmacion) continue;
    const clave = claveMes(pago.fechaConfirmacion);
    const fila = acumulado.get(clave) ?? {
      mes: etiquetaMes(clave),
      interesGanado: 0,
      capitalRecuperado: 0,
      totalCobrado: 0,
    };
    fila.interesGanado += Number(pago.interesAplicado);
    fila.capitalRecuperado += Number(pago.capitalAplicado);
    fila.totalCobrado += Number(pago.monto);
    acumulado.set(clave, fila);
  }

  return [...acumulado.entries()]
    .sort(([claveA], [claveB]) => claveA.localeCompare(claveB))
    .map(([, fila]) => fila);
}

export interface FilaCapitalMes {
  mes: string;
  prestado: number;
  recuperado: number;
}

/**
 * Capital prestado vs. recuperado por mes (RF-31): prestado se agrupa por
 * mes de fechaDesembolso, recuperado por mes de fechaConfirmacion — son
 * ejes de tiempo distintos, cada uno agrupado en su propio mes.
 */
export function agruparCapitalPorMes(prestamos: Prestamo[], pagosConfirmados: Pago[]): FilaCapitalMes[] {
  const acumulado = new Map<string, FilaCapitalMes>();

  function obtener(clave: string): FilaCapitalMes {
    let fila = acumulado.get(clave);
    if (!fila) {
      fila = { mes: etiquetaMes(clave), prestado: 0, recuperado: 0 };
      acumulado.set(clave, fila);
    }
    return fila;
  }

  for (const prestamo of prestamos) {
    if (prestamo.estado === "CANCELADO") continue;
    obtener(claveMes(prestamo.fechaDesembolso)).prestado += Number(prestamo.capital);
  }

  for (const pago of pagosConfirmados) {
    if (!pago.fechaConfirmacion) continue;
    obtener(claveMes(pago.fechaConfirmacion)).recuperado += Number(pago.capitalAplicado);
  }

  return [...acumulado.entries()]
    .sort(([claveA], [claveB]) => claveA.localeCompare(claveB))
    .map(([, fila]) => fila);
}

/** Préstamos al día (complemento de "moroso"): ACTIVO y sin cuotas VENCIDA. */
export function calcularPrestamosAlDia(prestamos: Prestamo[]): Prestamo[] {
  return prestamos.filter(
    (prestamo) => prestamo.estado === "ACTIVO" && cuotasVencidas(prestamo).length === 0
  );
}

export { esMoroso, diasAtrasoMaximo, montoVencido };
