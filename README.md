# Taller System — Multiservicios San Miguel 96

CRM + PWA para taller mecánico (autos, motos y camiones). Una sola app con dos caras:

- **App de clientes (PWA, sin registro)** — `/`
  El cliente consulta el avance de su reparación **con su placa**. Ve la línea de tiempo de etapas, las anotaciones del taller **en vivo** (SSE + sondeo de respaldo), puede activar **notificaciones push**, guardar sus vehículos en el teléfono e instalar la app. Con el **código de acceso** impreso en su orden desbloquea el detalle: presupuesto, diagnóstico e historial de visitas.

- **Back office CRM** — `/admin`
  Panel con usuarios y roles (administrador, asesor, mecánico): dashboard con KPIs, órdenes de trabajo con pipeline de 8 etapas, anotaciones públicas/internas, presupuestos (servicios y repuestos), clientes, vehículos y gestión del equipo. Cada cambio de etapa o anotación pública **notifica al cliente por push** y actualiza su pantalla al instante.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · Tailwind CSS 4 · SQLite (better-sqlite3) · web-push (VAPID) · Service Worker propio (push + offline básico).

## Puesta en marcha

```bash
npm install
npm run seed          # crea el usuario admin (agrega --demo para datos de prueba)
npm run build
npm start             # producción en http://localhost:3000
```

En desarrollo: `npm run dev`.

**Credenciales iniciales:** usuario `admin` · contraseña `sanmiguel96` → cámbiala desde *Equipo* al entrar.

Con datos demo: placa `ABC1234` (código `K7PM`) y placa `XYZ987` (código `W3RT`).

## Variables de entorno (`.env.local`)

Se generaron automáticamente. Si despliegas en otro servidor genera nuevas:

```
VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY  # npx web-push generate-vapid-keys
SESSION_SECRET                                                        # cadena aleatoria larga
```

## Notas de operación

- **HTTPS es obligatorio** para push y PWA en producción (en `localhost` funciona sin HTTPS). Cualquier dominio con certificado (Cloudflare, Caddy, etc.) sirve.
- La base vive en `data/taller.db` (respáldala copiando ese archivo).
- El flujo diario: *Nueva orden* al recibir el vehículo → entregar al cliente su **placa + código de acceso** (aparecen en la orden) → ir cambiando etapas y anotando avances; el cliente lo ve todo en su teléfono.
- Etapas: Recibido → Diagnóstico → Esperando aprobación → Esperando repuestos → En reparación → Control de calidad → Listo para entrega → Entregado (y Cancelado).
