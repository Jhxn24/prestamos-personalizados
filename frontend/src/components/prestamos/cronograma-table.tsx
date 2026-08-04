import type { CuotaPrestamo, CuotaSimulada, EstadoCuota } from "@/lib/types";
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

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE");
}

const ESTADO_LABEL: Record<EstadoCuota, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
};

function esCuotaReal(
  cuota: CuotaSimulada | CuotaPrestamo,
  variant: "simulacion" | "real"
): cuota is CuotaPrestamo {
  return variant === "real";
}

interface CronogramaTableProps {
  cuotas: CuotaSimulada[] | CuotaPrestamo[];
  /** "simulacion": preview de /prestamos/simular (sin id/estado). "real": préstamo ya persistido. */
  variant: "simulacion" | "real";
}

export function CronogramaTable({ cuotas, variant }: CronogramaTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Vence</TableHead>
          <TableHead className="text-right">Capital</TableHead>
          <TableHead className="text-right">Interés</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
          {variant === "real" && <TableHead className="text-right">Pagado</TableHead>}
          {variant === "real" && <TableHead className="text-right">Mora</TableHead>}
          {variant === "real" && <TableHead>Estado</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {cuotas.map((cuota) => (
          <TableRow key={cuota.numero}>
            <TableCell>{cuota.numero}</TableCell>
            <TableCell>{formatearFecha(cuota.fechaVencimiento)}</TableCell>
            <TableCell className="text-right">{formatearMoneda(cuota.capital)}</TableCell>
            <TableCell className="text-right">{formatearMoneda(cuota.interes)}</TableCell>
            <TableCell className="text-right">{formatearMoneda(cuota.total)}</TableCell>
            <TableCell className="text-right">{formatearMoneda(cuota.saldoCapital)}</TableCell>
            {esCuotaReal(cuota, variant) && (
              <>
                <TableCell className="text-right">{formatearMoneda(cuota.montoPagado)}</TableCell>
                <TableCell className="text-right">{formatearMoneda(cuota.mora)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      cuota.estado === "PAGADA"
                        ? "default"
                        : cuota.estado === "VENCIDA"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {ESTADO_LABEL[cuota.estado]}
                  </Badge>
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
