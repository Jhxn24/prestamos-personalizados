// Tipos que reflejan los DTOs documentados en backend/API.md.
// Los montos de dinero llegan siempre como string con 2 decimales (nunca number).
// Copiado y recortado de frontend/src/lib/types.ts al subconjunto que usa la app móvil.

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

/** Body de POST /api/auth/cambiar-password. */
export interface CambiarPasswordInput {
  passwordActual: string;
  passwordNueva: string;
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
  email: string | null;
  /** false si el cliente no tiene cuenta de acceso a la app (uso local, opcional). */
  tieneAcceso: boolean;
}

/**
 * Body de POST /api/clientes. El acceso a la app es opcional: si se manda
 * email, password es obligatorio (y viceversa); si no se manda ninguno, el
 * cliente queda sin cuenta y se le puede agregar después con
 * `generarAccesoCliente`.
 */
export interface CrearClienteInput {
  nombre: string;
  apellido: string;
  documento: string;
  email?: string;
  password?: string;
  telefono?: string;
  direccion?: string;
}

/** Body de PATCH /api/clientes/:id/generar-acceso. */
export interface GenerarAccesoClienteInput {
  email: string;
  password: string;
}

/** Body de PUT /api/clientes/:id — email y password no son editables por esta vía. */
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
export type ModalidadPrestamo =
  | "INTERES_FIJO"
  | "INTERES_SOBRE_SALDO"
  | "CUOTAS_FIJAS"
  | "CAPITAL_AL_FINAL";

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

/** GET/POST /api/prestamos — prestamos.dto.js:prestamoDTO. Usado por el admin (morosos). */
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

/** Body de POST /api/prestamos/simular y de POST/recalcular/refinanciar (sin clienteId). */
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

export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "DEPOSITO" | "YAPE_PLIN" | "OTRO";
/**
 * PENDIENTE_CONFIRMACION y RECHAZADO son valores legado (ya no se producen):
 * el admin marca un pago directamente como CONFIRMADO, o lo anula (ANULADO).
 */
export type EstadoPago = "PENDIENTE_CONFIRMACION" | "CONFIRMADO" | "RECHAZADO" | "ANULADO";
export type PoliticaInteresAnticipado = "COMPLETO" | "PROPORCIONAL";
export type PoliticaAbonoExtraordinario = "REDUCIR_CUOTA" | "REDUCIR_PLAZO";

interface ReciboPago {
  numero: number;
  monto: string;
  fechaEmision: string;
}

interface CuotaResumenPago {
  id: string;
  numero: number;
  estado: EstadoCuota;
  total: string;
  montoPagado: string;
}

interface PrestamoResumenPago {
  id: string;
  clienteId: string;
  estado: EstadoPrestamo;
  capitalPendiente: string;
}

/** GET/POST /api/pagos — pagos.dto.js:pagoDTO. */
export interface Pago {
  id: string;
  prestamoId: string;
  cuotaId: string | null;
  monto: string;
  metodo: MetodoPago;
  estado: EstadoPago;
  moraAplicada: string;
  interesAplicado: string;
  capitalAplicado: string;
  excedente: string;
  interesCondonado: string;
  cuotasEliminadas: number;
  politicaInteresAnticipado: PoliticaInteresAnticipado;
  politicaAbonoExtraordinario: PoliticaAbonoExtraordinario;
  comprobanteUrl: string | null;
  observaciones: string | null;
  motivoRechazo: string | null;
  motivoAnulacion: string | null;
  fechaPago: string;
  fechaConfirmacion: string | null;
  fechaAnulacion: string | null;
  recibo: ReciboPago | null;
  cuota: CuotaResumenPago | null;
  prestamo: PrestamoResumenPago | null;
}

/**
 * Body de POST /api/pagos. Solo el administrador registra pagos y se aplican
 * de inmediato (RF-25). `metodo` es opcional (el backend por defecto usa
 * EFECTIVO) para simplificar el formulario móvil.
 */
export interface RegistrarPagoInput {
  cuotaId: string;
  monto: number;
  metodo?: MetodoPago;
  comprobanteUrl?: string;
  observaciones?: string;
  politicaInteresAnticipado?: PoliticaInteresAnticipado;
  politicaAbonoExtraordinario?: PoliticaAbonoExtraordinario;
}

/** Body de POST /api/pagos/:id/anular. */
export interface AnularPagoInput {
  motivo?: string;
}

/** Body de POST /api/sistema/purgar-datos. Irreversible. */
export interface PurgarDatosInput {
  confirmacion: string;
  password: string;
}

export interface PurgarDatosResultado {
  clientes: number;
  prestamos: number;
  pagos: number;
  cuentasCliente: number;
}

/** RF-26/27/28. */
export type TipoNotificacion =
  | "CUOTA_POR_VENCER_SEMANA"
  | "CUOTA_POR_VENCER_DIA"
  | "CUOTA_VENCE_HOY"
  | "PAGO_REPORTADO"
  | "PAGO_CONFIRMADO"
  | "PAGO_RECHAZADO"
  | "PAGO_ANULADO"
  | "RESUMEN_DIARIO_ADMIN";

/** GET /api/notificaciones — notificaciones.dto.js:notificacionDTO. */
export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  prestamoId: string | null;
  cuotaId: string | null;
  pagoId: string | null;
  createdAt: string;
}
