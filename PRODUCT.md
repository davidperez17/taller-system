# PRODUCT.md — Taller System (SM96)

## Register

**product** — CRM + PWA operativa. El diseño sirve a la tarea, no es el producto. Familiaridad ganada > sorpresa.

## Usuarios y propósito

- **Staff del taller** (admin, asesores, mecánicos): panel `/admin` en teléfonos Android de gama media y una PC de mostrador. Manos ocupadas, luz de taller, prisa. Tareas: crear órdenes, avanzar etapas, cotizar, cobrar, anotar con fotos.
- **Dueños de vehículos** (Guatemala, mayoría móvil): consultan `/` con su placa, sin registro. Quieren certeza: ¿cómo va mi carro, cuánto cuesta, cuándo lo recojo? Aprueban presupuesto y pagan en el taller.

Resultado deseado: el cliente confía sin llamar por teléfono; el staff opera sin fricción.

## Personalidad de marca

**Sobrio, confiable, profesional** ("Trust & Authority"): neutros que cargan la interfaz, color de acción único y contenido, cero decoración gratuita. Español de Guatemala, moneda Q.

## Colores de marca

**Vigente: paleta original "Trust & Authority"** — azul `#2563eb` (primary, acciones/nav), verde esmeralda (accent: éxito/dinero/aprobar/WhatsApp), grises slate. Estrategia de color: **Restrained**.

El cliente propuso negro/gris/rojo (onyx #0B090A, caoba #BA181B, humo #F5F3F4); se implementó dos veces (caoba como primary total; luego industrial-premium con rojo racing #C8102E al 8%) y **ambas fueron rechazadas por el usuario** → se revirtió al azul original. La paleta definitiva queda pendiente de redefinirse con el cliente.

## Anti-referencias (feedback real del usuario, 2026-07-09 — vigentes para cualquier paleta futura)

- Rojo cargando toda la interfaz (chips, iconos, fondos) → se sintió agresivo/alarmante.
- Fondos con tinte rosa (rojo diluido en tonos claros) → los claros deben ser gris neutro.
- Negro puro (#0B090A) en superficies grandes → crudo; usar grafito con cuerpo.
- Rojo caoba apagado (#BA181B) → preferir rojo más vivo.

## Principios de diseño

1. ~90% neutro / ~8% color de acción / ~2% verde semántico. El color de acción se gana su lugar señalando acción o estado activo.
2. Mobile-first siempre; el mecánico usa el pulgar.
3. Todo estado interactivo definido (hover, focus, active, disabled) con la misma vocabulario en todas las pantallas.
4. Accesibilidad: contraste AA mínimo en texto normal (≥4.5:1), botones con texto blanco solo sobre rojo/grafito verificados.
5. Los tokens viven en `src/lib/brand.json` → `scripts/brand.mjs` regenera todo derivado. Nunca hardcodear color de marca en componentes.
