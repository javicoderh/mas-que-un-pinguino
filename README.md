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
- Firebase Firestore para guardar firmas

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
- `/firma` formulario de firma conectado por cliente a Firestore
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

## Configurar Firestore

1. Crea un proyecto en Firebase y habilita Firestore.
2. Copia `.env.example` a `.env`.
3. Completa estas variables públicas:

```bash
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

La integración actual escribe directo desde el cliente a Firestore. Eso evita montar backend en esta fase, pero exige reglas bien cerradas.

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

## Puntos de extensión técnica

- contador real de firmas
- analytics
- newsletter o voluntariado
- sitemap con integración Astro
- formularios o APIs serverless
- módulo de mapa/calendario para participación territorial
- endurecer reglas y anti-spam del flujo de firmas

## Nota de implementación

La base evita CMS, auth y backend tradicional en esta etapa. La prioridad es velocidad, claridad editorial, buen SEO, accesibilidad y facilidad de handoff.
