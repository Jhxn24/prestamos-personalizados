"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { verificarSetupRequerido } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const { login, registrarAdmin } = useAuth();
  const router = useRouter();

  // null mientras se resuelve contra el backend: evita parpadear entre los dos formularios.
  const [setupRequerido, setSetupRequerido] = useState<boolean | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let activo = true;
    verificarSetupRequerido()
      .then(({ requerido }) => {
        if (activo) setSetupRequerido(requerido);
      })
      .catch(() => {
        // Si falla la verificación (ej. backend caído), se asume login normal.
        if (activo) setSetupRequerido(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  async function handleSubmitLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setCargando(false);
    }
  }

  async function handleSubmitSetup(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setCargando(true);
    try {
      await registrarAdmin(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta");
    } finally {
      setCargando(false);
    }
  }

  if (setupRequerido === null) {
    return null;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{setupRequerido ? "Crear cuenta de administrador" : "Iniciar sesión"}</CardTitle>
          <CardDescription>
            {setupRequerido
              ? "Primera vez que se usa el sistema: crea la cuenta del administrador."
              : "Sistema de Gestión de Préstamos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={setupRequerido ? handleSubmitSetup : handleSubmitLogin}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete={setupRequerido ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {setupRequerido && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmarPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmarPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmarPassword}
                  onChange={(event) => setConfirmarPassword(event.target.value)}
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={cargando} className="mt-2">
              {cargando ? "Guardando..." : setupRequerido ? "Crear cuenta" : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
