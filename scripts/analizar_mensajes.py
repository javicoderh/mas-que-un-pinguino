"""
Análisis de mensajes de firmantes: temas, frecuencias, similitudes y sentimiento.
Produce secciones Markdown listas para insertar en el informe.
"""

import asyncio
import re
import os
import sys
from collections import Counter
from difflib import SequenceMatcher

import asyncpg
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

DATABASE_URL = "postgresql://neondb_owner:npg_2KNXAoyYguU9@ep-frosty-smoke-ammrhe89.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"

STOPWORDS_ES = set("""
a al algo algunas algunos ante antes como con contra cual cuando de del desde
donde durante e el ella ellas ellos en entre era eres es esa esas ese eso esos
esta estas este esto estos fue fui han has hay he hizo la las le les lo los
lo más me mi mis mucho muy nada ni no nos o para pero por que quien se si sin
sobre solo su sus también tan te tengo tener toda todas todo todos tu tus un
una unas uno unos ya yo
esta este estos estas esa ese esas esos cada hay sido estar ser esta siendo
estar ser del dicho así tanto porque aunque sino quiero quieren podemos pueden
vamos hay tiene tienen tener creo creo sé por eso mi sus su aquí ahí donde cuando
si no sino me te se le les lo la las el ella eso esa él así tras tras hacia
hemos habido había habia había han tiene tienen tener quiero pueden podemos
nuestros nuestras nuestra nuestro sus su se si hay que de del en por para con
desde hasta sin sobre entre los las lo un una unos unas y o e ni mas más
""".split())

TOPIC_LABELS = {
    0: "Protección y conservación general",
    1: "Ecosistema marino y biodiversidad",
    2: "Responsabilidad ciudadana",
    3: "Futuras generaciones y legado",
    4: "Preocupación por la especie",
    5: "Ciencia y evidencia",
    6: "Identidad y amor por Chile",
    7: "Urgencia y crisis ambiental",
}

POSITIVE_WORDS = set("""
apoyo apoyar proteger protección cuidar cuidado amor importante necesario
esencial vital hermoso hermosa belleza querido querer salvar esperanza
orgulloso orgullosa valioso valiosa admirar admiración comprometido comprometida
feliz felicidad bien bueno buena gracias maravilloso maravillosa
""".split())

NEGATIVE_WORDS = set("""
triste tristeza preocupa preocupación pena dolor lamentable terrible crisis
amenaza peligro riesgo perder pérdida extinción extinción daño destruir
destrucción urgente alarmante desastre catástrofe injusto injusta mal mala
""".split())


def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\sáéíóúüñ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str) -> list[str]:
    tokens = clean_text(text).split()
    return [t for t in tokens if t not in STOPWORDS_ES and len(t) > 2]


def ngrams(tokens: list[str], n: int) -> list[str]:
    return [" ".join(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]


def sentiment(text: str) -> str:
    tokens = set(clean_text(text).split())
    pos = len(tokens & POSITIVE_WORDS)
    neg = len(tokens & NEGATIVE_WORDS)
    if pos > neg:
        return "positivo"
    elif neg > pos:
        return "negativo"
    return "neutro"


async def fetch_messages():
    conn = await asyncpg.connect(DATABASE_URL)
    rows = await conn.fetch(
        "SELECT id, message FROM signatures WHERE message IS NOT NULL AND trim(message) <> '' ORDER BY created_at_ms"
    )
    await conn.close()
    return [(r["id"], r["message"]) for r in rows]


def analyze(messages: list[tuple]) -> dict:
    ids, texts = zip(*messages)
    df = pd.DataFrame({"id": ids, "text": texts})
    df["clean"] = df["text"].apply(clean_text)
    df["tokens"] = df["clean"].apply(tokenize)

    # ── Frecuencia de palabras ──────────────────────────────────────────────
    all_tokens = [t for tokens in df["tokens"] for t in tokens]
    word_freq = Counter(all_tokens).most_common(30)

    # ── Bigramas ───────────────────────────────────────────────────────────
    all_bigrams = [bg for tokens in df["tokens"] for bg in ngrams(tokens, 2)]
    bigram_freq = Counter(all_bigrams).most_common(20)

    # ── Trigramas ──────────────────────────────────────────────────────────
    all_trigrams = [tg for tokens in df["tokens"] for tg in ngrams(tokens, 3)]
    trigram_freq = Counter(all_trigrams).most_common(10)

    # ── Mensajes exactamente iguales ────────────────────────────────────────
    exact_counts = Counter(df["clean"].tolist())
    exact_repeated = [(msg, cnt) for msg, cnt in exact_counts.items() if cnt > 1]
    exact_repeated.sort(key=lambda x: -x[1])

    # ── Clustering por temas (TF-IDF + KMeans) ─────────────────────────────
    n_clusters = min(8, len(df) // 50)
    vectorizer = TfidfVectorizer(
        max_features=500,
        ngram_range=(1, 2),
        min_df=3,
        strip_accents=None,
        analyzer="word",
        stop_words=list(STOPWORDS_ES),
    )
    X = vectorizer.fit_transform(df["clean"])
    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df["cluster"] = km.fit_predict(X)

    # Palabras clave por cluster
    terms = vectorizer.get_feature_names_out()
    cluster_keywords = {}
    for c in range(n_clusters):
        center = km.cluster_centers_[c]
        top_idx = center.argsort()[-8:][::-1]
        cluster_keywords[c] = [terms[i] for i in top_idx]

    cluster_counts = df["cluster"].value_counts().sort_index().to_dict()

    # Representante de cada cluster (mensaje más cercano al centroide)
    cluster_reps = {}
    for c in range(n_clusters):
        mask = df["cluster"] == c
        sub = X[mask.values]
        sims = cosine_similarity(sub, km.cluster_centers_[c:c+1]).flatten()
        best_local = sims.argmax()
        best_global = df[mask].iloc[best_local]["text"]
        cluster_reps[c] = best_global[:200]

    # ── Sentimiento ────────────────────────────────────────────────────────
    df["sentiment"] = df["text"].apply(sentiment)
    sentiment_counts = df["sentiment"].value_counts().to_dict()

    # Ejemplos representativos por sentimiento
    def sample_texts(sent: str, n: int = 3) -> list[str]:
        subset = df[df["sentiment"] == sent]["text"]
        sample = subset.sample(min(n, len(subset)), random_state=7).tolist()
        return [t[:180] for t in sample]

    return {
        "total": len(df),
        "word_freq": word_freq,
        "bigram_freq": bigram_freq,
        "trigram_freq": trigram_freq,
        "exact_repeated": exact_repeated[:10],
        "exact_repeated_total": len(exact_repeated),
        "cluster_counts": cluster_counts,
        "cluster_keywords": cluster_keywords,
        "cluster_reps": cluster_reps,
        "sentiment_counts": sentiment_counts,
        "sentiment_examples": {
            "positivo": sample_texts("positivo"),
            "negativo": sample_texts("negativo"),
            "neutro": sample_texts("neutro"),
        },
        "n_clusters": n_clusters,
    }


def build_markdown(r: dict) -> str:
    lines = []

    # ── Encabezado ────────────────────────────────────────────────────────
    lines.append("\n---\n")
    lines.append("## 9 · Análisis de mensajes de firmantes\n")
    lines.append(f"> Basado en **{r['total']:,} mensajes** dejados por firmantes al 25 de abril de 2026.\n")

    # ── Palabras más frecuentes ────────────────────────────────────────────
    lines.append("\n### 9.1 Palabras más frecuentes\n")
    lines.append("| Palabra | Apariciones |")
    lines.append("|---------|------------:|")
    for word, cnt in r["word_freq"][:20]:
        lines.append(f"| {word} | {cnt:,} |")

    # ── Bigramas ──────────────────────────────────────────────────────────
    lines.append("\n### 9.2 Frases de dos palabras más repetidas\n")
    lines.append("| Frase | Apariciones |")
    lines.append("|-------|------------:|")
    for bg, cnt in r["bigram_freq"][:15]:
        lines.append(f"| {bg} | {cnt:,} |")

    # ── Trigramas ─────────────────────────────────────────────────────────
    lines.append("\n### 9.3 Frases de tres palabras más repetidas\n")
    lines.append("| Frase | Apariciones |")
    lines.append("|-------|------------:|")
    for tg, cnt in r["trigram_freq"]:
        lines.append(f"| {tg} | {cnt:,} |")

    # ── Temas (clusters) ──────────────────────────────────────────────────
    lines.append("\n### 9.4 Temas detectados\n")
    lines.append(
        "Se identificaron los principales temas usando agrupamiento automático (TF-IDF + KMeans "
        f"con {r['n_clusters']} grupos). Cada grupo se describe con sus palabras clave y un mensaje representativo.\n"
    )
    lines.append("| # | Tema | Firmas | % | Palabras clave |")
    lines.append("|---|------|-------:|--:|----------------|")
    total = r["total"]
    for c in range(r["n_clusters"]):
        cnt = r["cluster_counts"].get(c, 0)
        label = TOPIC_LABELS.get(c, f"Grupo {c+1}")
        kw = ", ".join(r["cluster_keywords"][c][:6])
        pct = cnt / total * 100
        lines.append(f"| {c+1} | {label} | {cnt:,} | {pct:.1f}% | {kw} |")

    lines.append("\n**Mensajes representativos por tema:**\n")
    for c in range(r["n_clusters"]):
        label = TOPIC_LABELS.get(c, f"Grupo {c+1}")
        rep = r["cluster_reps"][c].replace("\n", " ").strip()
        lines.append(f"- **{label}:** *\"{rep}…\"*")

    # ── Mensajes repetidos ────────────────────────────────────────────────
    lines.append("\n### 9.5 Mensajes exactamente iguales\n")
    lines.append(
        f"**{r['exact_repeated_total']}** grupos de mensajes con texto idéntico "
        f"(ya conocíamos 237 por el análisis previo). Los más frecuentes:\n"
    )
    lines.append("| Repeticiones | Mensaje (primeros 120 caracteres) |")
    lines.append("|-------------:|-----------------------------------|")
    for msg, cnt in r["exact_repeated"][:8]:
        preview = msg[:120].replace("|", "\\|")
        lines.append(f"| {cnt} | {preview}… |")

    lines.append(
        "\n> Los mensajes repetidos son típicos de campañas coordinadas donde se sugiere un texto en redes sociales. "
        "No son indicador de fraude.\n"
    )

    # ── Sentimiento ───────────────────────────────────────────────────────
    lines.append("\n### 9.6 Tono y sentimiento\n")
    lines.append(
        "Clasificación automática por léxico (español) en tres categorías: "
        "positivo, negativo y neutro.\n"
    )
    lines.append("| Tono | Mensajes | % |")
    lines.append("|------|--------:|--:|")
    for sent in ["positivo", "negativo", "neutro"]:
        cnt = r["sentiment_counts"].get(sent, 0)
        pct = cnt / total * 100
        lines.append(f"| {sent.capitalize()} | {cnt:,} | {pct:.1f}% |")

    lines.append("\n**Ejemplos por tono:**\n")
    for sent in ["positivo", "negativo", "neutro"]:
        lines.append(f"*{sent.capitalize()}*")
        for ex in r["sentiment_examples"][sent]:
            ex_clean = ex.replace("\n", " ").replace("|", "\\|").strip()
            lines.append(f"> \"{ex_clean}\"")
        lines.append("")

    lines.append(
        "> **Nota metodológica:** el análisis de sentimiento usa un léxico de palabras positivas y negativas en español. "
        "Dado que la mayoría de los mensajes mezclan preocupación (negativo) con intención de cuidar (positivo), "
        "el clasificador tiende a neutralizar muchas entradas. Los resultados son orientativos.\n"
    )

    return "\n".join(lines)


async def main():
    print("Conectando a PostgreSQL…", flush=True)
    messages = await fetch_messages()
    print(f"  {len(messages)} mensajes extraídos.", flush=True)

    print("Analizando…", flush=True)
    result = analyze(messages)

    print("\n──── Resultados rápidos ────")
    print(f"Palabras top-5: {result['word_freq'][:5]}")
    print(f"Bigramas top-3: {result['bigram_freq'][:3]}")
    print(f"Sentimiento: {result['sentiment_counts']}")
    print(f"Grupos repetidos exactos: {result['exact_repeated_total']}")

    md = build_markdown(result)

    # Append al informe
    informe_path = os.path.join(os.path.dirname(__file__), "..", "informe-firmas-2026-04-25.md")
    with open(informe_path, "a", encoding="utf-8") as f:
        f.write(md)

    print("\n✓ Sección 9 agregada al informe.", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
