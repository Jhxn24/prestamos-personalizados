# API REST — Sistema de Préstamos

Todas las rutas (excepto `/api/auth/login`) requieren el header:

```
Authorization: Bearer <token>
```

El token se obtiene en el login y determina el rol (`ADMINISTRADOR` o `CLIENTE`). Un
cliente solo puede ver información asociada a su propio `clienteId` (RNF-05); si
intenta acceder a datos de otro préstamo recibe `403`.

**Multi-tenant**: puede haber varios administradores en la misma base de datos,
cada uno con su propia cartera de clientes/préstamos/pagos, completamente
aislada de la de los demás. Un administrador solo ve y puede operar sobre lo
que él mismo creó; intentar acceder por id a un cliente, préstamo o pago de
otro administrador responde `404` (no se distingue de "no existe", para no
filtrar su existencia).

Todos los montos de dinero se devuelven como **string con 2 decimales** (ej.
`"367.21"`), nunca como `number`, para no perder precisión en el frontend. Las
fechas se devuelven en ISO 8601 (UTC).

---

## Auth

### `POST /api/auth/registrar-admin`

Sin autenticación. Registro de administrador **siempre abierto** (multi-tenant):
cualquiera con la URL puede crear una cuenta de administrador, sin límite de
cuántas puedan existir. Cada administrador arranca con su propia cartera
vacía, aislada de la de los demás — no hay un paso de "bootstrap" separado.

```json
// request
{ "email": "admin@prestamos.local", "password": "admin123" }
```

```json
// response 201 — mismo shape que el login
{
  "token": "eyJhbGciOi...",
  "usuario": { "id": "86fe8875-...", "email": "admin@prestamos.local", "rol": "ADMINISTRADOR" }
}
```

`400` si el email es inválido o la contraseña tiene menos de 6 caracteres.
`409` si ya existe una cuenta con ese email (`{ "error": "Ya existe una cuenta con ese email." }`).

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

### `POST /api/auth/cambiar-password`

Requiere token. Cualquier rol cambia su propia contraseña; pide la actual
(no hay reseteo por email en este MVP).

```json
// request
{ "passwordActual": "admin123", "passwordNueva": "unaClaveNueva123" }
```

`204` sin cuerpo si se actualizó. `400` si falta algún campo o la nueva
contraseña tiene menos de 6 caracteres. `401` si `passwordActual` no coincide.

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
`INTERES_SOBRE_SALDO`, `CUOTAS_FIJAS`, `CAPITAL_AL_FINAL`).

`CAPITAL_AL_FINAL` es un préstamo "bala": todas las cuotas son solo interés
(`capital: "0"`) salvo la última, que lleva el 100% del capital más el interés
de ese periodo. Ejemplo con `capital: 1800, numeroCuotas: 2, tasaInteres: 5,
tipoInteres/frecuenciaPago: MENSUAL`:

```json
{
  "cuotas": [
    { "numero": 1, "capital": "0.00", "interes": "90.00", "total": "90.00", "saldoCapital": "1800.00" },
    { "numero": 2, "capital": "1800.00", "interes": "90.00", "total": "1890.00", "saldoCapital": "0.00" }
  ]
}
```

No soporta `politicaAbonoExtraordinario: "REDUCIR_PLAZO"` en esta versión
(ver sección de Pagos) — solo `REDUCIR_CUOTA`.

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

Solo el administrador marca pagos: no existe autorreporte del cliente ni un
paso de confirmación aparte. Un pago se aplica al préstamo en el mismo
request en que se registra (RF-25); si se marcó por error, se anula (revierte
sus efectos) en vez de "rechazarse".

### `POST /api/pagos` — Administrador

Body mínimo: `cuotaId`, `monto`. Las políticas de interés anticipado (RF-14)
y abono extraordinario (RF-17) se deciden en este mismo request, porque no
hay un paso posterior donde resolverlas.

```json
// request
{ "cuotaId": "a02ba8af-...", "monto": 367.21, "metodo": "EFECTIVO" }
```

```json
// response 201 (ya aplicado y confirmado)
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
  "motivoAnulacion": null,
  "fechaPago": "2026-08-04T00:33:31.034Z",
  "fechaConfirmacion": "2026-08-04T00:33:31.056Z",
  "fechaAnulacion": null,
  "recibo": { "numero": 502, "monto": "367.21", "fechaEmision": "2026-08-04T00:33:31.059Z" },
  "cuota": { "id": "d9794e57-...", "numero": 1, "estado": "PAGADA", "total": "367.21", "montoPagado": "367.21" },
  "prestamo": { "id": "111c8323-...", "clienteId": "3c8047ff-...", "estado": "ACTIVO", "capitalPendiente": "682.79" }
}
```

Shape producido por `pagos.dto.js` (`pagoDTO`), usado en `registrar`, `listar`,
`obtener` y `anular`. Deja fuera `registradoPorId` / `confirmadoPorId` /
`anuladoPorId` (ids sin un join útil hoy) y `createdAt`/`updatedAt`; todos los
montos van a 2 decimales.

`metodo` acepta `EFECTIVO`, `TRANSFERENCIA`, `DEPOSITO`, `YAPE_PLIN`, `OTRO`.
Errores de negocio (cuota ya pagada, préstamo no activo, monto ≤ 0, pago que
excede la deuda, `REDUCIR_PLAZO` sobre un préstamo `CAPITAL_AL_FINAL`)
responden `400` con `{ "error": "..." }` vía el `errorHandler` central.

### `POST /api/pagos/:id/anular` — Administrador

Revierte un pago marcado por error: el capital pendiente del préstamo, la
cuota y el recibo vuelven exactamente al estado previo a ese pago. Body
opcional: `{ "motivo": "..." }`.

Solo se puede anular el pago `CONFIRMADO` **más reciente** de un préstamo
(si hay uno posterior, hay que anular ese primero) y solo si no eliminó
cuotas del cronograma al aplicarse (abono extraordinario con
`REDUCIR_PLAZO`) — en ese caso el ajuste se hace manualmente. `400` con un
mensaje descriptivo si no se cumple alguna de estas condiciones.

```json
// response 200
{ "...": "mismo shape que POST, con estado: \"ANULADO\", motivoAnulacion, fechaAnulacion" }
```

Otros endpoints ya existentes:

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/pagos` | Ambos | Lista, filtros `?estado=` (`CONFIRMADO`\|`ANULADO`) `?prestamoId=` |
| GET | `/api/pagos/:id` | Ambos | Detalle |

---

## Clientes — `/api/clientes` (Administrador)

`clientes.dto.js` (`clienteDTO`) aplana el email de la cuenta de usuario
asociada y deja fuera `usuarioId`, `rol` (siempre `CLIENTE`) y
`createdAt`/`updatedAt`.

El acceso a la app es **opcional** (uso local del prestamista): `email` y
`password` no son obligatorios al crear un cliente — si se manda uno, se
exige el otro; si no se manda ninguno, el cliente queda sin cuenta
(`tieneAcceso: false`, `email: null`) y se le puede agregar acceso después.

```json
// response 201 de POST /api/clientes (sin email/password)
{
  "id": "3c8047ff-...",
  "nombre": "Juana",
  "apellido": "Perez",
  "documento": "12345678",
  "telefono": "999888777",
  "direccion": null,
  "activo": true,
  "email": null,
  "tieneAcceso": false
}
```

`GET /`, `GET /:id`, `PUT /:id` y `PATCH /:id/desactivar` devuelven el mismo shape.

### `PATCH /api/clientes/:id/generar-acceso` — Administrador

Agrega una cuenta de acceso a un cliente que no tenía. Body obligatorio:
`{ "email": "...", "password": "..." }`.

`404` si el cliente no existe. `409` (`CLIENTE_YA_TIENE_ACCESO`) si ya tiene
una cuenta — esta vía es de un solo uso, no reemplaza credenciales
existentes.

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
pago del cliente) y RF-28 (avisos al administrador). Son filas en la tabla
`Notificacion` que cada rol consulta con su propio token (RNF-05 — un cliente
solo ve las suyas), y además —si el dispositivo registró un token— se manda
un push real (Expo Push API) que llega aunque la app esté cerrada.

Se generan de dos formas:

- **Por evento**, desde `pagos.service.js`: registrar un pago (RF-25) o
  anularlo disparan la notificación correspondiente en el momento. Un
  cliente sin cuenta de acceso (acceso opcional) simplemente no recibe nada.
- **Por barrido diario**, vía `node-cron` (`src/jobs/notificaciones.job.js`),
  todos los días a las 08:00 hora del servidor. El barrido es idempotente: no
  duplica avisos si se corre más de una vez el mismo día.

### `POST /api/notificaciones/push-token`

Registra (o reasigna) el token de push de Expo del dispositivo actual —
la app móvil lo llama sola después de loguear o al restaurar sesión, no hace
falta wiring manual. `upsert` por `token`: si el mismo token ya era de otro
usuario (reinstaló la app con otra cuenta en el mismo celular), se reasigna.

```json
// request
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

`204` sin cuerpo. `400` si falta `token`.

Cuando `notificaciones.service.js` crea un aviso (`crear()`), manda el push a
todos los tokens del usuario. Es best-effort a propósito: si Expo no
responde, o el token quedó inválido (`DeviceNotRegistered`, el token se borra
solo), nunca revienta la operación de negocio que lo disparó — el aviso ya
quedó guardado en la tabla de todos modos y se puede ver dentro de la app.

Requiere que el proyecto de Expo tenga credenciales de Firebase Cloud
Messaging cargadas en EAS (`eas credentials`) y `google-services.json` en
`mobile/` — sin eso, `getExpoPushTokenAsync()` en el celular falla en
silencio y no hay token que registrar. Ver `mobile/README.md`.

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
`CUOTA_VENCE_HOY` (RF-26); `PAGO_CONFIRMADO` (RF-27, al registrar un pago);
`PAGO_ANULADO` (al anular uno); `RESUMEN_DIARIO_ADMIN` (RF-28).
`PAGO_REPORTADO` y `PAGO_RECHAZADO` son valores legado del enum, ya no se
producen (el cliente ya no autorreporta pagos).

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

## Sistema — `/api/sistema` (Administrador)

### `POST /api/sistema/purgar-datos`

La operación más destructiva del sistema: borra **permanentemente** todos los
`Cliente`, `Prestamo` (con sus `Cuota`, `Pago`, `Recibo` y `PagoSnapshot` en
cascada) y las cuentas de acceso de cliente (`Usuario` con `rol: CLIENTE`) **de
la cartera del administrador que la ejecuta** — multi-tenant: nunca toca los
clientes/préstamos de otro administrador. Irreversible, sin papelera. La
bitácora de auditoría (`RegistroAuditoria`) no se toca — incluso queda un
registro de esta misma acción — y el propio administrador que la ejecuta
sobrevive.

Exige dos confirmaciones en el body, no solo un click en la UI:

```json
// request
{ "confirmacion": "ELIMINAR TODO", "password": "la-contraseña-del-admin" }
```

`confirmacion` debe ser exactamente el string `"ELIMINAR TODO"` (sensible a
mayúsculas y espacios) — `400` (`CONFIRMACION_INVALIDA`) si no calza.
`password` debe ser la contraseña actual del administrador que hace la
petición — `401` (`PASSWORD_INVALIDA`) si no coincide. Ninguna de las dos
validaciones toca la base de datos.

```json
// response 200
{ "clientes": 12, "prestamos": 15, "pagos": 43, "cuentasCliente": 8 }
```

---

## Auditoría — `/api/auditoria` (Administrador)

Bitácora de cambios relevantes (RF-36, RNF-12): quién hizo qué, cuándo, sobre
qué registro. Se alimenta desde los propios servicios de negocio — no hay un
paso manual — cada vez que ocurre una de estas acciones:

- **Cliente**: alta (RF-01, con o sin cuenta de acceso), edición (RF-02, con
  el detalle de qué campos cambiaron), generación de acceso posterior y baja
  (RF-02).
- **Préstamo**: alta (RF-05), recálculo (RF-09) y refinanciamiento (RF-08, el
  registro queda sobre el préstamo nuevo y referencia el id del original).
- **Pago**: registro directo del administrador (RF-25, se guarda como
  `CONFIRMAR` porque se aplica de inmediato) y anulación de un pago
  (`ANULAR`).
- **Sistema**: borrado masivo de la cartera del administrador (`PURGAR`,
  entidad `SISTEMA`, `entidadId` = id del propio administrador) — ver arriba.

### `GET /api/auditoria`

Los últimos 200 registros del propio administrador, más nuevos primero
(multi-tenant: `usuarioId` siempre se fija al administrador autenticado, sin
importar lo que venga en la query string — cada admin ve solo su propia
bitácora, que coincide con las acciones sobre su propia cartera). Los demás
filtros son opcionales y combinables por query string:

| Parámetro   | Valores                              |
| ----------- | ------------------------------------- |
| `entidad`   | `CLIENTE`, `PRESTAMO`, `PAGO`, `SISTEMA` |
| `entidadId` | id de la entidad afectada             |
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
`REFINANCIAR`, `CONFIRMAR`, `ANULAR`, `PURGAR`. `RECHAZAR` es un valor legado
del enum, ya no se produce. `entidad` es uno de: `CLIENTE`, `PRESTAMO`,
`PAGO`, `SISTEMA`.

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
