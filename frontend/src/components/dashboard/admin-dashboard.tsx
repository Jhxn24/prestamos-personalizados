import Link from "next/link";
import type { DashboardAdmin, Pago } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE");
}

function StatCard({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{valor}</p>
      </CardContent>
    </Card>
  );
}

interface AdminDashboardProps {
  datos: DashboardAdmin;
  pagosPendientes: Pago[];
}

export function AdminDashboard({ datos, pagosPendientes }: AdminDashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Total prestado" valor={formatearMoneda(datos.totalPrestado)} />
        <StatCard titulo="Total recuperado" valor={formatearMoneda(datos.totalRecuperado)} />
        <StatCard titulo="Intereses ganados" valor={formatearMoneda(datos.interesesGanados)} />
        <StatCard titulo="Capital pendiente" valor={formatearMoneda(datos.capitalPendiente)} />
        <StatCard titulo="Clientes activos" valor={String(datos.clientesActivos)} />
        <StatCard titulo="Clientes morosos" valor={String(datos.clientesMorosos)} />
        <StatCard titulo="Préstamos vencidos" valor={String(datos.prestamosVencidos)} />
        <StatCard titulo="Préstamos activos" valor={String(datos.prestamosActivos)} />
        <StatCard titulo="Pagos pendientes" valor={String(pagosPendientes.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flujo de caja</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Hoy</p>
            <p className="text-lg font-semibold">{formatearMoneda(datos.flujoCaja.hoy)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Esta semana</p>
            <p className="text-lg font-semibold">{formatearMoneda(datos.flujoCaja.semana)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Este mes</p>
            <p className="text-lg font-semibold">{formatearMoneda(datos.flujoCaja.mes)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Próximos cobros (7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          {datos.proximosCobros.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay cuotas por vencer en los próximos 7 días.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cuota</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.proximosCobros.map((cobro) => (
                  <TableRow key={cobro.cuotaId}>
                    <TableCell>{cobro.cliente}</TableCell>
                    <TableCell>#{cobro.numeroCuota}</TableCell>
                    <TableCell>{formatearFecha(cobro.fechaVencimiento)}</TableCell>
                    <TableCell className="text-right">
                      {formatearMoneda(cobro.montoPendiente)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pagos pendientes de confirmar</CardTitle>
          {pagosPendientes.length > 0 && (
            <Link
              href="/pagos?estado=PENDIENTE_CONFIRMACION"
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Ver todos
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {pagosPendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pagos pendientes de confirmar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuota</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagosPendientes.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell>
                      {pago.prestamo ? (
                        <Link href={`/prestamos/${pago.prestamo.id}`} className="hover:underline">
                          {pago.cuota ? `#${pago.cuota.numero}` : "—"}
                        </Link>
                      ) : pago.cuota ? (
                        `#${pago.cuota.numero}`
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{pago.metodo}</TableCell>
                    <TableCell>{formatearFecha(pago.fechaPago)}</TableCell>
                    <TableCell className="text-right">{formatearMoneda(pago.monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
