"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { crearCliente, actualizarCliente } from "@/lib/clientes-api";
import type { Cliente } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface CamposForm {
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  direccion: string;
  email: string;
  password: string;
}

const CAMPOS_VACIOS: CamposForm = {
  nombre: "",
  apellido: "",
  documento: "",
  telefono: "",
  direccion: "",
  email: "",
  password: "",
};

function datosDelCliente(cliente: Cliente): CamposForm {
  return {
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    documento: cliente.documento,
    telefono: cliente.telefono ?? "",
    direccion: cliente.direccion ?? "",
    email: cliente.email ?? "",
    password: "",
  };
}

interface ClienteFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: "crear" | "editar";
  /** Requerido cuando modo === "editar". */
  cliente?: Cliente | null;
  onSuccess: (cliente: Cliente) => void;
}

/**
 * Sheet compartido para crear y editar clientes. En modo "editar" oculta
 * email/password: el backend (clientes.service.js:actualizarCliente) no los
 * acepta en PUT /api/clientes/:id, solo los recibe POST al crear.
 */
export function ClienteFormSheet({
  open,
  onOpenChange,
  modo,
  cliente,
  onSuccess,
}: ClienteFormSheetProps) {
  const { token } = useAuth();
  const [campos, setCampos] = useState<CamposForm>(CAMPOS_VACIOS);
  const [errores, setErrores] = useState<Partial<Record<keyof CamposForm, string>>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function reiniciarFormulario() {
      if (!open) return;
      setCampos(modo === "editar" && cliente ? datosDelCliente(cliente) : CAMPOS_VACIOS);
      setErrores({});
    }
    reiniciarFormulario();
  }, [open, modo, cliente]);

  function actualizarCampo(campo: keyof CamposForm, valor: string) {
    setCampos((actual) => ({ ...actual, [campo]: valor }));
  }

  function validar(): boolean {
    const nuevosErrores: Partial<Record<keyof CamposForm, string>> = {};
    if (!campos.nombre.trim()) nuevosErrores.nombre = "Obligatorio";
    if (!campos.apellido.trim()) nuevosErrores.apellido = "Obligatorio";
    if (!campos.documento.trim()) nuevosErrores.documento = "Obligatorio";

    // El acceso a la app es opcional (uso local): si se llena uno de los dos
    // campos, se exige el otro; si no se llena ninguno, el cliente queda sin cuenta.
    if (modo === "crear") {
      const email = campos.email.trim();
      const password = campos.password;

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        nuevosErrores.email = "Email inválido";
      }
      if (password && password.length < 6) {
        nuevosErrores.password = "Mínimo 6 caracteres";
      }
      if (email && !password) {
        nuevosErrores.password = "Obligatorio si se llena el email";
      }
      if (password && !email) {
        nuevosErrores.email = "Obligatorio si se llena la contraseña";
      }
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !validar()) return;

    setEnviando(true);
    try {
      const email = campos.email.trim();
      const resultado =
        modo === "crear"
          ? await crearCliente(token, {
              nombre: campos.nombre.trim(),
              apellido: campos.apellido.trim(),
              documento: campos.documento.trim(),
              ...(email && campos.password ? { email, password: campos.password } : {}),
              telefono: campos.telefono.trim() || undefined,
              direccion: campos.direccion.trim() || undefined,
            })
          : await actualizarCliente(token, cliente!.id, {
              nombre: campos.nombre.trim(),
              apellido: campos.apellido.trim(),
              documento: campos.documento.trim(),
              telefono: campos.telefono.trim(),
              direccion: campos.direccion.trim(),
            });

      toast.success(modo === "crear" ? "Cliente registrado" : "Cliente actualizado");
      onSuccess(resultado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar el cliente");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{modo === "crear" ? "Nuevo cliente" : "Editar cliente"}</SheetTitle>
          <SheetDescription>
            {modo === "crear"
              ? "El acceso a la app es opcional: puedes agregarlo después desde el detalle del cliente."
              : "El email y la contraseña no se editan desde aquí."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={campos.nombre}
                onChange={(event) => actualizarCampo("nombre", event.target.value)}
              />
              {errores.nombre && <p className="text-sm text-destructive">{errores.nombre}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                value={campos.apellido}
                onChange={(event) => actualizarCampo("apellido", event.target.value)}
              />
              {errores.apellido && <p className="text-sm text-destructive">{errores.apellido}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="documento">Documento</Label>
            <Input
              id="documento"
              value={campos.documento}
              onChange={(event) => actualizarCampo("documento", event.target.value)}
            />
            {errores.documento && <p className="text-sm text-destructive">{errores.documento}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="telefono">Teléfono (opcional)</Label>
            <Input
              id="telefono"
              value={campos.telefono}
              onChange={(event) => actualizarCampo("telefono", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="direccion">Dirección (opcional)</Label>
            <Input
              id="direccion"
              value={campos.direccion}
              onChange={(event) => actualizarCampo("direccion", event.target.value)}
            />
          </div>

          {modo === "crear" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={campos.email}
                  onChange={(event) => actualizarCampo("email", event.target.value)}
                />
                {errores.email && <p className="text-sm text-destructive">{errores.email}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contraseña (opcional)</Label>
                <Input
                  id="password"
                  type="password"
                  value={campos.password}
                  onChange={(event) => actualizarCampo("password", event.target.value)}
                />
                {errores.password && <p className="text-sm text-destructive">{errores.password}</p>}
              </div>
            </>
          )}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={enviando}>
              {enviando ? "Guardando..." : "Guardar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
