# Cómo obtener las credenciales de Flow para conectar los pagos

Este documento explica paso a paso cómo crear una cuenta en Flow, obtener las credenciales necesarias y configurarlas en la aplicación. No se necesitan conocimientos técnicos para seguir esta guía.

---

## ¿Qué es Flow y para qué sirve?

Flow (flow.cl) es una plataforma chilena que procesa pagos en línea. Cuando alguien dona a través del sitio, Flow se encarga de cobrar con tarjeta de crédito, débito o transferencia, y luego notifica a la aplicación que el pago fue exitoso.

Para que la aplicación pueda comunicarse con Flow, necesita dos "contraseñas especiales" llamadas **API Key** y **Secret Key**. Estas son las credenciales que vas a obtener en esta guía.

---

## Paso 1 — Crear una cuenta en Flow

1. Entra a **https://www.flow.cl**
2. Haz clic en **"Regístrate"** o **"Crear cuenta"**
3. Completa el formulario con los datos de la organización o persona responsable de recibir los pagos:
   - Nombre completo o razón social
   - RUT
   - Email de contacto
   - Contraseña
4. Confirma tu email haciendo clic en el enlace que Flow te enviará

> **Nota:** Flow requiere verificación de identidad para activar los pagos reales. Puede pedirte documentos como cédula de identidad o documentos de la organización. Este proceso puede tomar 1 a 3 días hábiles.

---

## Paso 2 — Acceder al panel de Flow

Una vez que tu cuenta esté activa y hayas iniciado sesión, verás el panel principal de Flow.

En el menú de la izquierda (o en la sección de configuración), busca una opción llamada:

- **"Integración"**, o
- **"API"**, o
- **"Configuración de API"**

El nombre exacto puede variar según la versión del panel, pero siempre está en el área de configuración o ajustes de la cuenta.

---

## Paso 3 — Obtener las credenciales

Dentro de la sección de integración o API verás dos valores importantes:

| Credencial | Qué es |
|---|---|
| **API Key** | Es como el nombre de usuario de la aplicación. Se lo entregas a Flow para identificarse. |
| **Secret Key** | Es como la contraseña. Se usa internamente para firmar las transacciones y nunca debe compartirse públicamente. |

Copia ambos valores. Los necesitarás en el siguiente paso.

> ⚠️ **Importante:** El Secret Key es confidencial. No lo compartas por WhatsApp, email sin cifrar, ni lo subas a ningún repositorio público de código. Trátalo como una contraseña bancaria.

---

## Paso 4 — Entorno de pruebas vs entorno real

Flow tiene dos entornos:

| Entorno | URL de la API | Para qué sirve |
|---|---|---|
| **Sandbox (pruebas)** | `https://sandbox.flow.cl/api` | Hacer pruebas sin dinero real. Los pagos son simulados. |
| **Producción (real)** | `https://www.flow.cl/api` | Pagos reales con dinero real. |

**Recomendación:** Primero configura el entorno sandbox para verificar que todo funciona, y solo cuando estés seguro cambia a producción.

En el panel de Flow hay una sección para obtener las credenciales de **sandbox** por separado de las de **producción**. Asegúrate de usar las correctas para cada etapa.

---

## Paso 5 — Configurar las credenciales en la aplicación

Una vez que tengas las credenciales, hay que agregarlas al archivo de configuración de la aplicación. Este archivo se llama `.env` y lo maneja el equipo técnico.

Envíale al desarrollador los siguientes tres datos de forma segura (por ejemplo, por un canal cifrado o en persona):

```
FLOW_API_KEY=aquí va tu API Key
FLOW_SECRET_KEY=aquí va tu Secret Key
FLOW_API_URL=https://sandbox.flow.cl/api   ← para pruebas
             https://www.flow.cl/api        ← para producción
```

El desarrollador los pegará en el archivo `.env` del servidor y la integración quedará activa.

---

## Resumen rápido

```
1. Crear cuenta en flow.cl
2. Verificar identidad (puede tomar 1-3 días)
3. Ir a Configuración → API / Integración
4. Copiar API Key y Secret Key
5. Enviarlos al desarrollador de forma segura
```

---

## Preguntas frecuentes

**¿Cuánto cobra Flow por cada transacción?**
Flow cobra una comisión por cada pago procesado. El porcentaje exacto depende del tipo de cuenta y volumen. Puedes verlo en **https://www.flow.cl/precios**.

**¿Puedo tener varias cuentas (pruebas y producción)?**
No es necesario. La misma cuenta tiene un panel de sandbox y uno de producción con credenciales distintas.

**¿Qué pasa si pierdo el Secret Key?**
Puedes regenerarlo desde el panel de Flow en la sección de API. Al hacerlo, el anterior deja de funcionar y hay que actualizar el `.env` con el nuevo valor.

**¿Flow funciona con donantes en el extranjero?**
Flow procesa principalmente pagos chilenos (tarjetas emitidas en Chile). Para donantes internacionales con tarjetas extranjeras, el soporte puede ser limitado. Si esto es importante, consulta con Flow directamente o considera integrar un segundo proveedor como Stripe para pagos internacionales.
