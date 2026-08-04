# Sistema Inteligente de Gestión de Préstamos

Monorepo para una plataforma de gestión de préstamos (registro de clientes,
cronogramas dinámicos, pagos, mora y dashboard). Ver `backend/API.md` para el
detalle de los endpoints REST.

Estado actual: el **backend** (Node.js + Express + Prisma + PostgreSQL) está
implementado. El **frontend web** (Next.js) tiene su esqueleto inicial: login
y dashboard (admin/cliente); el resto de pantallas (clientes, préstamos,
pagos) todavía no existen. La app móvil (React Native/Expo) todavía no existe
en este repositorio.

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

Crea el usuario administrador inicial:

```bash
node prisma/seed.js
```

Por defecto crea `admin@prestamos.local` / `admin123`. Para cambiar esas
credenciales, define `ADMIN_EMAIL` y `ADMIN_PASSWORD` antes de correr el seed.

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

## Documentación de la API

Ver [`backend/API.md`](backend/API.md) para el shape de request/response de
cada endpoint (autenticación, clientes, préstamos, pagos y dashboard).
