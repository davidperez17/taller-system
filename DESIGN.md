# DESIGN.md — Taller System (SM96)

## Tema visual

"Trust & Authority" claro. Superficies blancas sobre fondo slate claro; azul como color de acción y de identidad (nav oscura azul marino); verde esmeralda semántico (éxito/dinero). Sin gradientes, sin glass, sin decoración.

## Paleta (tokens Tailwind 4 en `src/app/globals.css`, fuente: `src/lib/brand.json`)

| Token | Valor | Uso |
|---|---|---|
| `primary-50..950` | escala blue de Tailwind 4 (600 = #2563eb) | Botones, enlaces, nav activa, focus, nav oscura (900/950) |
| `accent-50..950` | escala emerald de Tailwind 4 | Éxito, pagado, aprobar, WhatsApp |
| `slate-*` | slate estándar de Tailwind | Grises de UI |

Fondos: body `bg-slate-50`; manifests theme_color `#1e3a8a` (cliente) / `#172554` (admin).

## Tipografía

- **Barlow Condensed** 500/600/700 — headings, KPIs, wordmark, placas (`--font-heading`).
- **Inter** — cuerpo, formularios, tablas (`--font-body`).
- Escala fija rem, ratio corto; placas con `letter-spacing: 0.12em` (`.plate-badge`).

## Componentes (vocabulario en `src/components/admin/ui.tsx`)

- `btnPrimary`: azul 600, hover 500, texto blanco, rounded-xl.
- `btnSecondary`: blanco, borde gris, texto gris carbón.
- `card`: blanco, borde `slate-200` (neutro), rounded-2xl, sombra sm.
- Badges de estado: tonos semánticos de `status.ts` (blue→primary, green→accent, amber, red, violet).
- Inputs: borde gris, focus ring primary.

## Layout

- Cliente: una columna, max-w-2xl, mobile-first.
- Admin: sidebar azul marino en desktop / bottom-nav 4+Más en móvil; contenido sobre gris claro.

## Motion

Transiciones 150–250 ms (`transition-colors`), `animate-slide-up` en entrada de tarjetas públicas, `live-dot` pulso en indicadores. `prefers-reduced-motion` respetado globalmente (globals.css).

## Reglas

- Color de marca nuevo = editar `brand.json` + `node scripts/brand.mjs`. Nunca clases `blue-*`/`emerald-*`/hex sueltos.
- Rojo Tailwind `red-*` reservado para error/peligro.
- Iconos: lucide-react, w-4/w-5, `aria-hidden`.
