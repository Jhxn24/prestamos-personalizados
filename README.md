
# Sistema Inteligente de Gestión de Préstamos

Plataforma multi-tenant para la gestión integral de préstamos: registro de clientes, generación de cronogramas dinámicos, control de pagos y mora, y dashboard con reportes. Cada administrador que se registra maneja su propia cartera de clientes, completamente aislada de la de otros administradores en la misma base de datos.

## Funcionalidades

- Registro y gestión de clientes y préstamos.
- Generación automática de cronogramas de pago dinámicos.
- Control de pagos y seguimiento de mora.
- Dashboard con reportes y auditoría.
- Notificaciones para clientes y administradores.
- Registro de administradores multi-tenant, sin límite de cuentas, con datos completamente aislados entre negocios.
- App móvil para clientes (login, cronograma, pagos, notificaciones) y administradores (gestión de clientes/préstamos, pagos, notificaciones).

## Stack técnico

- **Backend:** Node.js, Express, Prisma, PostgreSQL, JWT
- **Frontend web:** Next.js
- **App móvil:** React Native, Expo Router
- **Despliegue:** Railway

## Documentación adicional

- `backend/API.md` — detalle de endpoints REST.
- `mobile/README.md` — configuración e instalación de la app móvil.

## Requisitos previos

- Node.js 18 o superior (probado con v22; Next.js 16 requiere 20.9+)
- PostgreSQL corriendo localmente (o una URL de conexión a una instancia remota)

## Instalación (backend)

```bash
git clone https://github.com/Jhxn24/prestamos-personalizados.git
cd prestamos-personalizados/backend
npm install
```

### 1. Variables de entorno

Crea un archivo `backend/.env` con:

```env
# Cadena de conexión a tu PostgreSQL local
DATABASE_URL="postgresql://usuario:password@localhost:5432/prestamos"

# Secreto para firmar los JWT de autenticación
JWT_SECRET="cambia-esto-por-un-valor-largo-y-aleatorio"

# Puerto del servidor (opcional, por defecto 4000)
PORT=4000
```

### 2. Base de datos

Aplica las migraciones (crea las tablas):

```bash
npx prisma migrate dev
```

> El proyecto usa Prisma 6 a propósito. No ejecutes `npm install -g prisma`
> ni actualices a Prisma 7: rompe el flujo de `.env` + `migrate dev` que usa
> este proyecto. Usa siempre `npx prisma` desde `backend/`, que respeta la
> versión fijada en `package.json`.

Crea el usuario administrador inicial — dos formas equivalentes:

- **Seed script** (rápido para desarrollo local):
  ```bash
  node prisma/seed.js
  ```
  Por defecto crea `admin@prestamos.local` / `admin123`. Para cambiar esas
  credenciales, define `ADMIN_EMAIL` y `ADMIN_PASSWORD` antes de correr el seed.
- **Desde la propia app**: el login del frontend web y de la app móvil
  siempre tienen la opción "Crear cuenta de administrador", además del login
  normal — el registro de administradores es multi-tenant y está **siempre
  abierto** (sin límite de cuántos puedan existir). Cada administrador que se
  registra arranca con su propia cartera de clientes/préstamos vacía,
  completamente aislada de la de los demás administradores que usen la misma
  base de datos.

### 3. Levantar el servidor

```bash
npm run dev    # con recarga automática (nodemon)
# o
npm start      # sin recarga
```

El servidor queda escuchando en `http://localhost:4000` (o el `PORT` que
hayas definido).

### 4. Correr los tests

```bash
npm test
```

Corre la suite del motor de cálculo y del módulo de pagos (no requiere base
de datos: son pruebas unitarias puras).

## Instalación (frontend)

Requiere el backend corriendo (pasos anteriores) para poder iniciar sesión y
cargar datos.

```bash
cd frontend
npm install
```

Crea `frontend/.env.local` con la URL del backend:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Levanta el servidor de desarrollo:

```bash
npm run dev
```

Abre `http://localhost:3000`. Inicia sesión con el usuario administrador que
creaste con `node prisma/seed.js` (`admin@prestamos.local` / `admin123` por
defecto); un usuario con rol `CLIENTE` ve su propio dashboard en vez del de
administrador.

Otros comandos: `npm run build` (build de producción), `npm run lint`
(ESLint), `npx tsc --noEmit` (chequeo de tipos).

## Instalación (app móvil)

Requiere el backend corriendo y accesible desde tu teléfono/emulador (no
`localhost`). Ver [`mobile/README.md`](mobile/README.md) para el detalle
completo (variables de entorno, estructura, alcance).

```bash
cd mobile
npm install
npm run start
```

## Desplegar en producción

Para usar la app fuera de tu wifi de casa (o que otra persona tenga su propio
negocio, con sus propios clientes, totalmente separado del tuyo) hace falta
que el backend viva en internet, no solo en tu computadora.

### 1. Backend + base de datos

Cualquier hosting que corra Node.js y PostgreSQL sirve. **Railway**
(railway.app) es el más simple porque resuelve ambas cosas en un solo
proyecto:

1. Sube este repo a GitHub si todavía no lo está.
2. En Railway: *New Project → Deploy from GitHub repo*, elige este repo y
   fija el **root directory** del servicio en `backend`.
3. En el mismo proyecto: *New → Database → PostgreSQL*. Railway genera solo
   una variable `DATABASE_URL` que puedes referenciar desde el servicio del
   backend (o copiarla directo).
4. Variables de entorno del servicio backend:
   - `DATABASE_URL` — la que generó el paso anterior.
   - `JWT_SECRET` — un valor largo y aleatorio (no lo compartas).
   - `PORT` — no hace falta, Railway lo asigna solo y el backend ya lo respeta.
5. Comando de arranque: `npm start` (Railway detecta Node.js solo). Corre una
   vez `npx prisma migrate deploy` contra esa base de datos para crear las
   tablas (puede ser un "one-off command" en Railway, o corriéndolo desde tu
   compu apuntando `DATABASE_URL` a la de Railway un momento).
6. Verifica que quedó arriba entrando a `https://tu-servicio.up.railway.app/health`
   — debe responder `{"ok":true}`.

No hace falta correr el seed: al abrir el frontend o la app móvil apuntando a
esa URL por primera vez, el login te deja crear la cuenta de administrador
directamente (ver arriba).

### 2. App móvil como APK instalable

Con el backend ya desplegado, genera un APK real (sin Play Store, instalable
directo en el celular — ver `mobile/README.md` para el detalle completo del
proceso con EAS Build).

### 3. Que otra persona tenga su propio negocio

Hay dos formas de que varias personas usen el sistema sin mezclar sus datos,
según cuánto aislamiento necesiten:

- **Multi-tenant, un solo despliegue (recomendado)**: el sistema ya soporta
  varios administradores en la misma base de datos, cada uno con su propia
  cartera de clientes/préstamos/pagos, invisible para los demás (ver "Desde
  la propia app" arriba). No hay que desplegar nada nuevo: cada persona solo
  necesita la URL del mismo backend y crea su propia cuenta de administrador.
  Es la opción más simple cuando todos pueden compartir el mismo servidor.
- **Un despliegue por negocio**: cada quien repite los pasos de arriba con
  **su propio proyecto de Railway y su propia base de datos** (sea con su
  propia cuenta, o un segundo proyecto en la misma cuenta — lo importante es
  que la base de datos sea distinta). Son dos sistemas completamente
  independientes, sin ningún dato ni infraestructura compartida entre ambos
  — útil si además de aislar los datos se quiere aislar el hosting en sí
  (costos, disponibilidad, control total sobre esa instancia).

## Documentación de la API

Ver [`backend/API.md`](backend/API.md) para el shape de request/response de
cada endpoint (autenticación, clientes, préstamos, pagos y dashboard).
