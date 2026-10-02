# Canal Seguro — CRM de WhatsApp anti-bloqueo

CRM y bandeja compartida para pymes sobre la **API oficial de WhatsApp Cloud**, usando **Kapso** como Tech Provider.
Stack: Next.js 16 (App Router) + TypeScript + Supabase (Postgres, Auth, Realtime, RLS).

## Módulos

| Carpeta | Qué hace |
|---|---|
| `src/lib/kapso/` | Cliente REST de Kapso: customers, setup links, números, salud, webhooks, mensajes, plantillas |
| `src/lib/webhooks/` | Firma HMAC, ingesta idempotente y normalización de eventos de Kapso y de Meta (crudos) |
| `src/modules/health/` | Diagnóstico "es Meta / es tu número / somos nosotros" y cron de salud |
| `src/modules/templates/` | Calificador de plantillas: `TemplateAnalyzer` (DeepSeek) + `CategoryScorer` opcional (Jev) y calibración |
| `src/modules/meter/` | Medidor de consumo de Meta y alertas al 50/80/100 % del tope |
| `src/modules/campaigns/` | Puntaje de riesgo, envío por tandas y freno automático |
| `src/modules/inbox/` | Ventana de 24 h y respuestas rápidas |
| `supabase/migrations/` | Esquema multi-tenant con RLS, barreras de consentimiento y funciones de ingesta |

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en https://supabase.com (región São Paulo, la más cercana a Colombia).
2. Aplica las migraciones en orden. Con el CLI: `npx supabase link --project-ref TU_REF` y `npx supabase db push`.
   Sin el CLI: pega cada archivo de `supabase/migrations/` en el SQL Editor, en orden.
3. En **Authentication → URL configuration** agrega `https://TU-DOMINIO/auth/confirmar` a las Redirect URLs.
4. En **Database → Publications** verifica que `supabase_realtime` incluya `messages`, `conversations` y `notes`.

### 2. Kapso
1. Crea la cuenta en https://app.kapso.ai. El plan **Pro (25 USD)** ya trae setup links para clientes (3 números, cada uno extra a 10 USD).
2. Copia la API key del proyecto.
3. Inventa un secreto largo para los webhooks (`openssl rand -hex 32`) y guárdalo como `KAPSO_WEBHOOK_SECRET`.
4. **Webhook de proyecto** (Integrations → Webhooks → Platform webhooks): URL `https://TU-DOMINIO/api/webhooks/kapso-project`, evento `whatsapp.phone_number.created`. Copia su secreto en `KAPSO_PROJECT_WEBHOOK_SECRET`.
5. Los webhooks de cada número (eventos de Kapso + crudos de Meta) los registra la app sola cuando el cliente conecta su número.

### 3. Variables de entorno
```bash
cp .env.example .env.local   # y llena los valores
npm install
npm run verificar            # revisa Supabase, Kapso, DeepSeek y Jev sin mostrar secretos
```

### 4. Probar con un número de prueba (Instant setup de Kapso)
Kapso no entrega webhooks a `localhost`, así que necesitas una URL pública:
```bash
npm run build && npm start
npx cloudflared tunnel --url http://localhost:3000   # copia la URL https en APP_URL
```
1. Entra a `/ingresar`, crea tu empresa y copia su id (tabla `tenants`).
2. Vincula el número de Instant setup: `npm run vincular -- <phone_number_id> <tenant_id>`.
3. Escríbele a ese número desde tu celular y míralo llegar en `/panel/bandeja`.
4. Envío de prueba: `npm run verificar -- --enviar <phone_number_id> +573001234567`.

Para clientes reales, el flujo es **Panel → Número → Continuar con Facebook** (setup link en español, con `customer_managed`: el cliente paga a Meta con su tarjeta).

### 5. Crons
`vercel.json` programa la salud cada 10 min, las campañas cada 5 min y el consumo cada hora. Todos exigen
`Authorization: Bearer CRON_SECRET` (Vercel lo envía solo si defines `CRON_SECRET`). En el plan Hobby de Vercel los crons
solo pueden correr una vez al día: usa Pro o un cron externo.

### 6. Tarifas de Meta
El medidor cuenta los mensajes por categoría con el campo `pricing` que envía Meta. Para mostrar dólares, carga las tarifas
vigentes en la tabla `meta_rates` (país, categoría, USD por mensaje) desde la tabla oficial de Meta. Sin tarifa, el panel
avisa que el total es parcial.

## Pruebas
```bash
npm test          # pruebas unitarias (Vitest)
npm run test:db   # migraciones + RLS + barreras en Postgres (Docker)
npm run test:e2e  # app de producción + mini Supabase + Kapso falso: webhooks, salud y campañas (requiere npm run build y Docker)
npm run build
```

## Reglas que el código hace cumplir
- **Nunca se disfraza marketing de utilidad**: si el calificador detecta algo promocional no ofrece reescritura, y el servidor rechaza enviarla como utilidad.
- **Sin opt-in no hay marketing**: un trigger en la base impide agregar a una campaña de marketing a alguien sin permiso vigente o dado de baja, y el envío vuelve a verificarlo.
- **Aislamiento por cliente**: RLS en todas las tablas y triggers que impiden enlazar filas de otro cliente.
- **Webhooks**: firma HMAC-SHA256 del cuerpo crudo, idempotencia por `X-Idempotency-Key` y respuesta inmediata con procesamiento posterior (`after`).
