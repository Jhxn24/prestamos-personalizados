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
el dashboard (RF-29/RF-30), ya cubierto arriba. **Notificaciones** (RF-26 a
RF-28) y **reportes exportables** (RF-31, RF-32) están explícitamente en Fase
2 (§9.2) y no se tocaron.
