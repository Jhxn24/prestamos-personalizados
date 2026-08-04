import type { DashboardClientePrestamo, EstadoCuota, Pago } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("es-PE") : "—";
}

const ESTADO_CUOTA_LABEL: Record<EstadoCuota, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
};

const ESTADO_PAGO_LABEL: Record<string, string> = {
  PENDIENTE_CONFIRMACION: "Pendiente de confirmación",
  RECHAZADO: "Rechazado",
};

export function ClienteDashboard({
  prestamos,
  pagos,
}: {
  prestamos: DashboardClientePrestamo[];
  pagos: Pago[];
}) {
  // historialPagos del dashboard solo trae los ya CONFIRMADO (RF-27); acá se
  // completa con los que siguen pendientes o fueron rechazados.
  const pagosNoConfirmadosPorPrestamo = pagos
    .filter((pago) => pago.estado !== "CONFIRMADO")
    .reduce<Record<string, Pago[]>>((acumulado, pago) => {
      (acumulado[pago.prestamoId] ??= []).push(pago);
      return acumulado;
    }, {});

  if (prestamos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no tienes préstamos registrados.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {prestamos.map((prestamo) => (
        <Card key={prestamo.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                Préstamo {prestamo.modalidad.replaceAll("_", " ").toLowerCase()}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Próximo pago: {formatearFecha(prestamo.proximaFechaPago)}
                {prestamo.proximoMonto ? ` · ${formatearMoneda(prestamo.proximoMonto)}` : ""}
              </p>
            </div>
            <Badge variant={prestamo.estado === "ACTIVO" ? "default" : "secondary"}>
              {prestamo.estado}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Capital</p>
                <p className="font-semibold">{formatearMoneda(prestamo.capital)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Capital pendiente</p>
                <p className="font-semibold">{formatearMoneda(prestamo.capitalPendiente)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interés pendiente</p>
                <p className="font-semibold">{formatearMoneda(prestamo.interesPendiente)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mora acumulada</p>
                <p className="font-semibold">{formatearMoneda(prestamo.moraAcumulada)}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Cronograma</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prestamo.cronograma.map((cuota) => (
                    <TableRow key={cuota.numero}>
                      <TableCell>{cuota.numero}</TableCell>
                      <TableCell>{formatearFecha(cuota.fechaVencimiento)}</TableCell>
                      <TableCell className="text-right">{formatearMoneda(cuota.total)}</TableCell>
                      <TableCell className="text-right">
                        {formatearMoneda(cuota.montoPagado)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cuota.estado === "PAGADA" ? "default" : "secondary"}>
                          {ESTADO_CUOTA_LABEL[cuota.estado]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {(pagosNoConfirmadosPorPrestamo[prestamo.id]?.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Pagos pendientes</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosNoConfirmadosPorPrestamo[prestamo.id].map((pago) => (
                      <TableRow key={pago.id}>
                        <TableCell>{formatearFecha(pago.fechaPago)}</TableCell>
                        <TableCell>{pago.metodo}</TableCell>
                        <TableCell className="text-right">{formatearMoneda(pago.monto)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={pago.estado === "RECHAZADO" ? "destructive" : "secondary"}>
                              {ESTADO_PAGO_LABEL[pago.estado] ?? pago.estado}
                            </Badge>
                            {pago.estado === "RECHAZADO" && pago.motivoRechazo && (
                              <span className="text-xs text-muted-foreground">
                                {pago.motivoRechazo}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {prestamo.historialPagos.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Historial de pagos</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prestamo.historialPagos.map((pago) => (
                      <TableRow key={pago.id}>
                        <TableCell>{formatearFecha(pago.fecha)}</TableCell>
                        <TableCell>{pago.metodo}</TableCell>
                        <TableCell className="text-right">{formatearMoneda(pago.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
