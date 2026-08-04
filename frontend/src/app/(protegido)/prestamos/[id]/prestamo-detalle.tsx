"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { obtenerPrestamo } from "@/lib/prestamos-api";
import { listarPagos } from "@/lib/pagos-api";
import type { CuotaPrestamo, Pago, Prestamo } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CronogramaTable } from "@/components/prestamos/cronograma-table";
import { RegistrarPagoSheet } from "@/components/pagos/registrar-pago-sheet";
import { ConfirmarPagoDialog } from "@/components/pagos/confirmar-pago-dialog";
import { RechazarPagoDialog } from "@/components/pagos/rechazar-pago-dialog";
import { VerDesglosePagoDialog } from "@/components/pagos/ver-desglose-pago-dialog";

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

const ESTADO_PAGO_VARIANTE: Record<Pago["estado"], "default" | "secondary" | "destructive"> = {
  CONFIRMADO: "default",
  PENDIENTE_CONFIRMACION: "secondary",
  RECHAZADO: "destructive",
};

const ESTADO_PAGO_LABEL: Record<Pago["estado"], string> = {
  CONFIRMADO: "Confirmado",
  PENDIENTE_CONFIRMACION: "Pendiente",
  RECHAZADO: "Rechazado",
};

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE");
}

export function PrestamoDetalle({ id }: { id: string }) {
  const { token, usuario } = useAuth();
  const esAdministrador = usuario?.rol === "ADMINISTRADOR";

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorEstado, setErrorEstado] = useState<404 | 403 | null>(null);

  const [cuotaSheet, setCuotaSheet] = useState<CuotaPrestamo | null>(null);
  const [pagoDesglose, setPagoDesglose] = useState<Pago | null>(null);
  const [pagoConfirmar, setPagoConfirmar] = useState<Pago | null>(null);
  const [pagoRechazar, setPagoRechazar] = useState<Pago | null>(null);

  useEffect(() => {
    if (!token) return;
    let activo = true;

    async function cargar() {
      setCargando(true);
      try {
        const respuestaPrestamo = await obtenerPrestamo(token!, id);
        if (!activo) return;
        setPrestamo(respuestaPrestamo);
        const respuestaPagos = await listarPagos(token!, { prestamoId: id });
        if (activo) setPagos(respuestaPagos);
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

    cargar();

    return () => {
      activo = false;
    };
  }, [token, id]);

  async function recargar() {
    if (!token) return;
    const [respuestaPrestamo, respuestaPagos] = await Promise.all([
      obtenerPrestamo(token, id),
      listarPagos(token, { prestamoId: id }),
    ]);
    setPrestamo(respuestaPrestamo);
    setPagos(respuestaPagos);
  }

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
          <CronogramaTable cuotas={prestamo.cuotas} variant="real" onRegistrarPago={setCuotaSheet} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {!pagos || pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pagos.map((pago) => (
                <div
                  key={pago.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={ESTADO_PAGO_VARIANTE[pago.estado]}>
                      {ESTADO_PAGO_LABEL[pago.estado]}
                    </Badge>
                    <span className="text-sm">
                      {formatearMoneda(pago.monto)} · cuota #{pago.cuota?.numero ?? "—"} ·{" "}
                      {formatearFecha(pago.fechaPago)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPagoDesglose(pago)}>
                      Ver desglose
                    </Button>
                    {esAdministrador && pago.estado === "PENDIENTE_CONFIRMACION" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setPagoConfirmar(pago)}>
                          Confirmar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setPagoRechazar(pago)}>
                          Rechazar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RegistrarPagoSheet
        open={!!cuotaSheet}
        onOpenChange={(open) => !open && setCuotaSheet(null)}
        cuota={cuotaSheet}
        onSuccess={recargar}
      />
      <VerDesglosePagoDialog
        open={!!pagoDesglose}
        onOpenChange={(open) => !open && setPagoDesglose(null)}
        pago={pagoDesglose}
      />
      <ConfirmarPagoDialog
        open={!!pagoConfirmar}
        onOpenChange={(open) => !open && setPagoConfirmar(null)}
        pago={pagoConfirmar}
        onSuccess={recargar}
      />
      <RechazarPagoDialog
        open={!!pagoRechazar}
        onOpenChange={(open) => !open && setPagoRechazar(null)}
        pago={pagoRechazar}
        onSuccess={recargar}
      />
    </div>
  );
}
