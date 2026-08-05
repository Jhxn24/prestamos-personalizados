"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { cambiarPassword } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CuentaPage() {
  const { token, usuario } = useAuth();

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmarNueva, setConfirmarNueva] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
    </div>
  );
}
