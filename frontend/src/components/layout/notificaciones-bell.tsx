"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  contarNotificacionesNoLeidas,
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLasNotificacionesLeidas,
} from "@/lib/notificaciones-api";
import type { Notificacion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const INTERVALO_SONDEO_MS = 30_000;

function formatearFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

/**
 * RF-26/27/28: campanita de notificaciones. Sondea el contador de no leídas
 * cada 30s (no hay push real desde el backend) y trae la lista completa cada
 * vez que se abre el menú, para no cargar 100 filas de más en cada tick.
 */
export function NotificacionesBell() {
  const { token } = useAuth();
  const [noLeidas, setNoLeidas] = useState(0);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);

  const refrescarContador = useCallback(async () => {
    if (!token) return;
    try {
      const { noLeidas: total } = await contarNotificacionesNoLeidas(token);
      setNoLeidas(total);
    } catch {
      // El contador es informativo: un fallo puntual de red no debe romper la UI.
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let activo = true;

    async function sondear() {
      try {
        const { noLeidas: total } = await contarNotificacionesNoLeidas(token!);
        if (activo) setNoLeidas(total);
      } catch {
        // El contador es informativo: un fallo puntual de red no debe romper la UI.
      }
    }

    sondear();
    const id = setInterval(sondear, INTERVALO_SONDEO_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [token]);

  async function alAbrir(abre: boolean) {
    setAbierto(abre);
    if (abre && token) {
      try {
        setNotificaciones(await listarNotificaciones(token));
      } catch {
        // Deja la lista anterior si falla la carga.
      }
    }
  }

  async function alHacerClic(notificacion: Notificacion) {
    if (notificacion.leida || !token) return;
    setNotificaciones((actual) =>
      actual.map((n) => (n.id === notificacion.id ? { ...n, leida: true } : n))
    );
    setNoLeidas((actual) => Math.max(0, actual - 1));
    try {
      await marcarNotificacionLeida(token, notificacion.id);
    } catch {
      refrescarContador();
    }
  }

  async function marcarTodas() {
    if (!token) return;
    setNotificaciones((actual) => actual.map((n) => ({ ...n, leida: true })));
    setNoLeidas(0);
    try {
      await marcarTodasLasNotificacionesLeidas(token);
    } catch {
      refrescarContador();
    }
  }

  return (
    <DropdownMenu open={abierto} onOpenChange={alAbrir}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <span className="relative inline-flex">
          <Bell className="size-4" />
          {noLeidas > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-4 min-w-4 justify-center px-1 text-[10px]"
            >
              {noLeidas > 9 ? "9+" : noLeidas}
            </Badge>
          )}
        </span>
        <span className="sr-only">Notificaciones</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1">
          <span className="text-xs font-medium text-muted-foreground">Notificaciones</span>
          {noLeidas > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={marcarTodas}
            >
              Marcar todas leídas
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notificaciones.length === 0 ? (
          <p className="px-1.5 py-3 text-center text-sm text-muted-foreground">
            No tienes notificaciones.
          </p>
        ) : (
          <div className="flex max-h-96 flex-col overflow-y-auto">
            {notificaciones.map((notificacion) => {
              const contenido = (
                <div
                  className={`flex flex-col gap-0.5 rounded-md px-1.5 py-1.5 text-sm ${
                    notificacion.leida ? "" : "bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {!notificacion.leida && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    <span className="font-medium">{notificacion.titulo}</span>
                  </div>
                  <p className="text-muted-foreground">{notificacion.mensaje}</p>
                  <span className="text-xs text-muted-foreground">
                    {formatearFechaHora(notificacion.createdAt)}
                  </span>
                </div>
              );

              return (
                <DropdownMenuItem
                  key={notificacion.id}
                  className="flex-col items-stretch gap-0 p-0"
                  onClick={() => alHacerClic(notificacion)}
                  render={
                    notificacion.prestamoId ? (
                      <Link href={`/prestamos/${notificacion.prestamoId}`}>{contenido}</Link>
                    ) : (
                      <div>{contenido}</div>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
