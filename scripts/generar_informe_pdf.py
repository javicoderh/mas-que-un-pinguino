"""
Genera informe-firmas-2026-04-25.pdf desde el archivo .md
con diseño editorial pensado para lectura en PDF.
"""

import os
import re
import markdown
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
MD_PATH  = os.path.join(BASE_DIR, "informe-firmas-2026-04-25.md")
PDF_PATH = os.path.join(BASE_DIR, "informe-firmas-2026-04-25.pdf")


# ── Pre-procesado del markdown ────────────────────────────────────────────────

def preprocess(text: str) -> str:
    # Quitar la primera línea (título H1 y subtítulo) — los ponemos en la portada
    lines = text.split("\n")
    # Saltar las primeras 3 líneas (título, subtítulo, línea vacía)
    body = "\n".join(lines[3:])
    return body


def md_to_html(md_text: str) -> str:
    extensions = ["tables", "fenced_code", "nl2br", "smarttpants"]
    try:
        return markdown.markdown(md_text, extensions=extensions)
    except Exception:
        return markdown.markdown(md_text, extensions=["tables", "fenced_code"])


# ── CSS ───────────────────────────────────────────────────────────────────────

CSS_STYLES = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Serif+Display&display=swap');

:root {
  --bg:       #FAFAF8;
  --surface:  #FFFFFF;
  --navy:     #0B1929;
  --navy2:    #122136;
  --gold:     #C8A83A;
  --gold-lt:  #F0D87A;
  --text:     #1A2332;
  --muted:    #5A6A7A;
  --border:   #DDE3EB;
  --accent:   #1A6BBF;
  --red:      #C0392B;
  --green:    #1E7E4A;
  --font-body: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  --font-head: 'DM Serif Display', Georgia, serif;
}

/* ── Layout ── */
@page {
  size: A4;
  margin: 20mm 18mm 22mm 18mm;
  @bottom-center {
    content: counter(page);
    font-family: var(--font-body);
    font-size: 8pt;
    color: var(--muted);
  }
}

@page :first {
  margin: 0;
  @bottom-center { content: none; }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  font-size: 10pt;
  line-height: 1.7;
  color: var(--text);
  background: var(--bg);
}

/* ── Portada ── */
.cover {
  width: 100%;
  height: 297mm;
  background: var(--navy);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  page-break-after: always;
  position: relative;
  overflow: hidden;
}

.cover-accent-bar {
  position: absolute;
  top: 0; left: 0;
  width: 6px; height: 100%;
  background: var(--gold);
}

.cover-top-band {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--gold), transparent);
}

.cover-circle {
  position: absolute;
  top: -80px; right: -80px;
  width: 350px; height: 350px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(200,168,58,0.12), transparent 70%);
}

.cover-circle-2 {
  position: absolute;
  bottom: 60px; left: -60px;
  width: 220px; height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(26,107,191,0.15), transparent 70%);
}

.cover-content {
  position: relative;
  padding: 0 40px 50px 46px;
}

.cover-eyebrow {
  font-family: var(--font-body);
  font-size: 8pt;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.cover-eyebrow::before {
  content: '';
  display: inline-block;
  width: 28px; height: 1.5px;
  background: var(--gold);
}

.cover-title {
  font-family: var(--font-head);
  font-size: 32pt;
  line-height: 1.15;
  color: #FFFFFF;
  margin-bottom: 10px;
}

.cover-subtitle {
  font-size: 12pt;
  color: rgba(255,255,255,0.55);
  margin-bottom: 40px;
  font-weight: 400;
}

.cover-meta {
  display: flex;
  gap: 32px;
  border-top: 1px solid rgba(255,255,255,0.1);
  padding-top: 20px;
}

.cover-meta-item {
  display: flex;
  flex-direction: column;
}

.cover-meta-label {
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin-bottom: 3px;
}

.cover-meta-value {
  font-size: 11pt;
  font-weight: 600;
  color: var(--gold-lt);
}

.cover-penguin {
  font-size: 80pt;
  position: absolute;
  top: 55px;
  right: 50px;
  opacity: 0.18;
  line-height: 1;
}

/* ── Contenido ── */
.content {
  padding: 0;
}

/* ── Sección hr ── */
hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 20px 0;
}

/* ── Headings ── */
h2 {
  font-family: var(--font-head);
  font-size: 17pt;
  color: var(--navy);
  margin-top: 32px;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--gold);
  page-break-after: avoid;
}

h3 {
  font-family: var(--font-body);
  font-size: 11pt;
  font-weight: 700;
  color: var(--navy2);
  margin-top: 20px;
  margin-bottom: 8px;
  page-break-after: avoid;
}

/* ── Sección especial: Resumen ejecutivo ── */
.exec-summary h2 {
  color: var(--navy);
}

/* ── Párrafos ── */
p {
  margin-bottom: 8px;
}

strong {
  font-weight: 700;
  color: var(--navy);
}

em { font-style: italic; }

/* ── Blockquote ── */
blockquote {
  border-left: 3px solid var(--gold);
  margin: 12px 0;
  padding: 8px 14px;
  background: rgba(200,168,58,0.06);
  border-radius: 0 4px 4px 0;
  color: var(--muted);
  font-size: 9.5pt;
}

blockquote p { margin-bottom: 0; }

/* ── Code / inline ── */
code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 8.5pt;
  background: #EFF2F6;
  color: #C0392B;
  padding: 1px 4px;
  border-radius: 3px;
}

/* ── Tablas ── */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 16px;
  font-size: 9pt;
  page-break-inside: avoid;
}

thead tr {
  background: var(--navy);
  color: #FFFFFF;
}

thead th {
  padding: 7px 10px;
  text-align: left;
  font-weight: 600;
  font-size: 8.5pt;
  letter-spacing: 0.04em;
}

thead th:first-child { border-radius: 4px 0 0 0; }
thead th:last-child  { border-radius: 0 4px 0 0; }

tbody tr:nth-child(even) { background: #F2F5F9; }
tbody tr:nth-child(odd)  { background: #FFFFFF; }

tbody tr:hover { background: #EBF0F8; }

td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

td:first-child { font-weight: 500; }

/* Columnas numéricas a la derecha */
td:last-child, th:last-child {
  text-align: right;
}

/* Tabla de resumen ejecutivo — 2 cols igual ancho */
.exec-table td:first-child { font-weight: 400; }
.exec-table td:last-child  { font-weight: 700; text-align: left; }

/* ── Listas ── */
ul, ol {
  margin: 8px 0 10px 18px;
}
li { margin-bottom: 3px; }

/* ── Etiquetas de recomendación ── */
.tag-delete  { color: var(--red);   font-weight: 700; }
.tag-keep    { color: var(--green); font-weight: 700; }
.tag-review  { color: #D68910;      font-weight: 700; }

/* ── Notas a pie de página ── */
.footer-note {
  margin-top: 32px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 8pt;
  color: var(--muted);
  font-style: italic;
}

/* ── Chips de estadística ── */
.stat-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 14px 0;
}

.stat-chip {
  background: var(--navy);
  color: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  min-width: 100px;
  text-align: center;
}

.stat-chip .val {
  font-family: var(--font-head);
  font-size: 18pt;
  color: var(--gold-lt);
  display: block;
  line-height: 1.1;
}

.stat-chip .lbl {
  font-size: 7.5pt;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* ── Separador de sección ── */
.section-break { page-break-before: always; }
"""

# ── HTML de portada ───────────────────────────────────────────────────────────

COVER_HTML = """
<div class="cover">
  <div class="cover-accent-bar"></div>
  <div class="cover-top-band"></div>
  <div class="cover-circle"></div>
  <div class="cover-circle-2"></div>
  <div class="cover-penguin">🐧</div>
  <div class="cover-content">
    <div class="cover-eyebrow">Campaña Ciudadana · Es más que un pingüino</div>
    <div class="cover-title">Informe de<br>Integridad de Firmas</div>
    <div class="cover-subtitle">Análisis de validez, estadísticas y mensajes ciudadanos</div>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <span class="cover-meta-label">Fecha</span>
        <span class="cover-meta-value">25 de abril de 2026</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Firmas analizadas</span>
        <span class="cover-meta-value">16.665 combinadas</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Fuentes</span>
        <span class="cover-meta-value">PostgreSQL · Firestore</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Uso</span>
        <span class="cover-meta-value">Interno — confidencial</span>
      </div>
    </div>
  </div>
</div>
"""

# ── Chips del resumen ejecutivo ───────────────────────────────────────────────

STAT_CHIPS_HTML = """
<div class="stat-row">
  <div class="stat-chip">
    <span class="val">16.665</span>
    <span class="lbl">Total combinado</span>
  </div>
  <div class="stat-chip">
    <span class="val">10.951</span>
    <span class="lbl">PostgreSQL</span>
  </div>
  <div class="stat-chip">
    <span class="val">5.714</span>
    <span class="lbl">Firestore</span>
  </div>
  <div class="stat-chip">
    <span class="val">3</span>
    <span class="lbl">A eliminar</span>
  </div>
  <div class="stat-chip">
    <span class="val">175</span>
    <span class="lbl">Doble conteo</span>
  </div>
  <div class="stat-chip">
    <span class="val">~16.487</span>
    <span class="lbl">Válidas corregidas</span>
  </div>
</div>
"""

# ── Post-procesado del HTML generado ─────────────────────────────────────────

def postprocess_html(html: str) -> str:
    # Insertar chips después del primer <table> (resumen ejecutivo)
    html = html.replace(
        "</table>\n<blockquote>",
        f"</table>\n{STAT_CHIPS_HTML}\n<blockquote>",
        1  # solo la primera ocurrencia
    )

    # Colorear texto de recomendación (Eliminar / conservar / revisar)
    html = re.sub(
        r"(Eliminar|eliminar las 3|borrar)",
        r'<span class="tag-delete">\1</span>',
        html
    )
    html = re.sub(
        r"(conservar todas|no hacer nada|no borrar\.)",
        r'<span class="tag-keep">\1</span>',
        html
    )
    html = re.sub(
        r"(Revisar manualmente|no borrar sin verificar)",
        r'<span class="tag-review">\1</span>',
        html
    )

    # Agregar salto de página antes de secciones H2 largas
    for sec in ["## 8", "## 9"]:
        html = html.replace(
            f'<h2>{sec[3:]}',
            f'<h2 class="section-break">{sec[3:]}',
        )

    return html


# ── Ensamblado del HTML completo ──────────────────────────────────────────────

def build_full_html(md_path: str) -> str:
    with open(md_path, encoding="utf-8") as f:
        raw = f.read()

    body_md = preprocess(raw)
    body_html = md_to_html(body_md)
    body_html = postprocess_html(body_html)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Informe de Integridad de Firmas · Es más que un pingüino</title>
</head>
<body>
  {COVER_HTML}
  <div class="content">
    {body_html}
    <p class="footer-note">
      Análisis realizado sobre datos extraídos directamente de PostgreSQL (Neon) y Firebase Firestore
      el 25 de abril de 2026. Documento de uso interno — campaña Es más que un pingüino.
    </p>
  </div>
</body>
</html>"""


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Generando HTML…", flush=True)
    html = build_full_html(MD_PATH)

    print("Convirtiendo a PDF…", flush=True)
    font_config = FontConfiguration()
    css = CSS(string=CSS_STYLES, font_config=font_config)
    doc = HTML(string=html, base_url=BASE_DIR)
    doc.write_pdf(PDF_PATH, stylesheets=[css], font_config=font_config)

    size_kb = os.path.getsize(PDF_PATH) // 1024
    print(f"✓ PDF generado: {PDF_PATH}  ({size_kb} KB)", flush=True)


if __name__ == "__main__":
    main()
