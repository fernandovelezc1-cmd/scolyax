"""Ejecuta un resumen rápido usando el motor interno sin depender de FastAPI."""

from textwrap import fill

from app.summarizer import extract_keywords, summarize_text


DEMO_TEXT = (
    "Scolyax es una plataforma de productividad académica creada para estudiantes "
    "universitarios, con especial cariño para quienes viven con TDAH, autismo u otras "
    "neurodivergencias. Combina un panel de métricas amables, listas guiadas de tareas, "
    "recordatorios con lenguaje cercano y un asistente de resúmenes con lectura en voz "
    "alta. El objetivo es reducir la sobrecarga cognitiva, ofrecer pasos pequeños y "
    "claros y celebrar cada progreso sin abrumar."
)


def main() -> None:
    """Muestra por consola un resumen y palabras clave de ejemplo."""
    summary_sentences = summarize_text(DEMO_TEXT, sentences=3)
    keywords = extract_keywords(DEMO_TEXT, limit=6)

    print("Resumen sugerido:\n")
    for index, sentence in enumerate(summary_sentences, start=1):
        print(f"{index}. {fill(sentence, width=88)}\n")

    print("Palabras clave relevantes:")
    print(", ".join(keywords) if keywords else "No se detectaron palabras clave.")


if __name__ == "__main__":
    main()
