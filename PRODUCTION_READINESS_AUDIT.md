# Production Readiness Audit

## Executive Summary

El repo está en buen estado para una campaña pública SSR con foco en indexabilidad, previews sociales y legibilidad para agentes automáticos. La mayor parte de la capa pública que sí depende del código ya está implementada: `sitemap.xml`, `robots.txt`, `security.txt`, canonical, Open Graph/Twitter, JSON-LD básico, 404 custom y headers razonables.

Los errores externos de Webcheck no se explican todos por el repo. Varios caen en hosting, TLS, CDN o DNS. En esta pasada se corrigió dentro del repo lo que seguía claramente pendiente y era seguro de aplicar: preparación explícita de HSTS en la capa de headers.

Pendientes principales fuera del repo:

- TLS real y compatibilidad de clientes/cifrados
- mail-config, MX y TXT records
- amenazas, screenshot, trace-route y carbon
- verificación externa de que `security.txt` y HSTS ya estén siendo servidos en producción después del deploy

## Findings

| Area | Status | Evidence in repo | External dependency? | Recommended action |
|---|---|---|---|---|
| Sitemap | OK | [src/pages/sitemap.xml.ts](/home/javier/Documents/salvemos-humboldt/src/pages/sitemap.xml.ts) genera XML con rutas públicas; [src/pages/sitemap-index.xml.ts](/home/javier/Documents/salvemos-humboldt/src/pages/sitemap-index.xml.ts) redirige por compatibilidad | No | Mantener la lista de rutas públicas actualizada cuando se agreguen páginas indexables |
| robots.txt | OK | [src/pages/robots.txt.ts](/home/javier/Documents/salvemos-humboldt/src/pages/robots.txt.ts) y [public/robots.txt](/home/javier/Documents/salvemos-humboldt/public/robots.txt) permiten `/`, bloquean `/api/` y anuncian sitemap | No | Mantener ambos alineados o consolidar en una sola fuente si más adelante simplificas |
| Social tags / OG / canonical | OK | [src/layouts/MainLayout.astro](/home/javier/Documents/salvemos-humboldt/src/layouts/MainLayout.astro) define `title`, `description`, canonical, OG, Twitter y `theme-color` | No | Mantener y, si quieres mejorar previews, reemplazar [og-cover.svg](/home/javier/Documents/salvemos-humboldt/public/assets/og-cover.svg) por imagen raster 1200x630 |
| Structured data | OK | [src/layouts/MainLayout.astro](/home/javier/Documents/salvemos-humboldt/src/layouts/MainLayout.astro) inyecta JSON-LD `Organization` y `WebSite` | No | Ampliar con `FAQPage` o `Article` solo si aparecen contenidos que lo justifiquen |
| Security headers | OK | [vercel.json](/home/javier/Documents/salvemos-humboldt/vercel.json) y [src/middleware.ts](/home/javier/Documents/salvemos-humboldt/src/middleware.ts) definen `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy` | Parcial | Confirmar en producción con `curl -I` después de desplegar |
| HSTS readiness | Partial | Se agregó `Strict-Transport-Security` en [vercel.json](/home/javier/Documents/salvemos-humboldt/vercel.json) y [src/middleware.ts](/home/javier/Documents/salvemos-humboldt/src/middleware.ts) | Sí | Verificar que producción sirva solo HTTPS canónico antes de considerar esto completamente OK |
| security.txt | OK | [src/pages/.well-known/security.txt.ts](/home/javier/Documents/salvemos-humboldt/src/pages/.well-known/security.txt.ts) y [public/.well-known/security.txt](/home/javier/Documents/salvemos-humboldt/public/.well-known/security.txt) existen | Parcial | Verificar externamente que la URL final responda `200` tras deploy |
| Semantic HTML / legibility | OK | [src/layouts/MainLayout.astro](/home/javier/Documents/salvemos-humboldt/src/layouts/MainLayout.astro) usa `main`; las páginas públicas ya usan `h1` vía [src/components/ui/SectionHeading.astro](/home/javier/Documents/salvemos-humboldt/src/components/ui/SectionHeading.astro) | No | Mantener un `h1` por página y SSR para contenido principal |
| Status codes | Partial | [src/pages/api/signatures/count.ts](/home/javier/Documents/salvemos-humboldt/src/pages/api/signatures/count.ts) devuelve `503` en fallo; [src/pages/404.astro](/home/javier/Documents/salvemos-humboldt/src/pages/404.astro) existe | Parcial | Verificar en hosting que redirects y 404 del edge se comporten igual que local/build |
| Redirects | Partial | Hay canonical y compatibilidad de sitemap antiguo, pero no hay reglas repo para `www/non-www/http/https` | Sí | Configurar redirects canónicos en Vercel o proveedor DNS/edge |
| Mail-config readiness | Unknown | El repo solo expone correo de contacto en [src/content/campaign.ts](/home/javier/Documents/salvemos-humboldt/src/content/campaign.ts); no hay dominio de correo operativo configurado | Sí | Definir si se usará `@esmasqueunpinguino.cl`; si sí, configurar MX, SPF, DKIM, DMARC |
| TXT records readiness | Unknown | No hay infraestructura DNS versionada en el repo | Sí | Verificar/crear TXT para SPF, DMARC, DKIM y cualquier verificación de proveedor |
| TLS / cipher suites / client support | Unknown | El repo usa HTTPS canónico en [astro.config.ts](/home/javier/Documents/salvemos-humboldt/astro.config.ts), pero no controla la negociación TLS final | Sí | Validar en el edge/CDN con Webcheck, SSL Labs o `openssl s_client` |
| Tech stack visibility | Partial | El stack es inferible por [package.json](/home/javier/Documents/salvemos-humboldt/package.json) y [README.md](/home/javier/Documents/salvemos-humboldt/README.md), pero Webcheck puede no detectarlo desde headers | Parcial | No hace falta cambiar el sitio por esto; como mucho, revisar si el deploy está ocultando señales útiles o generando respuestas genéricas |
| Public campaign seriousness | Partial | La base es sólida, pero en [src/content/campaign.ts](/home/javier/Documents/salvemos-humboldt/src/content/campaign.ts) siguen vacíos `letterPdf`, `form` y `linktree` | No | Completar enlaces editoriales definitivos para evitar percepción de campaña incompleta |

## Changes Made In This Pass

- Se agregó `Strict-Transport-Security` a [vercel.json](/home/javier/Documents/salvemos-humboldt/vercel.json).
- Se agregó `strict-transport-security` en [src/middleware.ts](/home/javier/Documents/salvemos-humboldt/src/middleware.ts) para respuestas dinámicas.
- Se creó este archivo de auditoría para dejar trazabilidad en el repo.

## Pending External Dependencies

### Hosting / CDN / Edge

- Confirmar que producción sirve HSTS.
- Confirmar redirects limpios `http -> https` y `www/non-www`.
- Revisar por qué Webcheck marca `status`, `screenshot`, `features` o `tech-stack` como error si el sitio ya responde correctamente.

### DNS / Domain Provider

- MX records
- SPF TXT
- DKIM TXT
- DMARC TXT
- otros TXT de verificación si el proveedor de correo lo exige

### TLS

- cipher suites
- TLS security config
- client support
- threat intel o reputación externa

## Implementation Notes

- No se cambiaron flujos funcionales de la app.
- No se inventaron configuraciones de correo ni DNS inexistentes.
- No se tocaron redirects canónicos de host porque dependen del entorno de despliegue.

## Final Checklist Before Production

- [ ] `https://esmasqueunpinguino.cl/robots.txt` responde `200`
- [ ] `https://esmasqueunpinguino.cl/sitemap.xml` responde `200`
- [ ] `https://esmasqueunpinguino.cl/.well-known/security.txt` responde `200`
- [ ] `curl -I https://esmasqueunpinguino.cl` muestra `Strict-Transport-Security`
- [ ] `curl -I http://esmasqueunpinguino.cl` redirige a HTTPS
- [ ] `curl -I https://www.esmasqueunpinguino.cl` redirige al host canónico elegido
- [ ] Open Graph y Twitter cards renderizan bien en validadores externos
- [ ] MX, SPF, DKIM y DMARC están definidos si se usará correo del dominio
- [ ] No quedan enlaces editoriales vacíos en contenido público

## Expected Webcheck Changes After This Pass

Deberían mejorar o dejar de depender del repo:

- `security-txt`
- `hsts`

Probablemente seguirán siendo externos o parcialmente externos:

- `mail-config`
- `txt-records`
- `tls-cipher-suites`
- `tls-security-config`
- `tls-client-support`
- `trace-route`
- `threats`
- `carbon`
- parte de `status`, `features` o `tech-stack` según cómo Webcheck interprete el deploy final
