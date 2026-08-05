"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { generarAccesoCliente } from "@/lib/clientes-api";
import type { Cliente } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GenerarAccesoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente | null;
  onSuccess: (cliente: Cliente) => void;
}

/** Agrega una cuenta de acceso a un cliente que no tenía (RF-04 opcional). */
export function GenerarAccesoDialog({ open, onOpenChange, cliente, onSuccess }: GenerarAccesoDialogProps) {
  const { token } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errores, setErrores] = useState<{ email?: string; password?: string }>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function reiniciar() {
      if (!open) return;
      setEmail("");
      setPassword("");
      setErrores({});
    }
    reiniciar();
  }, [open]);

  function validar(): boolean {
    const nuevosErrores: { email?: string; password?: string } = {};
    if (!email.trim()) {
      nuevosErrores.email = "Obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nuevosErrores.email = "Email inválido";
    }
    if (!password) {
      nuevosErrores.password = "Obligatorio";
    } else if (password.length < 6) {
      nuevosErrores.password = "Mínimo 6 caracteres";
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !cliente || !validar()) return;

    setEnviando(true);
    try {
      const actualizado = await generarAccesoCliente(token, cliente.id, { email: email.trim(), password });
      toast.success("Acceso generado");
      onSuccess(actualizado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo generar el acceso");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar acceso</DialogTitle>
          <DialogDescription>
            Crea una cuenta para que {cliente ? `${cliente.nombre} ${cliente.apellido}` : "el cliente"} pueda
            entrar a la app.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-acceso">Email</Label>
            <Input
              id="email-acceso"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errores.email && <p className="text-sm text-destructive">{errores.email}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password-acceso">Contraseña</Label>
            <Input
              id="password-acceso"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {errores.password && <p className="text-sm text-destructive">{errores.password}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Generando..." : "Generar acceso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
