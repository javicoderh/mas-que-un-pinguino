# Webcheck Improvement Plan

## Goal

Cerrar los aspectos técnicos que sí dependen del repo, fortalecer la capa interna visible del sitio y dejar una base repetible para re-ejecutar Webcheck con menos ruido y mejor trazabilidad.

## Scope

### In scope

- metadatos públicos y consistencia editorial
- enlaces públicos estables
- señales visibles de seriedad institucional
- verificación automatizada de superficie pública
- documentación de checkpoints para retomar trabajo sin ambigüedad

### Out of scope

- DNS, MX, SPF, DKIM, DMARC
- redirects `www/non-www/http/https` en el edge
- negociación TLS, cipher suites y client support reales
- reputación externa, threats, carbon, trace-route

## Execution Plan

### Step 1

Status: `completed`

Checkpoint:

- Se auditó el estado actual de `main`
- Se confirmó que `sitemap`, `robots`, OG, canonical, headers básicos y `security.txt` ya existen
- Se identificaron los vacíos internos con mayor impacto:
  - enlaces editoriales estables
  - capa visible institucional
  - verificación automatizada

Resume from:

- continuar con Step 2 si este archivo existe pero aún no hay cambios visibles ni script de verificación

### Step 2

Status: `completed`

Checkpoint target:

- Crear este archivo como bitácora persistente
- Documentar alcance, dependencias externas y criterio de “hecho”

Resume from:

- si este archivo ya existe, revisar el primer paso con `pending` y retomar desde ahí

### Step 3

Status: `completed`

Checkpoint target:

- mover enlaces editoriales clave a URLs públicas estables
- reforzar páginas visibles de confianza pública y señales técnicas
- no romper navegación existente

Expected outputs:

- actualización de `campaign.ts`
- ajustes en páginas visibles como `carta`, `transparencia`, `contacto`, footer

Checkpoint:

- la carta pública ya usa URL estable
- el footer y páginas públicas exponen señales visibles de transparencia técnica
- el sitio comunica mejor su seriedad institucional sin cambiar el flujo principal

### Step 4

Status: `completed`

Checkpoint target:

- agregar script de verificación automatizada de superficie pública
- exponerlo en `package.json`
- validar:
  - `robots.txt`
  - `sitemap.xml`
  - `security.txt`
  - metadata crítica
  - headers esperados en config

Checkpoint:

- existe `npm run verify:web-surface`
- el script valida archivos, metadatos y headers esperados en repo

### Step 5

Status: `completed`

Checkpoint target:

- correr `npm run check`
- correr `npm run build`
- correr script de verificación pública
- actualizar este archivo con estado final y observaciones

Checkpoint:

- `npm run check` pasó
- `npm run build` pasó
- `npm run verify:web-surface` pasó
- solo queda 1 hint no bloqueante en `scripts/import_google_form_signatures.mjs`

Resume from:

- volver a correr Webcheck en producción
- contrastar el nuevo resultado con `PRODUCTION_READINESS_AUDIT.md`
- si persisten errores, tratar como externos salvo evidencia concreta en repo

## Done Criteria

- el sitio mantiene build y checks verdes
- existe un script repetible para validar superficie pública
- la capa visible comunica mejor seriedad institucional
- queda documentado qué sigue dependiendo de hosting o DNS

## External Follow-up After Deploy

- verificar `Strict-Transport-Security` en producción
- verificar `/.well-known/security.txt` servido por el dominio final
- re-ejecutar Webcheck
- contrastar especialmente:
  - `security-txt`
  - `hsts`
  - `status`
  - `mail-config`
  - `txt-records`
