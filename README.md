# Es más que un pingüino

Sitio de campaña construido con Astro para movilización ciudadana en torno a la protección del pingüino de Humboldt. El proyecto resuelve tres frentes al mismo tiempo:

- comunicación pública clara
- captación y conteo de firmas
- operación segura en un entorno serverless

Hoy el sitio corre con SSR sobre Vercel, persiste firmas en Neon Postgres cuando `DATABASE_URL` está configurada y mantiene la capa Firestore disponible como fallback y compatibilidad operativa. La interfaz sigue enfocada en conversión: leer la carta, firmar y compartir.

## Qué resuelve este proyecto

- landing pública de campaña
- lectura y descarga de carta abierta en PDF
- formulario de firmas con validación cliente y server-side
- deduplicación por RUT, email e identidad normalizada
- mitigación básica de abuso y spam
- contador público de firmas aceptadas
- importación histórica de respuestas desde Google Forms

## Stack

- Astro 5
- TypeScript
- Tailwind CSS 4
- Vue 3
- Neon Postgres
- Firebase Firestore
- Vercel Serverless

## Dominio canónico

El dominio canónico actual es:

- `https://esmasqueunpinguino.cl`

El backend acepta también estos origins para no romper redirecciones ni dominios alternativos:

- `https://esmasqueunpinguino.cl`
- `https://www.esmasqueunpinguino.cl`
- `https://masqueunpinguino.cl`
- `https://www.masqueunpinguino.cl`

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run check
```

## Instalación

```bash
npm install
cp .env.example .env
```

## Desarrollo local

```bash
npm run dev
```

Servidor local esperado:

- `http://localhost:4321`

## Build de producción

```bash
npm run build
```

Nota:

- localmente puedes estar en Node 23
- Vercel ejecuta este proyecto con Node 22

Conviene alinear tu entorno local a Node 22 cuando estés depurando diferencias de runtime.

## Estructura del proyecto

```text
src/
  assets/
  components/
    campaign/
    layout/
    sections/
    ui/
  content/
    campaign.ts
  layouts/
    MainLayout.astro
  lib/
    firebase.ts
    signatures.ts
    security/
    validation/
  pages/
    api/
      signatures/
    carta.astro
    contacto.astro
    firma.astro
    index.astro
    transparencia.astro
  styles/
scripts/
generated/
public/
  assets/
astro.config.ts
firestore.rules
```

## Dónde editar qué

### Copy, enlaces y configuración editorial

Archivo principal:

- [campaign.ts](/home/javier/Documents/salvemos-humboldt/src/content/campaign.ts)

Aquí se centraliza:

- SEO y metadata base
- labels del formulario
- textos de secciones
- links sociales
- fechas de campaña
- CTAs
- assets referenciados por la app

### Layout y metadata global

- [MainLayout.astro](/home/javier/Documents/salvemos-humboldt/src/layouts/MainLayout.astro)

### Hero y galería

- [HeroSection.astro](/home/javier/Documents/salvemos-humboldt/src/components/sections/HeroSection.astro)
- [PenguinSmartGallery.vue](/home/javier/Documents/salvemos-humboldt/src/components/campaign/PenguinSmartGallery.vue)

### Formulario de firmas

- [SignatureForm.astro](/home/javier/Documents/salvemos-humboldt/src/components/ui/SignatureForm.astro)

### API de firmas

- [index.ts](/home/javier/Documents/salvemos-humboldt/src/pages/api/signatures/index.ts)
- [count.ts](/home/javier/Documents/salvemos-humboldt/src/pages/api/signatures/count.ts)

### Validación

- [signature-schema.ts](/home/javier/Documents/salvemos-humboldt/src/lib/validation/signature-schema.ts)

### Persistencia y dedupe

- [storage.ts](/home/javier/Documents/salvemos-humboldt/src/lib/security/storage.ts)
- [dedupe.ts](/home/javier/Documents/salvemos-humboldt/src/lib/security/dedupe.ts)
- [firestore-rest.ts](/home/javier/Documents/salvemos-humboldt/src/lib/security/firestore-rest.ts)
- [postgres.ts](/home/javier/Documents/salvemos-humboldt/src/lib/db/postgres.ts)

## Flujo de firmas

### Formulario actual

El formulario pide:

- nombre
- apellido
- RUT
- correo electrónico
- edad
- país
- persona natural o jurídica
- región
- comuna
- organización o vínculo con el territorio
- mensaje opcional
- consentimiento
- actualizaciones opcionales

### Flujo técnico

1. El usuario abre `/firma`.
2. Astro emite un token firmado de formulario.
3. El frontend valida formato básico.
4. El `POST /api/signatures` valida de nuevo en server-side.
5. Se evalúa dedupe por hashes.
6. Se aplica scoring de riesgo.
7. Si pasa, se escribe en Neon Postgres si `DATABASE_URL` existe; si no, usa Firestore.
8. El contador público se alimenta desde firmas `accepted`.

## Modelo de datos de firmas

Cada firma almacenada en Firestore contiene, como mínimo:

- `firstName`
- `lastName`
- `fullName`
- `rut`
- `email`
- `age`
- `country`
- `legalNature`
- `region`
- `commune`
- `affiliation`
- `message`
- `consent`
- `updates`
- `status`
- `riskDecision`
- `riskReasons`
- `riskScore`
- `dedupe.*`
- `source.*`
- `security.*`
- `createdAtMs`
- `updatedAtMs`
- `sourceName`

Estados relevantes:

- `accepted`
- `flagged`
- `rejected`
- `pending`

## Seguridad

La seguridad está pensada para un sitio público con fricción baja y protección razonable.

### Lo que ya hace

- validación server-side con Zod
- token firmado por formulario
- rate limiting por IP y huella liviana
- dedupe por:
  - email
  - RUT
  - identidad normalizada
- scoring de riesgo
- verificación de origin permitidos
- soporte opcional para CAPTCHA

### Archivos clave

- [config.ts](/home/javier/Documents/salvemos-humboldt/src/lib/security/config.ts)
- [risk-score.ts](/home/javier/Documents/salvemos-humboldt/src/lib/security/risk-score.ts)
- [messages.ts](/home/javier/Documents/salvemos-humboldt/src/lib/security/messages.ts)
- [middleware.ts](/home/javier/Documents/salvemos-humboldt/src/middleware.ts)

## Firestore

### Colecciones usadas

- `campaign_signatures`
- `signature_dedupe_email`
- `signature_dedupe_identity`
- `signature_dedupe_rut`
- `security_rate_limits`
- `security_events`
- `public_stats`

### Contador público

El contador de la UI se basa en firmas con:

- `status = "accepted"`

Hoy el código ya no depende del documento manual `public_stats/signatures_counter` como fuente principal de verdad para mostrar el conteo público. Aun así, ese documento puede existir y se usa en operaciones o reseteos auxiliares.

## Variables de entorno

Variables mínimas para firmar de verdad con Neon:

```bash
SECURITY_HASH_SECRET=
SECURITY_ALLOWED_ORIGINS=https://esmasqueunpinguino.cl,https://www.esmasqueunpinguino.cl,https://masqueunpinguino.cl,https://www.masqueunpinguino.cl,http://localhost:4321

DATABASE_URL=
DATABASE_URL_UNPOOLED=
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=
POSTGRES_PRISMA_URL=
```

Variables para dejar Firestore disponible como fallback o uso operativo paralelo:

```bash

FIREBASE_SERVICE_ACCOUNT_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL=
FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY=

FIREBASE_SIGNATURES_COLLECTION=campaign_signatures
FIREBASE_SIGNATURES_DEDUPE_EMAIL_COLLECTION=signature_dedupe_email
FIREBASE_SIGNATURES_DEDUPE_IDENTITY_COLLECTION=signature_dedupe_identity
FIREBASE_SIGNATURES_DEDUPE_RUT_COLLECTION=signature_dedupe_rut

PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_COUNTER_COLLECTION=public_stats
PUBLIC_FIREBASE_COUNTER_DOC=signatures_counter
```

Para analytics con Google Analytics 4:

```bash
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Otras variables útiles ya soportadas:

- límites de rate limiting
- toggles de high protection mode
- provider y llaves de CAPTCHA
- nombres alternativos de colecciones

Referencia:

- [config.ts](/home/javier/Documents/salvemos-humboldt/src/lib/security/config.ts)

## Reglas de Firestore

Publica reglas basadas en:

- [firestore.rules](/home/javier/Documents/salvemos-humboldt/firestore.rules)

El sitio no debe escribir firmas desde el navegador. La escritura efectiva ocurre server-side con credenciales de servicio.

## Importación histórica desde Google Forms

El proyecto ya incorpora tooling para transformar y cargar respuestas históricas.

### Archivos

- [transform_google_form_import.py](/home/javier/Documents/salvemos-humboldt/scripts/transform_google_form_import.py)
- [import_google_form_signatures.mjs](/home/javier/Documents/salvemos-humboldt/scripts/import_google_form_signatures.mjs)
- [reset_signature_collections.mjs](/home/javier/Documents/salvemos-humboldt/scripts/reset_signature_collections.mjs)

### Flujo

1. Colocar el Excel exportado desde Google Forms en el root.
2. Ejecutar el transformador.
3. Revisar `generated/`.
4. Hacer dry-run del importador.
5. Si el lote está correcto, importar con `--write`.

### Comandos

```bash
python3 scripts/transform_google_form_import.py
node scripts/import_google_form_signatures.mjs
node scripts/import_google_form_signatures.mjs --write
```

### Reset de colecciones antes de reimportar

```bash
node scripts/reset_signature_collections.mjs
```

Eso elimina:

- firmas
- colecciones de dedupe

y deja el contador auxiliar en `0`.

### Qué completa sintéticamente el importador

Cuando el Google Form histórico no trae todos los campos del sitio actual, se completan valores auditables:

- `email`
- `region`
- `commune`
- `message`
- y, si faltan en origen, también:
  - `age`
  - `country`
  - `legalNature`

Los RUT se limpian, rescatan y validan antes de generar el archivo listo para importar.

## Assets principales

- carta PDF fuente:
  - [Carta abierta de la comunidad científica sobre el estado de conservación del pingüino de Humboldt en Chile VF.docx.pdf](/home/javier/Documents/salvemos-humboldt/src/assets/Carta%20abierta%20de%20la%20comunidad%20cient%C3%ADfica%20sobre%20el%20estado%20de%20conservaci%C3%B3n%20del%20ping%C3%BCino%20de%20Humboldt%20en%20Chile%20VF.docx.pdf)
- asset público resumido:
  - [carta-abierta-pinguino-humboldt.pdf](/home/javier/Documents/salvemos-humboldt/public/assets/carta-abierta-pinguino-humboldt.pdf)
- logo:
  - [logo-pinguino.png](/home/javier/Documents/salvemos-humboldt/public/assets/logo-pinguino.png)
- og cover:
  - [og-cover.svg](/home/javier/Documents/salvemos-humboldt/public/assets/og-cover.svg)

## Despliegue en Vercel

### Requisitos

- proyecto Astro SSR
- adapter de Vercel
- variables de entorno de Neon y seguridad cargadas en Vercel
- variables de Firestore opcionales si quieres mantener fallback operativo
- Node runtime 22

### Dominios

El proyecto hoy está pensado para:

- canónico: `esmasqueunpinguino.cl`
- secundarios/redirección: `www.esmasqueunpinguino.cl`, `masqueunpinguino.cl`, `www.masqueunpinguino.cl`

### DNS

Si usas NIC Chile con Vercel DNS:

- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

## Analytics

El sitio soporta integración con Google Analytics 4 de forma condicional.

### Qué hace

- carga `gtag.js` solo si existe `PUBLIC_GA_MEASUREMENT_ID`
- la carga ocurre solo en producción
- si cambias `PUBLIC_GA_MEASUREMENT_ID` en Vercel, debes hacer redeploy para que el valor llegue al HTML público
- mantiene page views automáticos
- registra eventos de:
  - navegación principal
  - CTAs
  - apertura y descarga de documentos
  - clics sociales
  - envío exitoso y fallido del formulario de firmas

### Eventos instrumentados

- `cta_click`
- `navigation_click`
- `social_click`
- `document_open`
- `file_download`
- `signature_submit_success`
- `signature_submit_error`

## Operación y debugging

### Si el formulario no manda `POST`

Revisar:

- validación cliente
- `data-form-configured`
- origin permitido
- credenciales server-side

### Si el backend responde `409`

Interpretación:

- firma duplicada
- normalmente por RUT, email o identidad

### Si el contador no cuadra

Revisar:

- documentos `campaign_signatures`
- campo `status`
- que el sitio esté mostrando solo `accepted`

### Si Vercel y local difieren

Revisar primero:

- versión de Node
- variables de entorno cargadas
- runtime SSR

## Convenciones de trabajo para este repo

- no commitear `.astro/`
- no commitear `.vercel/`
- no commitear `dist/`
- no commitear Excel temporales del root
- los scripts de operación sí pueden vivir en `scripts/`
- los archivos de `generated/` deben tratarse como derivados salvo que explícitamente se necesiten versionar

## Próximos pasos razonables

- dashboard operativo para revisión de `flagged`
- exportación administrativa de firmas
- mejor normalización territorial para región/comuna
- analítica de conversión
- observabilidad y alertas
- hardening adicional ante campañas de abuso

## Resumen ejecutivo

Este no es solo un sitio. Es una pequeña plataforma de campaña con:

- narrativa pública
- formulario robusto
- persistencia segura
- dedupe operativo
- importación histórica
- despliegue serverless real

La prioridad técnica del proyecto es simple: permitir que una campaña ciudadana opere rápido, sea mantenible y no se caiga al primer problema real de producción.
