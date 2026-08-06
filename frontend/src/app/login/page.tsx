"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
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

  const [modo, setModo] = useState<"login" | "registro">("login");
  const esRegistro = modo === "registro";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function cambiarModo(siguiente: "login" | "registro") {
    setModo(siguiente);
    setError(null);
    setPassword("");
    setConfirmarPassword("");
  }

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

  async function handleSubmitRegistro(event: FormEvent) {
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

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{esRegistro ? "Crear cuenta de administrador" : "Iniciar sesión"}</CardTitle>
          <CardDescription>
            {esRegistro
              ? "Cada administrador tiene su propia cartera de clientes y préstamos, separada de la de los demás."
              : "Sistema de Gestión de Préstamos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={esRegistro ? handleSubmitRegistro : handleSubmitLogin}
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
                autoComplete={esRegistro ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {esRegistro && (
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
              {cargando ? "Guardando..." : esRegistro ? "Crear cuenta" : "Ingresar"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => cambiarModo(esRegistro ? "login" : "registro")}
            className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {esRegistro ? "Ya tengo una cuenta, iniciar sesión" : "Crear una cuenta de administrador"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
