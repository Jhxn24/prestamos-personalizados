"use client";

import { descargarCSV } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ColumnaReporte<T> {
  header: string;
  accessor: (fila: T) => string;
  align?: "left" | "right";
}

interface ReporteTablaProps<T> {
  titulo: string;
  descripcion?: string;
  columnas: ColumnaReporte<T>[];
  filas: T[];
  nombreArchivoCSV: string;
  vacio?: string;
}

/**
 * Card + tabla de solo lectura para un reporte, con export a CSV. A
 * diferencia de components/ui/data-table.tsx (que trae buscador y
 * paginación) un reporte muestra todo — no tiene sentido paginar algo
 * pensado para exportar o imprimir completo.
 */
export function ReporteTabla<T>({
  titulo,
  descripcion,
  columnas,
  filas,
  nombreArchivoCSV,
  vacio = "Sin datos para este reporte.",
}: ReporteTablaProps<T>) {
  function exportar() {
    descargarCSV(
      nombreArchivoCSV,
      filas.map((fila) =>
        Object.fromEntries(columnas.map((columna) => [columna.header, columna.accessor(fila)]))
      )
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{titulo}</CardTitle>
          {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
        </div>
        {filas.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportar} className="no-print">
            Exportar CSV
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vacio}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columnas.map((columna) => (
                  <TableHead
                    key={columna.header}
                    className={columna.align === "right" ? "text-right" : undefined}
                  >
                    {columna.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila, indice) => (
                <TableRow key={indice}>
                  {columnas.map((columna) => (
                    <TableCell
                      key={columna.header}
                      className={columna.align === "right" ? "text-right" : undefined}
                    >
                      {columna.accessor(fila)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
