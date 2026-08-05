"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { AnularPagoDialog } from "@/components/pagos/anular-pago-dialog";
import { VerDesglosePagoDialog } from "@/components/pagos/ver-desglose-pago-dialog";
import { AjustarPrestamoSheet } from "@/components/prestamos/ajustar-prestamo-sheet";

const MODALIDAD_LABEL: Record<string, string> = {
  INTERES_FIJO: "Interés fijo",
  INTERES_SOBRE_SALDO: "Interés sobre saldo",
  CUOTAS_FIJAS: "Cuotas fijas",
  CAPITAL_AL_FINAL: "Capital al final",
};

const POLITICA_MORA_LABEL: Record<string, string> = {
  NINGUNA: "Ninguna",
  EXTENSION_DIA: "Extensión de un día",
  COBRO_DOBLE: "Cobro doble al día siguiente",
  MORA: "Recargo diario",
};

const ESTADO_PAGO_VARIANTE: Record<Pago["estado"], "default" | "secondary" | "destructive"> = {
  CONFIRMADO: "default",
  ANULADO: "destructive",
  PENDIENTE_CONFIRMACION: "secondary",
  RECHAZADO: "destructive",
};

const ESTADO_PAGO_LABEL: Record<Pago["estado"], string> = {
  CONFIRMADO: "Confirmado",
  ANULADO: "Anulado",
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
  const router = useRouter();
  const esAdministrador = usuario?.rol === "ADMINISTRADOR";

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorEstado, setErrorEstado] = useState<404 | 403 | null>(null);

  const [cuotaSheet, setCuotaSheet] = useState<CuotaPrestamo | null>(null);
  const [pagoDesglose, setPagoDesglose] = useState<Pago | null>(null);
  const [pagoAnular, setPagoAnular] = useState<Pago | null>(null);
  const [modoAjuste, setModoAjuste] = useState<"recalcular" | "refinanciar" | null>(null);

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

  const puedeRecalcular =
    prestamo.estado === "ACTIVO" && prestamo.cuotas.every((cuota) => Number(cuota.montoPagado) === 0);
  const puedeRefinanciar = prestamo.estado === "ACTIVO" && Number(prestamo.capitalPendiente) > 0;

  async function alAjustar(resultado: Prestamo) {
    if (modoAjuste === "refinanciar") {
      router.push(`/prestamos/${resultado.id}`);
    } else {
      setPrestamo(resultado);
    }
    setModoAjuste(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/prestamos" className="text-sm text-muted-foreground hover:underline">
            ← Préstamos
          </Link>
          <h1 className="text-xl font-semibold">
            {MODALIDAD_LABEL[prestamo.modalidad] ?? prestamo.modalidad}
          </h1>
        </div>
        {esAdministrador && (puedeRecalcular || puedeRefinanciar) && (
          <div className="flex items-center gap-2">
            {puedeRecalcular && (
              <Button variant="outline" size="sm" onClick={() => setModoAjuste("recalcular")}>
                Recalcular
              </Button>
            )}
            {puedeRefinanciar && (
              <Button variant="outline" size="sm" onClick={() => setModoAjuste("refinanciar")}>
                Refinanciar
              </Button>
            )}
          </div>
        )}
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
          {prestamo.prestamoOrigenId && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-sm text-muted-foreground">Origen</p>
              <Link
                href={`/prestamos/${prestamo.prestamoOrigenId}`}
                className="font-medium hover:underline"
              >
                Refinanciado de otro préstamo →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cronograma</CardTitle>
        </CardHeader>
        <CardContent>
          <CronogramaTable
            cuotas={prestamo.cuotas}
            variant="real"
            onRegistrarPago={esAdministrador ? setCuotaSheet : undefined}
          />
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
                    {esAdministrador && pago.estado === "CONFIRMADO" && (
                      <Button variant="destructive" size="sm" onClick={() => setPagoAnular(pago)}>
                        Anular
                      </Button>
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
      <AnularPagoDialog
        open={!!pagoAnular}
        onOpenChange={(open) => !open && setPagoAnular(null)}
        pago={pagoAnular}
        onSuccess={recargar}
      />
      <AjustarPrestamoSheet
        open={modoAjuste !== null}
        onOpenChange={(open) => !open && setModoAjuste(null)}
        modo={modoAjuste ?? "recalcular"}
        prestamo={prestamo}
        onSuccess={alAjustar}
      />
    </div>
  );
}
