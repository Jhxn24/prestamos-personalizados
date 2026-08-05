import type { ReactNode } from "react";
import Link from "next/link";
import type { Usuario } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificacionesBell } from "@/components/layout/notificaciones-bell";

interface AppShellProps {
  usuario: Usuario;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ usuario, onLogout, children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="no-print flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Sistema de Préstamos</span>
          <Badge variant="secondary">
            {usuario.rol === "ADMINISTRADOR" ? "Administrador" : "Cliente"}
          </Badge>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/prestamos" className="text-muted-foreground hover:text-foreground">
              Préstamos
            </Link>
            <Link href="/pagos" className="text-muted-foreground hover:text-foreground">
              Pagos
            </Link>
            {usuario.rol === "ADMINISTRADOR" && (
              <Link href="/clientes" className="text-muted-foreground hover:text-foreground">
                Clientes
              </Link>
            )}
            {usuario.rol === "ADMINISTRADOR" && (
              <Link href="/reportes" className="text-muted-foreground hover:text-foreground">
                Reportes
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <NotificacionesBell />
          <span className="text-sm text-muted-foreground">{usuario.email}</span>
          <Button variant="outline" size="sm" onClick={onLogout}>
            Cerrar sesión
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
