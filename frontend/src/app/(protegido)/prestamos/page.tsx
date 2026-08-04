"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listarPrestamos } from "@/lib/prestamos-api";
import type { Prestamo } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { columnasPrestamos } from "@/components/prestamos/columns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function PrestamosPage() {
  const { token, usuario } = useAuth();
  const [prestamos, setPrestamos] = useState<Prestamo[] | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!token) return;
    let activo = true;

    async function cargarPrestamos() {
      setCargando(true);
      try {
        const respuesta = await listarPrestamos(token!);
        if (activo) setPrestamos(respuesta);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "No se pudo cargar la lista de préstamos");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarPrestamos();

    return () => {
      activo = false;
    };
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Préstamos</h1>
        {usuario?.rol === "ADMINISTRADOR" && (
          <Button render={<Link href="/prestamos/nuevo" />} nativeButton={false}>
            Nuevo préstamo
          </Button>
        )}
      </div>

      {cargando || !prestamos ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, indice) => (
            <Skeleton key={indice} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columnasPrestamos}
          data={prestamos}
          searchPlaceholder="Buscar por cliente..."
        />
      )}
    </div>
  );
}
