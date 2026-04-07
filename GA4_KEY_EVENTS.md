# GA4 Key Events

## Objetivo principal

El indicador clave principal del sitio debe ser:

- `signature_submit_success`

Este evento representa la conversión real de la campaña: una firma registrada con éxito.

## Parámetros enviados

El sitio envía `signature_submit_success` con estos parámetros:

- `form_name`
- `page_path`
- `submission_status`
- `conversion_type`
- `ui_surface`
- `source_context`

## Configuración recomendada en GA4

1. Ir a `Admin`.
2. Abrir `Events`.
3. Verificar que aparezca `signature_submit_success`.
4. Activar `Mark as key event` para `signature_submit_success`.

## Recomendación adicional

Como microconversión secundaria puede observarse:

- `document_open`

Pero el `Key event` principal debe mantenerse en `signature_submit_success` para no mezclar señales de intención con la conversión final.
