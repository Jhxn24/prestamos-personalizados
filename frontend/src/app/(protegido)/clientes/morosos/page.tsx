"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listarPrestamos } from "@/lib/prestamos-api";
import type { Prestamo } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { columnasMorosos, esMoroso } from "@/components/clientes/columnas-morosos";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientesMorososPage() {
  const { token, usuario } = useAuth();
  const router = useRouter();

  const [morosos, setMorosos] = useState<Prestamo[] | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (usuario && usuario.rol !== "ADMINISTRADOR") {
      router.replace("/dashboard");
    }
  }, [usuario, router]);

  useEffect(() => {
    if (!token || usuario?.rol !== "ADMINISTRADOR") return;
    let activo = true;

    async function cargarMorosos() {
      setCargando(true);
      try {
        const prestamos = await listarPrestamos(token!);
        if (activo) setMorosos(prestamos.filter(esMoroso));
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "No se pudo cargar la lista de morosos");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarMorosos();

    return () => {
      activo = false;
    };
  }, [token, usuario]);

  if (usuario && usuario.rol !== "ADMINISTRADOR") {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/clientes" className="text-sm text-muted-foreground hover:underline">
          ← Clientes
        </Link>
        <h1 className="text-xl font-semibold">Clientes morosos</h1>
      </div>

      {cargando || !morosos ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, indice) => (
            <Skeleton key={indice} className="h-10 w-full" />
          ))}
        </div>
      ) : morosos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay clientes morosos.</p>
      ) : (
        <DataTable columns={columnasMorosos} data={morosos} searchPlaceholder="Buscar por cliente..." />
      )}
    </div>
  );
}
