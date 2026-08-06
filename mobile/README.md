# App móvil — Sistema de Préstamos

App Expo (React Native + Expo Router) para clientes y administradores del
Sistema Inteligente de Gestión de Préstamos. Consume el mismo backend REST
que el frontend web — ver [`../backend/API.md`](../backend/API.md).

Alcance actual:

- **Cliente**: login (opcional — RF-04), dashboard (capital/interés
  pendiente, próximo pago, estado, cronograma e historial — RF-30) y avisos,
  como notificación push del sistema operativo (RF-26/27/28/39).
- **Administrador**: resumen del negocio (RF-29); gestión de clientes (alta
  con o sin cuenta de acceso, edición, baja, generar acceso después —
  RF-01/02/04) y de préstamos (alta con simulación previa, cronograma,
  recalcular, refinanciar — RF-05 a RF-09); marcar/anular pagos (RF-25); ver
  clientes morosos; borrado masivo de datos (RF-38); y sus propias
  notificaciones push (RF-26/27/28/39).

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

## Notificaciones push (RF-39)

Los avisos (RF-26/27/28) llegan como notificación push real —con la app
cerrada— además de aparecer en la pestaña Avisos. La app pide permiso y
registra el token solo (ver `src/lib/push-notifications.ts`); no hay nada
que tocar en el código para que esto funcione, **pero en Android hace falta
un proyecto de Firebase vinculado** antes de que un push llegue de verdad.
Sin esto, el registro del token falla en silencio (no rompe nada, solo no
hay push) — se puede hacer en cualquier momento, no bloquea el resto de la app.

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
   (el plan gratis alcanza).
2. Agrega una app Android con el package name exacto de `app.json`
   (`android.package`, hoy `com.sistemaprestamos.app`).
3. Descarga el `google-services.json` que te da Firebase y ponlo en
   `mobile/google-services.json`.
4. Agrega la referencia en `app.json`, dentro de `expo.android`:
   ```json
   "googleServicesFile": "./google-services.json"
   ```
5. En Firebase: ⚙️ *Configuración del proyecto* → pestaña *Cuentas de
   servicio* → *Generar nueva clave privada* (JSON) — esto es lo que EAS
   necesita para mandar el push en tu nombre, es un archivo distinto al
   `google-services.json`.
6. Súbelo a EAS:
   ```bash
   npx eas credentials
   # Android → seleccionar el perfil → Push Notifications → Upload a new key
   ```
7. Vuelve a compilar el APK (`npx eas build --platform android --profile preview`)
   — el `google-services.json` se empaqueta en el build, así que un APK
   compilado antes de este paso no tendrá push funcionando.

## Estructura

```
src/
  app/
    _layout.tsx      # rutas protegidas por sesión y rol (Stack.Protected)
    login.tsx
    (cliente)/        # tabs: Mi préstamo, Avisos
    (admin)/           # tabs: Resumen, Clientes, Préstamos, Pagos, Avisos
      clientes/         # stack anidado: lista, nuevo, [id]
      prestamos/         # stack anidado: lista, nuevo, [id], morosos
  lib/                # cliente API (fetch + Bearer token), tipos y push
                       # notifications, en paralelo a frontend/src/lib —
                       # mismo contrato de API
  components/
    ui/                # Button, Card, Badge, TextField, Screen, ChipSelect
    pagos/              # modales compartidos (registrar/anular pago)
    clientes/           # selector de cliente, generar acceso (modal)
    prestamos/           # campos de condiciones del préstamo (compartido
                          # entre alta, recalcular y refinanciar)
    notificaciones-screen.tsx   # pantalla compartida entre cliente y admin
    themed-text.tsx, themed-view.tsx, use-theme.ts   # del scaffold de Expo
```
