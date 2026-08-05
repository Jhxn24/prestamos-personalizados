import type { FrecuenciaPago, ModalidadPrestamo, SimularPrestamoInput, TipoInteres } from "./types";

export interface CamposCondiciones {
  capital: string;
  tasaInteres: string;
  tipoInteres: TipoInteres;
  frecuenciaPago: FrecuenciaPago;
  diasPersonalizados: string;
  numeroCuotas: string;
  modalidad: ModalidadPrestamo;
  fechaDesembolso: string;
}

export type ErroresCondiciones = Partial<Record<keyof CamposCondiciones, string>>;

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export const CAMPOS_CONDICIONES_INICIALES: CamposCondiciones = {
  capital: "",
  tasaInteres: "",
  tipoInteres: "MENSUAL",
  frecuenciaPago: "MENSUAL",
  diasPersonalizados: "",
  numeroCuotas: "",
  modalidad: "CUOTAS_FIJAS",
  fechaDesembolso: hoyISO(),
};

/** Mismas reglas que frontend/simulador-form.tsx y ajustar-prestamo-sheet.tsx. */
export function validarCondiciones(
  campos: CamposCondiciones
): { datos: SimularPrestamoInput; errores: null } | { datos: null; errores: ErroresCondiciones } {
  const errores: ErroresCondiciones = {};

  const capital = Number(campos.capital);
  if (!campos.capital || Number.isNaN(capital) || capital <= 0) {
    errores.capital = "Debe ser mayor a 0";
  }

  const tasaInteres = Number(campos.tasaInteres);
  if (!campos.tasaInteres || Number.isNaN(tasaInteres) || tasaInteres <= 0) {
    errores.tasaInteres = "Debe ser mayor a 0";
  }

  const numeroCuotas = Number(campos.numeroCuotas);
  if (!campos.numeroCuotas || !Number.isInteger(numeroCuotas) || numeroCuotas <= 0) {
    errores.numeroCuotas = "Debe ser un entero mayor a 0";
  }

  let diasPersonalizados: number | undefined;
  if (campos.frecuenciaPago === "PERSONALIZADA") {
    diasPersonalizados = Number(campos.diasPersonalizados);
    if (!campos.diasPersonalizados || !Number.isInteger(diasPersonalizados) || diasPersonalizados <= 0) {
      errores.diasPersonalizados = "Debe ser un entero mayor a 0";
    }
  }

  if (!campos.fechaDesembolso) {
    errores.fechaDesembolso = "Obligatorio";
  }

  if (Object.keys(errores).length > 0) {
    return { datos: null, errores };
  }

  return {
    datos: {
      capital,
      tasaInteres,
      tipoInteres: campos.tipoInteres,
      frecuenciaPago: campos.frecuenciaPago,
      diasPersonalizados,
      numeroCuotas,
      modalidad: campos.modalidad,
      fechaDesembolso: campos.fechaDesembolso,
    },
    errores: null,
  };
}

export function condicionesDesdeSimularInput(datos: SimularPrestamoInput): CamposCondiciones {
  return {
    capital: String(datos.capital),
    tasaInteres: String(datos.tasaInteres),
    tipoInteres: datos.tipoInteres,
    frecuenciaPago: datos.frecuenciaPago,
    diasPersonalizados: datos.diasPersonalizados ? String(datos.diasPersonalizados) : "",
    numeroCuotas: String(datos.numeroCuotas),
    modalidad: datos.modalidad,
    fechaDesembolso: datos.fechaDesembolso.slice(0, 10),
  };
}
