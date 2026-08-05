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

/** Body de POST /api/auth/registrar-admin — solo funciona si no existe ningún usuario aún. */
export interface RegistrarAdminInput {
  email: string;
  password: string;
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

export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "DEPOSITO" | "YAPE_PLIN" | "OTRO";
export type EstadoPago = "PENDIENTE_CONFIRMACION" | "CONFIRMADO" | "RECHAZADO";
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
  fechaPago: string;
  fechaConfirmacion: string | null;
  recibo: ReciboPago | null;
  cuota: CuotaResumenPago | null;
  prestamo: PrestamoResumenPago | null;
}

/**
 * Body de POST /api/pagos. Las políticas solo tienen efecto cuando las manda
 * el administrador (registrar = confirmar en el mismo request); un cliente
 * que reporta un pago no puede condonarse interés a sí mismo (RF-14).
 */
export interface RegistrarPagoInput {
  cuotaId: string;
  monto: number;
  metodo: MetodoPago;
  comprobanteUrl?: string;
  observaciones?: string;
  politicaInteresAnticipado?: PoliticaInteresAnticipado;
  politicaAbonoExtraordinario?: PoliticaAbonoExtraordinario;
}

/** Body de POST /api/pagos/:id/confirmar. */
export interface ConfirmarPagoInput {
  politicaInteresAnticipado?: PoliticaInteresAnticipado;
  politicaAbonoExtraordinario?: PoliticaAbonoExtraordinario;
}

/** RF-26/27/28. */
export type TipoNotificacion =
  | "CUOTA_POR_VENCER_SEMANA"
  | "CUOTA_POR_VENCER_DIA"
  | "CUOTA_VENCE_HOY"
  | "PAGO_REPORTADO"
  | "PAGO_CONFIRMADO"
  | "PAGO_RECHAZADO"
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

/** RF-36/RNF-12. */
export type EntidadAuditoria = "CLIENTE" | "PRESTAMO" | "PAGO";

export type AccionAuditoria =
  | "CREAR"
  | "ACTUALIZAR"
  | "DESACTIVAR"
  | "RECALCULAR"
  | "REFINANCIAR"
  | "CONFIRMAR"
  | "RECHAZAR";

/** GET /api/auditoria — auditoria.dto.js:registroAuditoriaDTO. */
export interface RegistroAuditoria {
  id: string;
  entidad: EntidadAuditoria;
  entidadId: string;
  accion: AccionAuditoria;
  detalle: string | null;
  usuario: { email: string; rol: Rol };
  createdAt: string;
}
