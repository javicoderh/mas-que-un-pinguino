# Es más que un pingüino

Seed de campaña en Astro para una primera fase de conversión enfocada en tres acciones: leer la carta abierta, firmar y seguir la campaña en redes.

## Propósito

Este proyecto está pensado como una base rápida, seria y escalable para una campaña ciudadana chilena por la protección del pingüino de Humboldt y la restitución del decreto de Monumento Natural. La primera fase es estática, accesible y liviana, pero deja puntos claros para crecer hacia noticias, materiales educativos y participación territorial.

## Stack

- Astro 5+
- TypeScript
- Tailwind CSS 4
- HTML semántico
- JavaScript mínimo solo para interacciones puntuales
- API server-side + Firebase Firestore para guardar firmas

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

## Build de producción

```bash
npm run build
```

## Estructura principal

```text
public/
  assets/
    logo-pinguino.png
  favicon.svg
  robots.txt
src/
  components/
    layout/
    sections/
    ui/
  content/
    campaign.ts
  layouts/
    MainLayout.astro
  pages/
    index.astro
    carta.astro
    firma.astro
    transparencia.astro
  styles/
    global.css
astro.config.ts
package.json
tsconfig.json
```

## Dónde editar enlaces y copy

Todo el contenido editable y los placeholders importantes están centralizados en:

`src/content/campaign.ts`

Ahí puedes cambiar:

- títulos y descripciones SEO
- enlaces externos (`LETTER_PDF_URL`, `FORM_URL`, redes, Linktree)
- fecha objetivo del countdown
- copy del hero
- cards del problema
- bloques del ecosistema
- hashtags
- principios de transparencia
- rutas futuras sugeridas

## Dónde reemplazar assets

- Logo principal: `public/assets/logo-pinguino.png`
- Imagen Open Graph placeholder: `public/assets/og-cover.svg`
- Favicon placeholder: `public/favicon.svg`

Puedes reemplazar `og-cover.svg` por un JPG/PNG final más adelante y actualizar la ruta en `src/content/campaign.ts`.

## Rutas incluidas

- `/` landing principal
- `/carta` acceso a la carta abierta en PDF
- `/firma` formulario de firma con validación server-side y anti-abuse
- `/transparencia` principios, base pública y extensibilidad futura

## Componentes base del sistema

- `MainLayout`: metadata, estructura general, header, footer, CTA flotante
- `Section`: contenedor reutilizable de secciones
- `SectionHeading`: títulos consistentes
- `ButtonLink`: botones CTA con variantes
- `DataCard`: tarjetas de datos
- `Countdown`: countdown aislado con JS mínimo
- `SocialLinksRow`: fila reusable de redes
- `FloatingCTA`: CTA móvil persistente al hacer scroll
- `SignatureForm`: formulario de firmas con validación y envío a Firestore
- `FooterBlock`: pie con transparencia y accesos clave

## Configurar Firestore server-side

1. Crea un proyecto en Firebase y habilita Firestore.
2. Copia `.env.example` a `.env`.
3. Completa estas variables server-side y públicas:

```bash
SECURITY_HASH_SECRET=
SECURITY_ALLOWED_ORIGINS=https://esmasqueunpinguino.cl,http://localhost:4321
SECURITY_HIGH_PROTECTION_MODE=false
SECURITY_CAPTCHA_ENABLED=false
SECURITY_CAPTCHA_PROVIDER=turnstile
TURNSTILE_SECRET_KEY=
PUBLIC_TURNSTILE_SITE_KEY=
SECURITY_MIN_SUBMIT_TIME_MS=2500
SECURITY_ATTACK_MIN_SUBMIT_TIME_MS=4500
SECURITY_MAX_PAYLOAD_BYTES=16384
SECURITY_FORM_GET_BURST_LIMIT=45
SECURITY_FORM_GET_WINDOW_LIMIT=180
SECURITY_SIGNATURE_POST_IP_BURST_LIMIT=5
SECURITY_SIGNATURE_POST_IP_WINDOW_LIMIT=12
SECURITY_SIGNATURE_POST_FP_BURST_LIMIT=3
SECURITY_SIGNATURE_POST_FP_WINDOW_LIMIT=4
FIREBASE_SERVICE_ACCOUNT_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL=
FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY=
FIREBASE_SIGNATURES_COLLECTION=campaign_signatures
FIREBASE_SIGNATURES_DEDUPE_EMAIL_COLLECTION=signature_dedupe_email
FIREBASE_SIGNATURES_DEDUPE_IDENTITY_COLLECTION=signature_dedupe_identity
FIREBASE_SIGNATURES_DEDUPE_RUT_COLLECTION=signature_dedupe_rut
FIREBASE_RATE_LIMIT_ROOT_COLLECTION=security_rate_limits
FIREBASE_SECURITY_EVENTS_COLLECTION=security_events
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_FIREBASE_SIGNATURES_COLLECTION=campaign_signatures
PUBLIC_FIREBASE_COUNTER_COLLECTION=public_stats
PUBLIC_FIREBASE_COUNTER_DOC=signatures_counter
```

4. Publica reglas de Firestore basadas en [firestore.rules](/home/javier/Documents/salvemos-humboldt/firestore.rules).

La integración segura ya no escribe firmas desde el navegador. El endpoint server-side firma el token del formulario, valida y deduplica, aplica rate limits persistentes y recién después escribe en Firestore con credenciales server-side.

El contador público de firmas usa un documento separado:

- colección: `public_stats`
- documento: `signatures_counter`

Ese documento se crea automáticamente con la primera firma válida.

## Extensión futura sugerida

### Fase 2

Crear `/noticias` o `/material-educativo` usando la misma capa de layout y centralizando nuevos textos o colecciones en `src/content/`.

### Fase 3

Agregar la sección restante con una navegación principal más amplia y componentes reutilizados.

### Fase 4

Crear `/participa` para actividades ciudadanas con:

- formulario externo o serverless
- mapa de acciones
- calendario público
- moderación ligera

## Protección anti-abuse en firmas

- Rate limiting persistente:
  `src/middleware.ts` limita GET de `/firma` por IP y `src/pages/api/signatures/index.ts` limita POST por IP y por huella liviana hash.
- Fricción casi invisible:
  honeypot, token firmado con `issued_at`, umbral mínimo de tiempo y validación de origin/referer.
- Dedupe real en almacenamiento:
  hashes por email, RUT e identidad normalizada (`nombre + región`) evitan duplicados incluso bajo carrera.
- Validación server-side:
  `src/lib/validation/signature-schema.ts` usa Zod para sanitizar y rechazar payloads vacíos, basura obvia o datos fuera de rango.
- Riesgo y revisión:
  `src/lib/security/risk-score.ts` decide `allow`, `flag` o `block` con reglas simples y editables.
- Observabilidad:
  `src/lib/security/logging.ts` emite logs estructurados y hooks de métricas con identificadores hasheados.

## Cómo ajustar umbrales

- Límites y toggles: [src/lib/security/config.ts](/home/javier/Documents/salvemos-humboldt/src/lib/security/config.ts)
- Validación de payload: [src/lib/validation/signature-schema.ts](/home/javier/Documents/salvemos-humboldt/src/lib/validation/signature-schema.ts)
- Reglas de riesgo: [src/lib/security/risk-score.ts](/home/javier/Documents/salvemos-humboldt/src/lib/security/risk-score.ts)

## Modo normal vs modo de ataque

- Normal:
  `SECURITY_HIGH_PROTECTION_MODE=false`
- Ataque:
  `SECURITY_HIGH_PROTECTION_MODE=true`

En modo de ataque el proyecto endurece los límites, sube el tiempo mínimo de envío y puede exigir CAPTCHA si está configurado.

## Tradeoffs y tuning

- Umbrales muy bajos aumentan falsos positivos en redes compartidas o equipos de prensa.
- El estado `flagged` permite revisar casos sospechosos sin tratar a todas las personas como bots.
- El rate limiting usa Firestore compartido y funciona en serverless, pero conviene complementar con CDN/WAF para absorber floods más grandes.

## Cómo probar spam y duplicados

1. Envía una firma válida y verifica respuesta `200` y mensaje de éxito.
2. Repite la misma firma con mismo email o RUT y verifica mensaje de duplicado.
3. Rellena el honeypot manualmente desde DevTools y verifica rechazo genérico.
4. Reenvía demasiado rápido con el mismo token y verifica bloqueo o revisión.
5. Simula ráfagas de POST desde la misma IP y verifica `429` con `Retry-After`.

## Qué sigue dependiendo de infraestructura

- Un CDN/WAF delante del sitio sigue siendo recomendable para floods más grandes.
- Firestore TTL para limpiar `security_rate_limits/*/events/*` debe habilitarse desde infraestructura si se quiere limpieza automática.
- Si se despliega en Astro SSR, hay que usar un adapter compatible con la plataforma serverless elegida.

## Puntos de extensión técnica

- contador real de firmas
- analytics
- newsletter o voluntariado
- sitemap con integración Astro
- formularios o APIs serverless
- módulo de mapa/calendario para participación territorial
- captcha visible solo bajo ataque
- confirmación por correo para firmas `flagged`
- dashboard operativo para revisión y métricas

## Nota de implementación

La base evita CMS, auth y backend tradicional en esta etapa. La prioridad es velocidad, claridad editorial, buen SEO, accesibilidad y facilidad de handoff.
