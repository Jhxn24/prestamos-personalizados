"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listarPagos } from "@/lib/pagos-api";
import { listarPrestamos } from "@/lib/prestamos-api";
import {
  agruparCapitalPorMes,
  agruparGananciasPorMes,
  calcularPrestamosAlDia,
  diasAtrasoMaximo,
  esMoroso,
  montoVencido,
} from "@/lib/reportes";
import type { Pago, Prestamo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReporteTabla } from "@/components/reportes/reporte-tabla";

const MODALIDAD_LABEL: Record<string, string> = {
  INTERES_FIJO: "Interés fijo",
  INTERES_SOBRE_SALDO: "Interés sobre saldo",
  CUOTAS_FIJAS: "Cuotas fijas",
  CAPITAL_AL_FINAL: "Capital al final",
};

function formatearMoneda(valor: number) {
  return `S/ ${valor.toFixed(2)}`;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE");
}

export default function ReportesPage() {
  const { token, usuario } = useAuth();
  const router = useRouter();

  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [prestamos, setPrestamos] = useState<Prestamo[] | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (usuario && usuario.rol !== "ADMINISTRADOR") {
      router.replace("/dashboard");
    }
  }, [usuario, router]);

  useEffect(() => {
    if (!token || usuario?.rol !== "ADMINISTRADOR") return;
    let activo = true;

    async function cargarDatos() {
      setCargando(true);
      try {
        const [pagosConfirmados, todosPrestamos] = await Promise.all([
          listarPagos(token!, { estado: "CONFIRMADO" }),
          listarPrestamos(token!),
        ]);
        if (!activo) return;
        setPagos(pagosConfirmados);
        setPrestamos(todosPrestamos);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "No se pudieron cargar los reportes");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarDatos();

    return () => {
      activo = false;
    };
  }, [token, usuario]);

  const ganancias = useMemo(() => agruparGananciasPorMes(pagos ?? []), [pagos]);
  const capitalPorMes = useMemo(
    () => agruparCapitalPorMes(prestamos ?? [], pagos ?? []),
    [prestamos, pagos]
  );
  const morosos = useMemo(() => (prestamos ?? []).filter(esMoroso), [prestamos]);
  const alDia = useMemo(() => calcularPrestamosAlDia(prestamos ?? []), [prestamos]);

  if (usuario && usuario.rol !== "ADMINISTRADOR") {
    return null;
  }

  if (cargando || !pagos || !prestamos) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, indice) => (
          <Skeleton key={indice} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reportes</h1>
        <Button variant="outline" onClick={() => window.print()} className="no-print">
          Imprimir / Guardar como PDF
        </Button>
      </div>

      <ReporteTabla
        titulo="Ganancias por mes"
        descripcion="Interés ganado y capital recuperado, agrupado por mes de confirmación del pago."
        nombreArchivoCSV="ganancias-por-mes.csv"
        filas={ganancias}
        columnas={[
          { header: "Mes", accessor: (fila) => fila.mes },
          { header: "Interés ganado", accessor: (fila) => formatearMoneda(fila.interesGanado), align: "right" },
          {
            header: "Capital recuperado",
            accessor: (fila) => formatearMoneda(fila.capitalRecuperado),
            align: "right",
          },
          { header: "Total cobrado", accessor: (fila) => formatearMoneda(fila.totalCobrado), align: "right" },
        ]}
      />

      <ReporteTabla
        titulo="Capital prestado vs. recuperado"
        descripcion="Prestado por mes de desembolso; recuperado por mes de confirmación del pago."
        nombreArchivoCSV="capital-prestado-vs-recuperado.csv"
        filas={capitalPorMes}
        columnas={[
          { header: "Mes", accessor: (fila) => fila.mes },
          { header: "Prestado", accessor: (fila) => formatearMoneda(fila.prestado), align: "right" },
          { header: "Recuperado", accessor: (fila) => formatearMoneda(fila.recuperado), align: "right" },
        ]}
      />

      <ReporteTabla
        titulo="Historial de préstamos"
        nombreArchivoCSV="historial-de-prestamos.csv"
        filas={prestamos}
        vacio="No hay préstamos registrados."
        columnas={[
          {
            header: "Cliente",
            accessor: (prestamo) =>
              prestamo.cliente ? `${prestamo.cliente.nombre} ${prestamo.cliente.apellido}` : "—",
          },
          { header: "Documento", accessor: (prestamo) => prestamo.cliente?.documento ?? "—" },
          { header: "Capital", accessor: (prestamo) => `S/ ${prestamo.capital}`, align: "right" },
          { header: "Modalidad", accessor: (prestamo) => MODALIDAD_LABEL[prestamo.modalidad] ?? prestamo.modalidad },
          { header: "Estado", accessor: (prestamo) => prestamo.estado },
          { header: "Fecha desembolso", accessor: (prestamo) => formatearFecha(prestamo.fechaDesembolso) },
          {
            header: "Capital pendiente",
            accessor: (prestamo) => `S/ ${prestamo.capitalPendiente}`,
            align: "right",
          },
        ]}
      />

      <ReporteTabla
        titulo="Clientes morosos"
        descripcion="Préstamos activos con al menos una cuota vencida."
        nombreArchivoCSV="clientes-morosos.csv"
        filas={morosos}
        vacio="No hay clientes morosos."
        columnas={[
          {
            header: "Cliente",
            accessor: (prestamo) =>
              prestamo.cliente ? `${prestamo.cliente.nombre} ${prestamo.cliente.apellido}` : "—",
          },
          { header: "Documento", accessor: (prestamo) => prestamo.cliente?.documento ?? "—" },
          { header: "Días de atraso", accessor: (prestamo) => String(diasAtrasoMaximo(prestamo)), align: "right" },
          {
            header: "Monto vencido",
            accessor: (prestamo) => formatearMoneda(montoVencido(prestamo)),
            align: "right",
          },
          { header: "Mora acumulada", accessor: (prestamo) => `S/ ${prestamo.moraAcumulada}`, align: "right" },
        ]}
      />

      <ReporteTabla
        titulo="Clientes puntuales"
        descripcion="Préstamos activos sin ninguna cuota vencida."
        nombreArchivoCSV="clientes-puntuales.csv"
        filas={alDia}
        vacio="No hay préstamos activos al día."
        columnas={[
          {
            header: "Cliente",
            accessor: (prestamo) =>
              prestamo.cliente ? `${prestamo.cliente.nombre} ${prestamo.cliente.apellido}` : "—",
          },
          { header: "Documento", accessor: (prestamo) => prestamo.cliente?.documento ?? "—" },
          { header: "Capital pendiente", accessor: (prestamo) => `S/ ${prestamo.capitalPendiente}`, align: "right" },
        ]}
      />
    </div>
  );
}
