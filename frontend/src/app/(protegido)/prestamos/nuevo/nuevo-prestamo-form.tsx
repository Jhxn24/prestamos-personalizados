"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listarClientes } from "@/lib/clientes-api";
import { crearPrestamo } from "@/lib/prestamos-api";
import type { Cliente, SimularPrestamoInput, SimularPrestamoResponse } from "@/lib/types";
import { SimuladorForm } from "@/components/prestamos/simulador-form";
import { CronogramaTable } from "@/components/prestamos/cronograma-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

export function NuevoPrestamoForm() {
  const { token, usuario } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [clienteId, setClienteId] = useState(searchParams.get("clienteId") ?? "");

  const [datosSimulados, setDatosSimulados] = useState<SimularPrestamoInput | null>(null);
  const [resultado, setResultado] = useState<SimularPrestamoResponse | null>(null);
  const [registrando, setRegistrando] = useState(false);

  useEffect(() => {
    if (usuario && usuario.rol !== "ADMINISTRADOR") {
      router.replace("/dashboard");
    }
  }, [usuario, router]);

  useEffect(() => {
    if (!token || usuario?.rol !== "ADMINISTRADOR") return;
    let activo = true;

    async function cargarClientes() {
      try {
        const respuesta = await listarClientes(token!);
        if (activo) setClientes(respuesta.filter((cliente) => cliente.activo));
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "No se pudo cargar la lista de clientes");
      }
    }

    cargarClientes();

    return () => {
      activo = false;
    };
  }, [token, usuario]);

  function alSimular(datos: SimularPrestamoInput, respuesta: SimularPrestamoResponse) {
    setDatosSimulados(datos);
    setResultado(respuesta);
  }

  async function registrarPrestamo() {
    if (!token || !clienteId || !datosSimulados) return;

    setRegistrando(true);
    try {
      const prestamo = await crearPrestamo(token, { ...datosSimulados, clienteId });
      toast.success("Préstamo registrado");
      router.push(`/prestamos/${prestamo.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo registrar el préstamo");
    } finally {
      setRegistrando(false);
    }
  }

  if (usuario && usuario.rol !== "ADMINISTRADOR") {
    return null;
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Nuevo préstamo</h1>

      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label>Cliente</Label>
          <Select
            items={(clientes ?? []).map((cliente) => ({
              value: cliente.id,
              label: `${cliente.nombre} ${cliente.apellido} — ${cliente.documento}`,
            }))}
            value={clienteId}
            onValueChange={(valor) => setClienteId(valor ?? "")}
            disabled={!clientes}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes?.map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.nombre} {cliente.apellido} — {cliente.documento}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Condiciones del préstamo</CardTitle>
        </CardHeader>
        <CardContent>
          <SimuladorForm onSimulado={alSimular} />
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle>Previsualización del cronograma</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total capital</p>
                <p className="font-semibold">{formatearMoneda(resultado.resumen.totalCapital)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total interés</p>
                <p className="font-semibold">{formatearMoneda(resultado.resumen.totalInteres)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total a pagar</p>
                <p className="font-semibold">{formatearMoneda(resultado.resumen.totalAPagar)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">N° de cuotas</p>
                <p className="font-semibold">{resultado.resumen.numeroCuotas}</p>
              </div>
            </div>

            <CronogramaTable cuotas={resultado.cuotas} variant="simulacion" />

            <Button onClick={registrarPrestamo} disabled={!clienteId || registrando} className="self-start">
              {registrando ? "Registrando..." : "Registrar préstamo"}
            </Button>
            {!clienteId && (
              <p className="text-sm text-muted-foreground">Elige un cliente para poder registrar el préstamo.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
