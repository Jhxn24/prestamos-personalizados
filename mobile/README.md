# App móvil — Sistema de Préstamos

App Expo (React Native + Expo Router) para clientes y administradores del
Sistema Inteligente de Gestión de Préstamos. Consume el mismo backend REST
que el frontend web — ver [`../backend/API.md`](../backend/API.md).

Alcance actual:

- **Cliente**: login, dashboard (capital/interés pendiente, próximo pago,
  estado, cronograma e historial — RF-30), reportar un pago (RF-21) y ver
  notificaciones (RF-26/27/28).
- **Administrador**: resumen del negocio (RF-29); gestión de clientes (alta,
  edición, baja — RF-01/02) y de préstamos (alta con simulación previa,
  cronograma, recalcular, refinanciar — RF-05 a RF-09); registrar/confirmar/
  rechazar pagos (RF-23/25); ver clientes morosos; y sus propias notificaciones
  (RF-26/27/28).

No incluye (queda para una siguiente pasada): reportes exportables (RF-31/32),
adjuntar documentos (RF-03/33), auditoría (RF-36 — sí existe en backend/web),
firma digital ni escaneo de DNI (RF-34/35), ni modo sin conexión (RF-37).

## Requisitos previos

- Node.js 20.9+ (Expo SDK 57)
- El backend corriendo (ver `../backend/README` / raíz del repo) y accesible
  desde tu teléfono/emulador en la misma red.
- La app Expo Go instalada en tu teléfono, o un emulador Android/simulador iOS.

## Instalación

```bash
cd mobile
npm install
```

Crea `mobile/.env` con la URL del backend:

```env
EXPO_PUBLIC_API_URL=http://TU_IP_LOCAL:4000
```

> **No uses `http://localhost:4000`** salvo que abras la app en el navegador
> (`npm run web`): en un teléfono físico o Expo Go, "localhost" apunta al
> propio dispositivo, no a tu computadora. Usa la IP de tu red local (ej.
> `192.168.1.5`). En el emulador de Android, `http://10.0.2.2:4000` apunta a
> tu computadora.

## Levantar la app

```bash
npm run start   # abre el menú de Expo (QR para Expo Go, o elige plataforma)
npm run android
npm run ios      # requiere macOS
npm run web
```

Inicia sesión con el mismo usuario administrador o cliente que usas en el
frontend web (ver seed del backend).

## Generar un APK instalable (EAS Build)

Para tener la app como una app normal en el celular (con su ícono, sin
depender de `npx expo start` corriendo en tu compu), hace falta que el
backend esté desplegado en internet (ver la sección "Desplegar en
producción" del README raíz) y compilar un APK con EAS Build — corre en la
nube de Expo, no requiere Android Studio instalado.

1. Cuenta gratis en [expo.dev](https://expo.dev) y `npx eas login`.
2. Edita `mobile/eas.json` y agrega la URL de tu backend ya desplegado al
   perfil `preview`:
   ```json
   "preview": {
     "distribution": "internal",
     "android": { "buildType": "apk" },
     "env": { "EXPO_PUBLIC_API_URL": "https://tu-backend.up.railway.app" }
   }
   ```
3. `npx eas build --platform android --profile preview`
4. Al terminar (unos minutos), EAS te da un link de descarga del `.apk`.
   Descárgalo en el celular e instálalo directo (Android puede pedir
   permitir "orígenes desconocidos" la primera vez).

Cada persona con su propio backend desplegado (ver "Que otra persona tenga
su propio negocio" en el README raíz) necesita su propio build con su propia
`EXPO_PUBLIC_API_URL` — o, más simple y sin compilar nada, puede usar Expo Go
apuntando a su propia URL.

## Estructura

```
src/
  app/
    _layout.tsx      # rutas protegidas por sesión y rol (Stack.Protected)
    login.tsx
    (cliente)/        # tabs: Mi préstamo, Pagos, Avisos
    (admin)/           # tabs: Resumen, Clientes, Préstamos, Pagos, Avisos
      clientes/         # stack anidado: lista, nuevo, [id]
      prestamos/         # stack anidado: lista, nuevo, [id], morosos
  lib/                # cliente API (fetch + Bearer token) y tipos, en
                       # paralelo a frontend/src/lib — mismo contrato de API
  components/
    ui/                # Button, Card, Badge, TextField, Screen, ChipSelect
    pagos/              # modales compartidos (registrar/rechazar pago)
    clientes/           # selector de cliente (modal con búsqueda)
    prestamos/           # campos de condiciones del préstamo (compartido
                          # entre alta, recalcular y refinanciar)
    notificaciones-screen.tsx   # pantalla compartida entre cliente y admin
    themed-text.tsx, themed-view.tsx, use-theme.ts   # del scaffold de Expo
```
