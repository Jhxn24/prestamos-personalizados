"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { cambiarPassword } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PurgarDatosDialog } from "@/components/sistema/purgar-datos-dialog";

export default function CuentaPage() {
  const { token, usuario } = useAuth();
  const router = useRouter();

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmarNueva, setConfirmarNueva] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [purgarAbierto, setPurgarAbierto] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (passwordNueva.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (passwordNueva !== confirmarNueva) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    if (!token) return;

    setEnviando(true);
    try {
      await cambiarPassword(token, { passwordActual, passwordNueva });
      toast.success("Contraseña actualizada");
      setPasswordActual("");
      setPasswordNueva("");
      setConfirmarNueva("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Mi cuenta</h1>

      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <p className="text-sm text-muted-foreground">{usuario?.email}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="passwordActual">Contraseña actual</Label>
              <Input
                id="passwordActual"
                type="password"
                autoComplete="current-password"
                required
                value={passwordActual}
                onChange={(event) => setPasswordActual(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="passwordNueva">Nueva contraseña</Label>
              <Input
                id="passwordNueva"
                type="password"
                autoComplete="new-password"
                required
                value={passwordNueva}
                onChange={(event) => setPasswordNueva(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmarNueva">Confirmar nueva contraseña</Label>
              <Input
                id="confirmarNueva"
                type="password"
                autoComplete="new-password"
                required
                value={confirmarNueva}
                onChange={(event) => setConfirmarNueva(event.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={enviando} className="self-start">
              {enviando ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {usuario?.rol === "ADMINISTRADOR" && (
        <Card className="max-w-sm border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de peligro</CardTitle>
            <p className="text-sm text-muted-foreground">
              Borra permanentemente todos los clientes, préstamos y pagos. No se puede deshacer.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setPurgarAbierto(true)}>
              Eliminar todos los datos
            </Button>
          </CardContent>
        </Card>
      )}

      <PurgarDatosDialog
        open={purgarAbierto}
        onOpenChange={setPurgarAbierto}
        onSuccess={() => {
          router.push("/dashboard");
          router.refresh();
        }}
      />
    </div>
  );
}
