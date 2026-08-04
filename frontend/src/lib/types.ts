// Tipos que reflejan los DTOs documentados en backend/API.md.
// Los montos de dinero llegan siempre como string con 2 decimales (nunca number).

export type Rol = "ADMINISTRADOR" | "CLIENTE";

export interface Usuario {
  id: string;
  email: string;
  rol: Rol;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

/** GET/POST/PUT /api/clientes — clienteDTO en backend/clientes.dto.js. */
export interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
  email: string;
}

/** Body de POST /api/clientes. El backend crea la cuenta de usuario asociada. */
export interface CrearClienteInput {
  nombre: string;
  apellido: string;
  documento: string;
  email: string;
  password: string;
  telefono?: string;
  direccion?: string;
}

/**
 * Body de PUT /api/clientes/:id. El backend solo acepta estos 5 campos
 * (clientes.service.js:actualizarCliente) — email y password no son editables
 * por esta vía.
 */
export interface ActualizarClienteInput {
  nombre: string;
  apellido: string;
  documento: string;
  telefono?: string;
  direccion?: string;
}

export interface ProximoCobro {
  prestamoId: string;
  cuotaId: string;
  numeroCuota: number;
  cliente: string;
  fechaVencimiento: string;
  montoPendiente: string;
}

export interface FlujoCaja {
  hoy: string;
  semana: string;
  mes: string;
}

/** GET /api/dashboard cuando el token es de un ADMINISTRADOR. */
export interface DashboardAdmin {
  totalPrestado: string;
  totalRecuperado: string;
  interesesGanados: string;
  capitalPendiente: string;
  clientesActivos: number;
  clientesMorosos: number;
  prestamosVencidos: number;
  prestamosActivos: number;
  proximosCobros: ProximoCobro[];
  flujoCaja: FlujoCaja;
}

export type EstadoCuota = "PENDIENTE" | "PARCIAL" | "PAGADA" | "VENCIDA";
export type EstadoPrestamo = "ACTIVO" | "PAGADO" | "REFINANCIADO" | "CANCELADO";
export type ModalidadPrestamo = "INTERES_FIJO" | "INTERES_SOBRE_SALDO" | "CUOTAS_FIJAS";

export interface CuotaResumen {
  numero: number;
  fechaVencimiento: string;
  total: string;
  montoPagado: string;
  mora: string;
  estado: EstadoCuota;
}

export interface PagoHistorial {
  id: string;
  monto: string;
  metodo: string;
  fecha: string | null;
  cuotaId: string | null;
}

export interface DashboardClientePrestamo {
  id: string;
  estado: EstadoPrestamo;
  modalidad: ModalidadPrestamo;
  capital: string;
  capitalPendiente: string;
  interesPendiente: string;
  moraAcumulada: string;
  proximaFechaPago: string | null;
  proximoMonto: string | null;
  cronograma: CuotaResumen[];
  historialPagos: PagoHistorial[];
}

/** GET /api/dashboard cuando el token es de un CLIENTE: un préstamo propio por entrada. */
export type DashboardCliente = DashboardClientePrestamo[];
