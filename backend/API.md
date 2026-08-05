# API REST — Sistema de Préstamos

Todas las rutas (excepto `/api/auth/login`) requieren el header:

```
Authorization: Bearer <token>
```

El token se obtiene en el login y determina el rol (`ADMINISTRADOR` o `CLIENTE`). Un
cliente solo puede ver información asociada a su propio `clienteId` (RNF-05); si
intenta acceder a datos de otro préstamo recibe `403`.

Todos los montos de dinero se devuelven como **string con 2 decimales** (ej.
`"367.21"`), nunca como `number`, para no perder precisión en el frontend. Las
fechas se devuelven en ISO 8601 (UTC).

---

## Auth

### `POST /api/auth/login`

```json
// request
{ "email": "admin@prestamos.local", "password": "admin123" }
```

```json
// response 200
{
  "token": "eyJhbGciOi...",
  "usuario": { "id": "86fe8875-...", "email": "admin@prestamos.local", "rol": "ADMINISTRADOR" }
}
```

`401` si las credenciales son inválidas.

---

## Préstamos — `/api/prestamos`

### `POST /api/prestamos/simular` — Administrador

Calcula un cronograma **sin persistir nada** (RF-09). Útil para que el
administrador compare condiciones antes de comprometer el préstamo.

```json
// request
{
  "capital": 1000,
  "tasaInteres": 5,
  "tipoInteres": "MENSUAL",
  "frecuenciaPago": "MENSUAL",
  "numeroCuotas": 3,
  "modalidad": "CUOTAS_FIJAS",
  "fechaDesembolso": "2026-08-03"
}
```

```json
// response 200
{
  "tasaPorCuota": "5",
  "resumen": {
    "totalCapital": "1000.00",
    "totalInteres": "101.63",
    "totalAPagar": "1101.63",
    "numeroCuotas": 3
  },
  "cuotas": [
    { "numero": 1, "fechaVencimiento": "2026-09-03T00:00:00.000Z", "capital": "317.21", "interes": "50.00", "total": "367.21", "saldoCapital": "682.79" },
    { "numero": 2, "fechaVencimiento": "2026-10-03T00:00:00.000Z", "capital": "333.07", "interes": "34.14", "total": "367.21", "saldoCapital": "349.72" },
    { "numero": 3, "fechaVencimiento": "2026-11-03T00:00:00.000Z", "capital": "349.72", "interes": "17.49", "total": "367.21", "saldoCapital": "0.00" }
  ]
}
```

Valores válidos: `tipoInteres` (`DIARIO`, `MENSUAL`, `ANUAL`), `frecuenciaPago`
(`DIARIA`, `SEMANAL`, `QUINCENAL`, `MENSUAL`, `BIMESTRAL`, `TRIMESTRAL`,
`PERSONALIZADA` — requiere `diasPersonalizados`), `modalidad` (`INTERES_FIJO`,
`INTERES_SOBRE_SALDO`, `CUOTAS_FIJAS`).

### `POST /api/prestamos` — Administrador

Registra el préstamo y su cronograma inicial (RF-05, RF-18). Mismo body que
`/simular`, más `clienteId` obligatorio y, opcionalmente, la política de mora
(RF-16): `politicaMora`, `tasaMora`, `diasGracia`.

```json
// request
{
  "clienteId": "3c8047ff-...",
  "capital": 1000,
  "tasaInteres": 5,
  "tipoInteres": "MENSUAL",
  "frecuenciaPago": "MENSUAL",
  "numeroCuotas": 3,
  "modalidad": "CUOTAS_FIJAS",
  "fechaDesembolso": "2026-08-03"
}
```

```json
// response 201
{
  "id": "111c8323-...",
  "cliente": { "id": "3c8047ff-...", "nombre": "Juana", "apellido": "Perez", "documento": "12345678" },
  "capital": "1000.00",
  "capitalPendiente": "1000.00",
  "interesAcumulado": "0.00",
  "moraAcumulada": "0.00",
  "tasaInteres": "5",
  "tipoInteres": "MENSUAL",
  "frecuenciaPago": "MENSUAL",
  "diasPersonalizados": null,
  "numeroCuotas": 3,
  "modalidad": "CUOTAS_FIJAS",
  "fechaDesembolso": "2026-08-03T00:00:00.000Z",
  "estado": "ACTIVO",
  "politicaMora": "NINGUNA",
  "tasaMora": "0",
  "diasGracia": 0,
  "prestamoOrigenId": null,
  "cuotas": [
    {
      "id": "d9794e57-...",
      "numero": 1,
      "fechaVencimiento": "2026-09-03T00:00:00.000Z",
      "capital": "317.21",
      "interes": "50.00",
      "total": "367.21",
      "saldoCapital": "682.79",
      "capitalPagado": "0.00",
      "interesPagado": "0.00",
      "montoPagado": "0.00",
      "mora": "0.00",
      "moraPagada": "0.00",
      "diasAtraso": 0,
      "extensionAplicada": false,
      "estado": "PENDIENTE"
    }
    /* ...una entrada por cuota */
  ]
}
```

Este shape lo produce `prestamos.dto.js` (`prestamoDTO` / `cuotaDTO`), usado por
`crear`, `obtener`, `listar`, `cronograma`, `recalcular`, `refinanciar` y
`actualizar-mora` — todos devuelven la misma forma, ya sin campos internos de
Prisma (`moraCalculadaEn`, `createdAt`/`updatedAt`, `usuarioId`, etc.) y con
dinero formateado a 2 decimales de forma consistente. `tasaInteres`/`tasaMora`
son tasas, no dinero, así que no se recortan a 2 decimales (para no perder
precisión en tasas diarias).

Otros endpoints de préstamos ya existentes (mismo `prestamoDTO`, sin cambios de
comportamiento en esta tarea):

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/prestamos` | Ambos | Lista (cliente ve solo los suyos) |
| GET | `/api/prestamos/:id` | Ambos | Detalle |
| GET | `/api/prestamos/:id/cronograma` | Ambos | Solo las cuotas |
| POST | `/api/prestamos/:id/recalcular` | Admin | RF-09 |
| POST | `/api/prestamos/:id/refinanciar` | Admin | RF-08 |
| POST | `/api/prestamos/:id/actualizar-mora` | Admin | RF-16, idempotente |

---

## Pagos — `/api/pagos`

### `POST /api/pagos`

Body mínimo: `cuotaId`, `monto`. El comportamiento depende del rol del token
(no hay dos endpoints distintos):

- **Cliente** (RF-21): el pago queda `PENDIENTE_CONFIRMACION`, no toca el
  saldo del préstamo todavía.
- **Administrador** (RF-25): el pago se aplica y confirma en el mismo request.

```json
// request
{ "cuotaId": "a02ba8af-...", "monto": 367.21, "metodo": "EFECTIVO" }
```

```json
// response 201 (registrado por el administrador → ya confirmado)
{
  "id": "5668d797-...",
  "prestamoId": "111c8323-...",
  "cuotaId": "d9794e57-...",
  "monto": "367.21",
  "metodo": "EFECTIVO",
  "estado": "CONFIRMADO",
  "moraAplicada": "0.00",
  "interesAplicado": "50.00",
  "capitalAplicado": "317.21",
  "excedente": "0.00",
  "interesCondonado": "0.00",
  "cuotasEliminadas": 0,
  "politicaInteresAnticipado": "COMPLETO",
  "politicaAbonoExtraordinario": "REDUCIR_CUOTA",
  "comprobanteUrl": null,
  "observaciones": null,
  "motivoRechazo": null,
  "fechaPago": "2026-08-04T00:33:31.034Z",
  "fechaConfirmacion": "2026-08-04T00:33:31.056Z",
  "recibo": { "numero": 502, "monto": "367.21", "fechaEmision": "2026-08-04T00:33:31.059Z" },
  "cuota": { "id": "d9794e57-...", "numero": 1, "estado": "PAGADA", "total": "367.21", "montoPagado": "367.21" },
  "prestamo": { "id": "111c8323-...", "clienteId": "3c8047ff-...", "estado": "ACTIVO", "capitalPendiente": "682.79" }
}
```

Shape producido por `pagos.dto.js` (`pagoDTO`), usado en `registrar`, `listar`,
`obtener`, `confirmar` y `rechazar`. Deja fuera `registradoPorId` /
`confirmadoPorId` (ids sin un join útil hoy) y `createdAt`/`updatedAt`; todos
los montos van a 2 decimales.

`metodo` acepta `EFECTIVO`, `TRANSFERENCIA`, `DEPOSITO`, `YAPE_PLIN`, `OTRO`.
Errores de negocio (cuota ya pagada, préstamo no activo, monto ≤ 0, pago que
excede la deuda) responden `400` con `{ "error": "..." }` vía el
`errorHandler` central.

Otros endpoints ya existentes:

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/pagos` | Ambos | Lista, filtros `?estado=` `?prestamoId=` |
| GET | `/api/pagos/:id` | Ambos | Detalle |
| POST | `/api/pagos/:id/confirmar` | Admin | RF-23, aquí se resuelve interés anticipado (RF-14) y abono extraordinario (RF-17) |
| POST | `/api/pagos/:id/rechazar` | Admin | RF-23 |

---

## Clientes — `/api/clientes` (Administrador)

`clientes.dto.js` (`clienteDTO`) aplana el email de la cuenta de usuario
asociada y deja fuera `usuarioId`, `rol` (siempre `CLIENTE`) y
`createdAt`/`updatedAt`.

```json
// response 201 de POST /api/clientes
{
  "id": "3c8047ff-...",
  "nombre": "Juana",
  "apellido": "Perez",
  "documento": "12345678",
  "telefono": "999888777",
  "direccion": null,
  "activo": true,
  "email": "juana.perez@example.com"
}
```

`GET /`, `GET /:id`, `PUT /:id` y `PATCH /:id/desactivar` devuelven el mismo shape.

---

## Dashboard — `/api/dashboard`

### `GET /api/dashboard`

Un solo endpoint; el rol del token decide la vista (RF-29 administrador,
RF-30 cliente). Agrega en una sola llamada lo que antes requería combinar
`/prestamos`, `/prestamos/:id/cronograma` y `/pagos` a mano.

**Administrador:**

```json
{
  "totalPrestado": "1000.00",
  "totalRecuperado": "367.21",
  "interesesGanados": "50.00",
  "capitalPendiente": "682.79",
  "clientesActivos": 1,
  "clientesMorosos": 0,
  "prestamosVencidos": 0,
  "prestamosActivos": 1,
  "proximosCobros": [
    {
      "prestamoId": "111c8323-...",
      "cuotaId": "d1ff6d9c-...",
      "numeroCuota": 2,
      "cliente": "Juana Perez",
      "fechaVencimiento": "2026-10-03T00:00:00.000Z",
      "montoPendiente": "367.21"
    }
  ],
  "flujoCaja": { "hoy": "367.21", "semana": "367.21", "mes": "367.21" }
}
```

- `clientesMorosos` / `prestamosVencidos`: préstamos `ACTIVO` con al menos una
  cuota en estado `VENCIDA`.
- `proximosCobros`: cuotas `PENDIENTE`/`PARCIAL` que vencen en los próximos 7 días.
- `flujoCaja`: suma de pagos `CONFIRMADO` de hoy, de la semana en curso y del mes en curso.

**Cliente** (devuelve un array, uno por cada préstamo propio):

```json
[
  {
    "id": "111c8323-...",
    "estado": "ACTIVO",
    "modalidad": "CUOTAS_FIJAS",
    "capital": "1000.00",
    "capitalPendiente": "682.79",
    "interesPendiente": "51.63",
    "moraAcumulada": "0.00",
    "proximaFechaPago": "2026-10-03T00:00:00.000Z",
    "proximoMonto": "367.21",
    "cronograma": [
      { "numero": 1, "fechaVencimiento": "2026-09-03T00:00:00.000Z", "total": "367.21", "montoPagado": "367.21", "mora": "0.00", "estado": "PAGADA" },
      { "numero": 2, "fechaVencimiento": "2026-10-03T00:00:00.000Z", "total": "367.21", "montoPagado": "0.00", "mora": "0.00", "estado": "PENDIENTE" },
      { "numero": 3, "fechaVencimiento": "2026-11-03T00:00:00.000Z", "total": "367.21", "montoPagado": "0.00", "mora": "0.00", "estado": "PENDIENTE" }
    ],
    "historialPagos": [
      { "id": "5668d797-...", "monto": "367.21", "metodo": "EFECTIVO", "fecha": "2026-08-04T00:33:31.056Z", "cuotaId": "d9794e57-..." }
    ]
  }
]
```

Todos los ejemplos de esta página se capturaron corriendo el servidor contra
la base de datos real (crear cliente → crear préstamo → simular → registrar
pago → consultar dashboard), no son inventados; los datos de prueba se
eliminaron después.

---

## Notificaciones — `/api/notificaciones`

Avisos en la app para RF-26 (recordatorios de vencimiento), RF-27 (estado del
pago del cliente) y RF-28 (avisos al administrador). No hay email/push: son
filas en la tabla `Notificacion` que cada rol consulta con su propio token
(RNF-05 — un cliente solo ve las suyas).

Se generan de dos formas:

- **Por evento**, desde `pagos.service.js`: reportar (RF-21), confirmar y
  rechazar un pago (RF-23) disparan la notificación correspondiente en el
  momento.
- **Por barrido diario**, vía `node-cron` (`src/jobs/notificaciones.job.js`),
  todos los días a las 08:00 hora del servidor. El barrido es idempotente: no
  duplica avisos si se corre más de una vez el mismo día.

### `GET /api/notificaciones`

Las últimas 100 notificaciones del usuario autenticado, más nuevas primero.
`?noLeidas=true` filtra solo las no leídas.

```json
[
  {
    "id": "3f8e...",
    "tipo": "PAGO_CONFIRMADO",
    "titulo": "Tu pago fue confirmado",
    "mensaje": "Confirmamos tu pago de S/ 300.00 para la cuota #1.",
    "leida": false,
    "prestamoId": "6d55551f-...",
    "cuotaId": "bc03a8a8-...",
    "pagoId": "4cf4a07b-...",
    "createdAt": "2026-08-04T17:22:41.000Z"
  }
]
```

`tipo` es uno de: `CUOTA_POR_VENCER_SEMANA`, `CUOTA_POR_VENCER_DIA`,
`CUOTA_VENCE_HOY` (RF-26); `PAGO_REPORTADO`, `PAGO_CONFIRMADO`,
`PAGO_RECHAZADO` (RF-27, y `PAGO_REPORTADO` también llega al administrador
por RF-28); `RESUMEN_DIARIO_ADMIN` (RF-28).

### `GET /api/notificaciones/no-leidas/contador`

```json
{ "noLeidas": 3 }
```

### `POST /api/notificaciones/:id/leer`

Marca una notificación propia como leída. `204` sin cuerpo. `404` si el id no
existe o no pertenece al usuario autenticado.

### `POST /api/notificaciones/leer-todas`

Marca todas las notificaciones no leídas del usuario como leídas. `204` sin cuerpo.

### `POST /api/notificaciones/generar` — Administrador

Dispara a demanda el mismo barrido que corre el cron a las 08:00 (recordatorios
de vencimiento + resumen del administrador). Pensado para pruebas o para
recuperar el día si el proceso estuvo caído a esa hora; el body admite
`fechaReferencia` opcional (ISO) para simular otro día.

```json
// response 200
{ "recordatoriosCreados": 2, "resumenesCreados": 1 }
```

---

## Auditoría — `/api/auditoria` (Administrador)

Bitácora de cambios relevantes (RF-36, RNF-12): quién hizo qué, cuándo, sobre
qué registro. Se alimenta desde los propios servicios de negocio — no hay un
paso manual — cada vez que ocurre una de estas acciones:

- **Cliente**: alta (RF-01), edición (RF-02, con el detalle de qué campos
  cambiaron) y baja (RF-02).
- **Préstamo**: alta (RF-05), recálculo (RF-09) y refinanciamiento (RF-08, el
  registro queda sobre el préstamo nuevo y referencia el id del original).
- **Pago**: reporte del cliente (RF-21) o registro directo del administrador
  (RF-25, que se guarda como `CONFIRMAR` porque se aplica de inmediato),
  confirmación y rechazo de un pago reportado (RF-23).

### `GET /api/auditoria`

Los últimos 200 registros, más nuevos primero. Todos los filtros son opcionales
y combinables por query string:

| Parámetro   | Valores                              |
| ----------- | ------------------------------------- |
| `entidad`   | `CLIENTE`, `PRESTAMO`, `PAGO`          |
| `entidadId` | id de la entidad afectada             |
| `usuarioId` | quién hizo el cambio                  |
| `desde`     | fecha ISO (inclusive)                 |
| `hasta`     | fecha ISO (inclusive)                 |

```json
[
  {
    "id": "9c1a...",
    "entidad": "PAGO",
    "entidadId": "4cf4a07b-...",
    "accion": "CONFIRMAR",
    "detalle": "Pago confirmado: S/ 300.00 para la cuota #1.",
    "usuario": { "email": "admin@prestamos.local", "rol": "ADMINISTRADOR" },
    "createdAt": "2026-08-04T17:22:41.000Z"
  }
]
```

`accion` es uno de: `CREAR`, `ACTUALIZAR`, `DESACTIVAR`, `RECALCULAR`,
`REFINANCIAR`, `CONFIRMAR`, `RECHAZAR`.

---

## Capa de DTOs

Cada módulo que devuelve datos al frontend tiene su propio archivo
`*.dto.js` (`prestamos.dto.js`, `pagos.dto.js`, `clientes.dto.js`) con
funciones puras que traducen el registro de Prisma al shape público — sin
tocar los `*.service.js`, que siguen devolviendo el modelo completo para uso
interno (por ejemplo, `pagos.service.js` necesita `capitalPagado`,
`extensionAplicada`, etc. para sus propios cálculos). El mapeo a DTO ocurre
en el controlador, justo antes de `res.json(...)`. El formateo de dinero
(2 decimales) y tasas vive en `src/utils/dinero.js`, compartido entre esos
tres módulos.

El dashboard (`dashboard.service.js`) ya arma su propio shape curado
directamente, así que no tiene un archivo `.dto.js` separado.

## Fuera de alcance de esta pasada

Del MVP descrito en `requerimientos.md` §9.1, lo único que faltaba exponer era
el dashboard (RF-29/RF-30), ya cubierto arriba. Notificaciones (RF-26 a
RF-28) y bitácora de auditoría (RF-36) ya están cubiertas en las secciones de
arriba. De la Fase 2 (§9.2) quedan pendientes: adjuntar documentos al cliente
y al préstamo (RF-03, RF-33), **reportes exportables a Excel/PDF** (RF-32, hoy
solo hay CSV), firma digital (RF-34), escaneo de DNI (RF-35) y la app móvil
(RF-37).
