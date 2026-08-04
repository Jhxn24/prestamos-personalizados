import type { DashboardClientePrestamo, EstadoCuota } from "@/lib/types";
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

export function ClienteDashboard({
  prestamos,
}: {
  prestamos: DashboardClientePrestamo[];
}) {
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
