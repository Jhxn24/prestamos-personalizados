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

export type TipoInteres = "DIARIO" | "MENSUAL" | "ANUAL";
export type FrecuenciaPago =
  | "DIARIA"
  | "SEMANAL"
  | "QUINCENAL"
  | "MENSUAL"
  | "BIMESTRAL"
  | "TRIMESTRAL"
  | "PERSONALIZADA";

interface ClienteResumen {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
}

/** Cuota tal como la persiste el backend (prestamos.dto.js:cuotaDTO). */
export interface CuotaPrestamo {
  id: string;
  numero: number;
  fechaVencimiento: string;
  capital: string;
  interes: string;
  total: string;
  saldoCapital: string;
  capitalPagado: string;
  interesPagado: string;
  montoPagado: string;
  mora: string;
  moraPagada: string;
  diasAtraso: number;
  extensionAplicada: boolean;
  estado: EstadoCuota;
}

/** GET/POST /api/prestamos — prestamos.dto.js:prestamoDTO. */
export interface Prestamo {
  id: string;
  cliente: ClienteResumen | null;
  capital: string;
  capitalPendiente: string;
  interesAcumulado: string;
  moraAcumulada: string;
  tasaInteres: string;
  tipoInteres: TipoInteres;
  frecuenciaPago: FrecuenciaPago;
  diasPersonalizados: number | null;
  numeroCuotas: number;
  modalidad: ModalidadPrestamo;
  fechaDesembolso: string;
  estado: EstadoPrestamo;
  politicaMora: string;
  tasaMora: string;
  diasGracia: number;
  prestamoOrigenId: string | null;
  cuotas: CuotaPrestamo[];
}

/** Body de POST /api/prestamos/simular y de POST /api/prestamos (sin clienteId). */
export interface SimularPrestamoInput {
  capital: number;
  tasaInteres: number;
  tipoInteres: TipoInteres;
  frecuenciaPago: FrecuenciaPago;
  diasPersonalizados?: number;
  numeroCuotas: number;
  modalidad: ModalidadPrestamo;
  fechaDesembolso: string;
}

export interface CrearPrestamoInput extends SimularPrestamoInput {
  clienteId: string;
}

export interface CuotaSimulada {
  numero: number;
  fechaVencimiento: string;
  capital: string;
  interes: string;
  total: string;
  saldoCapital: string;
}

/** Respuesta de POST /api/prestamos/simular: previsualización, no persiste nada. */
export interface SimularPrestamoResponse {
  tasaPorCuota: string;
  resumen: {
    totalCapital: string;
    totalInteres: string;
    totalAPagar: string;
    numeroCuotas: number;
  };
  cuotas: CuotaSimulada[];
}
