"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { obtenerPrestamo } from "@/lib/prestamos-api";
import type { Prestamo } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CronogramaTable } from "@/components/prestamos/cronograma-table";

const MODALIDAD_LABEL: Record<string, string> = {
  INTERES_FIJO: "Interés fijo",
  INTERES_SOBRE_SALDO: "Interés sobre saldo",
  CUOTAS_FIJAS: "Cuotas fijas",
};

const POLITICA_MORA_LABEL: Record<string, string> = {
  NINGUNA: "Ninguna",
  EXTENSION_DIA: "Extensión de un día",
  COBRO_DOBLE: "Cobro doble al día siguiente",
  MORA: "Recargo diario",
};

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE");
}

export function PrestamoDetalle({ id }: { id: string }) {
  const { token } = useAuth();

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorEstado, setErrorEstado] = useState<404 | 403 | null>(null);

  useEffect(() => {
    if (!token) return;
    let activo = true;

    async function cargarPrestamo() {
      setCargando(true);
      try {
        const respuesta = await obtenerPrestamo(token!, id);
        if (activo) setPrestamo(respuesta);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
          if (activo) setErrorEstado(error.status);
        } else {
          throw error;
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarPrestamo();

    return () => {
      activo = false;
    };
  }, [token, id]);

  if (cargando) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (errorEstado === 404 || (!prestamo && !errorEstado)) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Préstamo no encontrado.</p>
        <Link href="/prestamos" className="text-sm font-medium underline">
          Volver a préstamos
        </Link>
      </div>
    );
  }

  if (errorEstado === 403) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">No tienes acceso a este préstamo.</p>
        <Link href="/prestamos" className="text-sm font-medium underline">
          Volver a préstamos
        </Link>
      </div>
    );
  }

  if (!prestamo) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/prestamos" className="text-sm text-muted-foreground hover:underline">
          ← Préstamos
        </Link>
        <h1 className="text-xl font-semibold">
          {MODALIDAD_LABEL[prestamo.modalidad] ?? prestamo.modalidad}
        </h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Datos del préstamo</CardTitle>
          <Badge variant={prestamo.estado === "ACTIVO" ? "default" : "secondary"}>
            {prestamo.estado}
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Cliente</p>
            {prestamo.cliente ? (
              <Link href={`/clientes/${prestamo.cliente.id}`} className="font-medium hover:underline">
                {prestamo.cliente.nombre} {prestamo.cliente.apellido}
              </Link>
            ) : (
              <p className="font-medium">—</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Capital</p>
            <p className="font-medium">{formatearMoneda(prestamo.capital)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Capital pendiente</p>
            <p className="font-medium">{formatearMoneda(prestamo.capitalPendiente)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Interés acumulado</p>
            <p className="font-medium">{formatearMoneda(prestamo.interesAcumulado)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Mora acumulada</p>
            <p className="font-medium">{formatearMoneda(prestamo.moraAcumulada)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tasa de interés</p>
            <p className="font-medium">
              {prestamo.tasaInteres}% {prestamo.tipoInteres.toLowerCase()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Frecuencia de pago</p>
            <p className="font-medium">{prestamo.frecuenciaPago}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fecha de desembolso</p>
            <p className="font-medium">{formatearFecha(prestamo.fechaDesembolso)}</p>
          </div>
          {prestamo.politicaMora !== "NINGUNA" && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-sm text-muted-foreground">Política de mora</p>
              <p className="font-medium">
                {POLITICA_MORA_LABEL[prestamo.politicaMora] ?? prestamo.politicaMora}
                {Number(prestamo.tasaMora) > 0 ? ` · ${prestamo.tasaMora}% diario` : ""}
                {prestamo.diasGracia > 0 ? ` · ${prestamo.diasGracia} días de gracia` : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cronograma</CardTitle>
        </CardHeader>
        <CardContent>
          <CronogramaTable cuotas={prestamo.cuotas} variant="real" />
        </CardContent>
      </Card>
    </div>
  );
}
