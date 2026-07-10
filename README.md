# Taller System — Multiservicios San Miguel 96

CRM + PWA para taller mecánico (autos, motos y camiones). Una sola app con dos caras:

- **App de clientes (PWA, sin registro)** — `/`
  El cliente consulta el avance de su reparación **con su placa** (línea de tiempo de etapas). Con el **código de acceso** impreso en su orden desbloquea el detalle: anotaciones del taller con fotos, presupuesto (con opción de **aprobarlo o rechazarlo**), pagos/saldo, diagnóstico, historial de visitas y **notificaciones push**. La pantalla se actualiza sola por sondeo.

- **Back office CRM** — `/admin`
  Panel con usuarios y roles (administrador, asesor, mecánico): dashboard con KPIs, órdenes de trabajo con pipeline de 8 etapas, anotaciones públicas/internas **con fotos**, presupuestos con **inventario y catálogo de servicios** (costos y ganancia), **caja** (pagos, cortes por día y por cobrar), reportes con rentabilidad, recordatorios de servicio, enlaces de **WhatsApp** con mensaje prellenado, push interno para el equipo y gestión del equipo.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · Tailwind CSS 4 · Neon Postgres (`@neondatabase/serverless`, HTTP) · web-push (VAPID) · Vercel Blob (fotos) · Service Worker propio (push + offline básico).

## Puesta en marcha

```bash
pnpm install
# Sembrar esquema + admin (+ --demo para datos de prueba) contra tu Neon.
# Requiere DATABASE_URL y ADMIN_PASSWORD (mín. 8) en .env.local:
node --env-file=.env.local scripts/seed.mjs --demo
pnpm build
pnpm start            # producción en http://localhost:3000
```

En desarrollo: `pnpm dev` (con `DATABASE_URL` en `.env.local`; ver `.env.example`).

> La app también crea el esquema y aplica migraciones pendientes sola en la primera consulta (`ensureSchema` en `src/lib/db.ts`; migraciones versionadas en `src/lib/schema.ts` + tabla `schema_migrations`). El seed solo es imprescindible para el usuario admin y los datos demo.

**Credenciales iniciales:** usuario `admin` · contraseña = valor de `ADMIN_PASSWORD` al sembrar → cámbiala desde *Mi cuenta* (`/admin/cuenta`) al entrar.

Con datos demo: placa `ABC1234` (código `K7PM`) y placa `XYZ987` (código `W3RT`).

## Variables de entorno (`.env.local`)

```
DATABASE_URL                                                          # cadena de conexión de Neon Postgres
VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY  # npx web-push generate-vapid-keys
SESSION_SECRET                                                        # obligatorio en producción (openssl rand -base64 48)
ADMIN_PASSWORD                                                        # solo para el seed: contraseña inicial del admin
BLOB_READ_WRITE_TOKEN                                                 # Vercel Blob (fotos en anotaciones)
CRON_SECRET                                                           # protege /api/cron/reminders
```

Plantilla completa en `.env.example`.

## Despliegue en Vercel (runbook)

1. **Proyecto**: importar el repo en Vercel (detecta Next + pnpm por `pnpm-lock.yaml`).
2. **Neon**: usar **branches separados** para staging y producción. Jamás correr `--demo` contra producción.
3. **Env vars en Vercel** (Production y Preview por separado): las de la tabla de arriba. Generar secretos NUEVOS para producción:
   - `SESSION_SECRET`: `openssl rand -base64 48`
   - VAPID: `npx web-push generate-vapid-keys` (la pública va también en `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
4. **Blob**: crear un Blob store en Vercel (Storage → Blob) y vincularlo; expone `BLOB_READ_WRITE_TOKEN` solo. Sin token, las anotaciones se guardan sin fotos.
5. **Cron**: `vercel.json` ya define el cron diario de recordatorios (13:00 UTC = 7:00 Guatemala). Definir `CRON_SECRET` en env; Vercel lo envía como `Authorization: Bearer`.
6. **Seed de producción**: `DATABASE_URL=<prod> ADMIN_PASSWORD=<fuerte> node scripts/seed.mjs` (SIN `--demo`). Entrar y cambiar la contraseña en `/admin/cuenta`.
7. **Dominio del cliente**: añadirlo en Vercel. Después fijar en `next.config.ts`: `experimental.serverActions.allowedOrigins: ["dominio.com", "www.dominio.com"]`.
8. **Smoke test**: instalar ambas PWA (`/` y `/admin`), activar push de cliente (con código) y de staff (campana del panel), aprobar un presupuesto, registrar un pago, subir una foto en una anotación y verificar headers con `curl -I https://dominio.com`.

## Rebrand (cuando el cliente entregue logo/colores)

1. Editar `src/lib/brand.json` (nombre, colores `primary`/`accent` por tono, themeColor…).
2. Opcional: colocar el logo como `public/icons/logo.svg`.
3. Correr `node scripts/brand.mjs` — regenera tokens de `globals.css`, ambos manifests, iconos PWA y versión de caché del service worker.
4. Sustituir el icono `Wrench` por el logo real donde aplique (Home, AdminNav, Login, Tracking).

## Notas de operación

- **HTTPS es obligatorio** para push y PWA en producción (en `localhost` funciona sin HTTPS).
- Los datos viven en Neon Postgres; **respaldo = point-in-time restore / branches** desde la consola de Neon.
- Flujo diario: *Nueva orden* al recibir el vehículo → entregar al cliente su **placa + código de acceso** (aparecen en la orden) → ir cambiando etapas y anotando avances (con fotos); el cliente aprueba el presupuesto desde su teléfono y el equipo recibe push.
- Etapas: Recibido → Diagnóstico → Esperando aprobación → Esperando repuestos → En reparación → Control de calidad → Listo para entrega → Entregado (y Cancelado).
- Seguridad: rate limiting persistido en Postgres (login, tracking, subscribe, aprobación), códigos de acceso de 8 caracteres (CSPRNG, únicos), API pública sin código solo devuelve el estado, cookies HMAC con revocación por `token_version`, headers de seguridad en `next.config.ts`.
- Cambio de contraseña propia: `/admin/cuenta`. Reset de otros usuarios (solo admin): `/admin/usuarios`. Ambos cierran las sesiones del usuario afectado.
