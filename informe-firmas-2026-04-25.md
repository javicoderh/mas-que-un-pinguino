# Informe de Integridad de Firmas
**Campaña Salvemos Humboldt** · Generado el 25 de abril de 2026

---

## Resumen ejecutivo

| | |
|---|---|
| **Total firmas combinadas** | 16.665 |
| → PostgreSQL (sistema actual) | 10.951 |
| → Firestore (sistema histórico) | 5.714 |
| **Firmas a depurar (mínimo seguro)** | **3** |
| **Firmas a revisar manualmente** | **2** |
| **Personas contadas dos veces** | **175** |

> El sistema de deduplicación funciona correctamente: no hay emails ni RUTs repetidos *dentro* de PostgreSQL. Los problemas detectados están en datos ingresados con RUT falso y en personas que firmaron en el sistema viejo (Firestore) y volvieron a firmar en el nuevo.

---

## 1 · RUTs claramente falsos — Borrar

Tres firmas tienen RUTs imposibles. No corresponden a ninguna persona real.

| Nombre | RUT | Motivo | Email | Fecha |
|--------|-----|--------|-------|-------|
| Emma Lodato | `000000000` | Todos ceros (9 dígitos) | m.emma.lodato@gmail.com | 12 abr 2026 |
| Yanina Gómez | `00000000` | Todos ceros (8 dígitos) | sam.yaninagomez@gmail.com | 16 abr 2026 |
| Violeta Ferrada | `111111111` | Todos unos | violeta1@disroot.org | 24 abr 2026 |

**Recomendación: eliminar las 3.** Son inválidas sin importar la intención detrás.

> **Nota adicional sobre Yanina Gómez:** el RUT `00000000` también aparece en Firestore a nombre de *Claudia Luviano Sandoval*, confirmando que este RUT fue usado por al menos dos personas distintas como comodín.

---

## 2 · RUTs dudosos — Revisar manualmente

Dos RUTs activaron la alerta de "patrón simple" porque comienzan con cinco doses seguidas, pero en Chile los RUTs ya superan el rango 22.000.000, por lo que *podrían* ser reales (menores de edad nacidos ~2018–2020).

| Nombre | RUT | Email | Fecha |
|--------|-----|-------|-------|
| Tomás Fuentealba | `222229057` | tomas.fuentealbac@gmail.com | 20 abr 2026 |
| Benjamin Albrecht | `222223814` | benjaminalbrechtcalderon@gmail.com | 24 abr 2026 |

**Recomendación: no borrar sin verificar.** Si se puede confirmar identidad por otro medio, conservar. Si no es posible, son candidatos a eliminar.

---

## 3 · Personas contadas dos veces — No borrar, ajustar conteo

**175 personas** tienen el mismo RUT en Firestore (sistema viejo) **y** en PostgreSQL (sistema actual). Firmaron dos veces en distintos momentos, en sistemas distintos.

Esto **no es fraude**: son personas reales que firmaron antes de la migración y volvieron a firmar cuando la campaña relanzó el formulario.

El problema es de **conteo**, no de legitimidad:

| Sistema | Qué cuenta |
|---------|-----------|
| Contador público | Baseline Firestore (5.480 fijo) + contador PostgreSQL (dinámico) |
| Estas 175 personas | Están sumadas en **ambos** lados |
| **Impacto en el total** | **+175 firmas de más en el contador público** |

**Recomendación: no eliminar las firmas, pero descontar 175 del baseline histórico** (bajar de 5.480 a 5.305) para reflejar el conteo real.

---

## 4 · Emails compartidos entre personas distintas — No borrar

Cuatro casos donde el mismo email fue usado por dos personas distintas (verificado: RUTs diferentes).

| Email | Persona en PG · RUT | Persona en Firestore · RUT | Vínculo probable |
|-------|--------------------|-----------------------------|-----------------|
| fercatari20@gmail.com | Jorge Gutierrez · `13260478-9` | Fernanda Gutierrez · `21941092-1` | Familiares (mismo apellido) |
| monserrat.caceres@ug.uchile.cl | Elsa Reveco · `13236027-8` | Monserrat Cáceres · `2153655-9K` | Email institucional U. de Chile compartido |
| roxana.jimenezc@gmail.com | Maria Contreras · `5984187-4` | Roxana Jiménez Contreras · `13487481-3` | Apellido en común — probable madre e hija |
| barbaraznrtu@gmail.com | Lissett Reyes · `10016244-K` | Bárbara Lissett Zañartu Reyes · `19292416-2` | Nombre "Lissett" en común — probable madre e hija |

**Recomendación: conservar todas.** Son cuatro firmas legítimas de personas distintas que comparten correo.

---

## 5 · Nombres duplicados dentro de PostgreSQL

**391 nombres** aparecen más de una vez en PostgreSQL, pero con emails y RUTs distintos. La deduplicación por RUT y email ya los filtra correctamente.

**Recomendación: no hacer nada.** La gran mayoría son homónimos reales (apellidos comunes como Fernández, González, Muñoz). El sistema ya garantiza que no hay duplicados por identidad.

---

## 6 · Patrones de envío agrupado

### 6.1 Misma IP — 389 firmas

389 firmas provienen de IPs desde las cuales se enviaron 3 o más firmas. En casi todos los casos corresponde a **colegios, organizaciones o lugares de trabajo** donde varias personas firmaron desde la misma red.

**Recomendación: no borrar.** Firmar desde una red compartida es completamente normal en campañas presenciales.

### 6.2 Mensajes idénticos repetidos — 237 firmas

237 firmas comparten exactamente el mismo texto en el campo "mensaje". Es un patrón típico de campañas coordinadas donde se sugiere un texto o se copia de redes sociales.

**Recomendación: no borrar.** No es indicador de fraude, sino de coordinación legítima entre firmantes.

---

## 7 · Emails con patrón sospechoso — 87 firmas

87 emails activaron alertas por dominio desechable, exceso de números o formato de bot. Ninguno fue rechazado por el sistema en su momento.

**Recomendación: no borrar masivamente.** Revisar solo si se necesita máxima pureza del listado. Muchos son reales.

---

## Resumen de acciones

| Acción | Firmas afectadas | Motivo |
|--------|-----------------|--------|
| **Eliminar** | 3 | RUT imposible (todos ceros o todos unos) |
| **Revisar manualmente** | 2 | RUT con patrón de dígito repetido, podría ser real |
| **Ajustar contador histórico** | −175 en baseline | Personas contadas en ambas BDs |
| **Conservar** | Todo lo demás | No hay evidencia de fraude masivo |

### Conteo corregido estimado

| | Antes | Después de depuración |
|--|-------|-----------------------|
| Firmas totales válidas | ~16.665 | **~16.487** |
| → PostgreSQL | 10.951 | **10.948** (−3 RUTs falsos) |
| → Firestore histórico (baseline) | 5.480 fijo | **5.305** (−175 dobles) |
| → Firestore no duplicado | 234 adicionales | 234 |

---

## 8 · Estadísticas de las firmas

> Basado en **11.133 firmas aceptadas en PostgreSQL** (sistema actual) al 25 de abril de 2026.

---

### 8.1 Distribución geográfica — Regiones

| Región | Firmas | % |
|--------|-------:|---:|
| Metropolitana de Santiago | 4.831 | 43,4% |
| Valparaíso | 1.503 | 13,5% |
| Biobío | 924 | 8,3% |
| Coquimbo | 813 | 7,3% |
| Los Lagos | 434 | 3,9% |
| Maule | 334 | 3,0% |
| Araucanía | 289 | 2,6% |
| O'Higgins | 265 | 2,4% |
| Antofagasta | 248 | 2,2% |
| Los Ríos | 217 | 1,9% |
| Atacama | 178 | 1,6% |
| Tarapacá | 134 | 1,2% |
| Magallanes | 112 | 1,0% |
| Ñuble | 98 | 0,9% |
| Arica y Parinacota | 67 | 0,6% |
| Aysén | 45 | 0,4% |
| Extranjero / Sin región | 641 | 5,8% |

> La RM concentra casi la mitad de las firmas; Valparaíso y Biobío son los dos polos regionales más activos. Se normalizaron más de 200 variantes de nombre para obtener estos totales.

---

### 8.2 Distribución geográfica — Top 10 comunas

| # | Comuna | % del total |
|---|--------|------------:|
| 1 | Santiago | 6,0% |
| 2 | Ñuñoa | 3,9% |
| 3 | Concepción | 3,0% |
| 4 | La Serena | 3,0% |
| 5 | Viña del Mar | 2,9% |
| 6 | La Florida | 2,8% |
| 7 | Puente Alto | 2,7% |
| 8 | Coquimbo | 2,5% |
| 9 | Valparaíso | 2,4% |
| 10 | Providencia | 2,2% |

---

### 8.3 Distribución por edad

| Rango | Firmas | % |
|-------|-------:|---:|
| 18–25 | 2.139 | 19,2% |
| 26–35 | 3.217 | 28,9% |
| 36–45 | 2.716 | 24,4% |
| 46–55 | 1.514 | 13,6% |
| 56–65 | 913 | 8,2% |
| 66 o más | 634 | 5,7% |

**Promedio de edad:** 38,7 años · **Mediana:** 36 años

> El grupo 26–35 es el más numeroso, seguido de cerca por el de 36–45. En conjunto, personas de 26 a 45 representan más de la mitad de las firmas (53,3%).

---

### 8.4 Género

El formulario de firma **no incluye campo de género**, por lo que no es posible reportar esta estadística. Si se desea recopilarla en futuras etapas, habría que agregar el campo como opcional en el formulario.

---

### 8.5 Origen — Chile vs. internacional

| Origen | Firmas | % |
|--------|-------:|---:|
| Chile | 11.033 | 99,1% |
| Internacional | 100 | 0,9% |

> El formulario principal es para residentes chilenos (requiere RUT). El pequeño porcentaje internacional corresponde a personas con datos de país distintos a Chile en el campo de afiliación u otras señales.

---

### 8.6 Participación y engagement

| Indicador | Valor | % |
|-----------|------:|---:|
| Firmas con suscripción a actualizaciones | ~5.973 | 53,7% |
| Firmas con mensaje personal | ~6.168 | 55,4% |
| Personas jurídicas (organizaciones) | 36 | 0,3% |
| Personas naturales | 11.097 | 99,7% |

> Más de la mitad de quienes firmaron dejaron un mensaje personal y autorizaron recibir actualizaciones, señal de un involucramiento activo con la campaña.

---

### 8.7 Evolución semanal

| Semana | Firmas | % acumulado |
|--------|-------:|------------:|
| Antes de abr 7 | — | — |
| 7–13 abr | ~892 | ~8,0% |
| 14–20 abr | ~1.336 | ~12,0% |
| 21–27 abr | ~5.342* | ~48,0% |

*\*La semana del 21 al 25 de abril concentra casi la mitad del total. Solo el 24 de abril (21,0%) y el 25 de abril (27,3%) suman cerca del 48,3% de todas las firmas — el mayor pico registrado en la campaña.*

> El relanzamiento de la campaña con extensión al 31 de mayo y la difusión en redes sociales explican el salto masivo de la última semana.

---

*Análisis realizado sobre datos extraídos directamente de PostgreSQL (Neon) y Firebase Firestore el 25 de abril de 2026.*

---

## 9 · Análisis de mensajes de firmantes

> Basado en **6,166 mensajes** dejados por firmantes al 25 de abril de 2026.


### 9.1 Palabras más frecuentes

| Palabra | Apariciones |
|---------|------------:|
| proteger | 1,387 |
| fauna | 1,073 |
| protección | 922 |
| naturaleza | 892 |
| pingüino | 878 |
| humboldt | 694 |
| especie | 577 |
| flora | 564 |
| especies | 502 |
| cuidar | 497 |
| ecosistema | 495 |
| importante | 481 |
| pingüinos | 463 |
| vida | 428 |
| animales | 409 |
| país | 391 |
| ambiente | 389 |
| medio | 385 |
| biodiversidad | 375 |
| debemos | 336 |

### 9.2 Frases de dos palabras más repetidas

| Frase | Apariciones |
|-------|------------:|
| pingüino humboldt | 501 |
| flora fauna | 456 |
| medio ambiente | 353 |
| proteger fauna | 163 |
| protección pingüino | 152 |
| proteger pingüino | 125 |
| debemos proteger | 117 |
| proteger naturaleza | 114 |
| peligro extinción | 105 |
| seres vivos | 99 |
| fauna flora | 96 |
| proteger especies | 91 |
| proteger flora | 90 |
| importante proteger | 85 |
| proteger especie | 81 |

### 9.3 Frases de tres palabras más repetidas

| Frase | Apariciones |
|-------|------------:|
| protección pingüino humboldt | 99 |
| proteger flora fauna | 88 |
| proteger pingüino humboldt | 75 |
| flora fauna país | 47 |
| protección medio ambiente | 44 |
| proteger medio ambiente | 39 |
| protección flora fauna | 30 |
| proteger fauna flora | 28 |
| cuidar medio ambiente | 27 |
| flora fauna chilena | 25 |

### 9.4 Temas detectados

Se identificaron los principales temas usando agrupamiento automático (TF-IDF + KMeans con 8 grupos). Cada grupo se describe con sus palabras clave y un mensaje representativo.

| # | Tema | Firmas | % | Palabras clave |
|---|------|-------:|--:|----------------|
| 1 | Protección y conservación general | 531 | 8.6% | pingüino, pingüino humboldt, humboldt, protección pingüino, proteger pingüino, protección |
| 2 | Ecosistema marino y biodiversidad | 452 | 7.3% | protección, protección fauna, protección especie, especie, fauna, protección pingüinos |
| 3 | Responsabilidad ciudadana | 2,844 | 46.1% | pingüinos, animales, ecosistema, vida, especie, importante |
| 4 | Futuras generaciones y legado | 227 | 3.7% | debemos, debemos proteger, proteger, debemos cuidar, cuidar, fauna |
| 5 | Preocupación por la especie | 622 | 10.1% | proteger, proteger naturaleza, proteger pingüinos, naturaleza, pingüinos, proteger especie |
| 6 | Ciencia y evidencia | 340 | 5.5% | medio ambiente, medio, ambiente, protección medio, proteger medio, protección |
| 7 | Identidad y amor por Chile | 612 | 9.9% | fauna, flora, flora fauna, proteger, proteger fauna, país |
| 8 | Urgencia y crisis ambiental | 538 | 8.7% | naturaleza, protección naturaleza, amo naturaleza, respeto, amo, cuidar naturaleza |

**Mensajes representativos por tema:**

- **Protección y conservación general:** *"Pingüino de Humboldt…"*
- **Ecosistema marino y biodiversidad:** *"Protección…"*
- **Responsabilidad ciudadana:** *"Cuidar los pingüinos equilibran el ecosistema…"*
- **Futuras generaciones y legado:** *"porque debemos proteger a los indefensos de los demonios que nos gobiernan…"*
- **Preocupación por la especie:** *"Para proteger…"*
- **Ciencia y evidencia:** *"Por que protejo nuestro medio ambiente…"*
- **Identidad y amor por Chile:** *"Porque no quiero que se destruya la flora y fauna…"*
- **Urgencia y crisis ambiental:** *"Por la naturaleza…"*

### 9.5 Mensajes exactamente iguales

**161** grupos de mensajes con texto idéntico (ya conocíamos 237 por el análisis previo). Los más frecuentes:

| Repeticiones | Mensaje (primeros 120 caracteres) |
|-------------:|-----------------------------------|
| 22 | para proteger a los pingüinos… |
| 19 | por los pingüinos… |
| 15 | para proteger al pingüino de humboldt… |
| 12 | para proteger la naturaleza… |
| 12 | para proteger al pingüino… |
| 11 | por convicción… |
| 9 | para la protección del pingüino de humboldt… |
| 7 | apoyo… |

> Los mensajes repetidos son típicos de campañas coordinadas donde se sugiere un texto en redes sociales. No son indicador de fraude.


### 9.6 Tono y sentimiento

Clasificación automática por léxico (español) en tres categorías: positivo, negativo y neutro.

| Tono | Mensajes | % |
|------|--------:|--:|
| Positivo | 3,119 | 50.6% |
| Negativo | 340 | 5.5% |
| Neutro | 2,707 | 43.9% |

**Ejemplos por tono:**

*Positivo*
> "Para proteger nuestra flora y fauna chilena"
> "Por qué considero que el pingüino de Humboldt debe ser protegido ya que es parte esencial de nuestra biodiversidad y parte importante de nuestro país"
> "Porque si se debe cuidar y proteger a este ser vivo, es lo mínimo que podemos hacer por ellos, respeto a ka vida"

*Negativo*
> "Por resguardar la fauna que está en peligro de mí país."
> "Los pingüinos y todos los animales que habitan nuestro país y planeta son valiosos, nos permiten tener un planeta sano y lejos de la extinción. A demás son seres sintientes que mer"
> "Porque debemos preservar el patrimonio ecológico de nuestro país, eso es ser un verdadero patriota, amar a su gente, a su flora y fauna y a su tierra. Es nuestro deber buscar alter"

*Neutro*
> "Por Defender de la naturaleza que nos va quedando."
> "Por la protección al medio ambiente y sus especies, no a la intervención que pone en riesgo la preservación"
> "Porque vale la pena proteger, difundir y preservar nuestra fauna y flora nativa, que cumplen roles estratégicos en el eco sistema."

> **Nota metodológica:** el análisis de sentimiento usa un léxico de palabras positivas y negativas en español. Dado que la mayoría de los mensajes mezclan preocupación (negativo) con intención de cuidar (positivo), el clasificador tiende a neutralizar muchas entradas. Los resultados son orientativos.
