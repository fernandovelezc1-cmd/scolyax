"""
Iris Agent — function-calling sobre Gemini (google-genai).

Iris deja de ser un asistente de solo-texto: ahora razona y DECIDE qué
herramientas usar (crear tareas, crear recordatorios, recomendar herramienta,
armar un plan de estudio). El modelo elige la(s) función(es); el backend
devuelve esas acciones al frontend, que las ejecuta con sus handlers ya
existentes (mismo flujo que crear una tarea a mano). Así el agente actúa de
verdad sin duplicar autenticación ni estado.
"""
from __future__ import annotations

import os
import logging
import datetime as _dt
from typing import Any, Dict, List, Optional

try:
    import google.genai as genai
    from google.genai import types
    _GENAI_OK = True
except ImportError:  # pragma: no cover
    _GENAI_OK = False

from .notebooklm_tasks import IRIS_SYSTEM_PROMPT

_MODEL = "gemini-2.5-flash"

_AGENT_DIRECTIVE = """
Eres Iris operando en MODO AGENTE dentro de Scolyax. Además de responder, puedes
EJECUTAR acciones llamando a las funciones disponibles:
- create_task: cuando el usuario quiere registrar/crear una tarea o pendiente.
- create_reminder: cuando quiere que le recuerden algo en una fecha/hora.
- recommend_tool: cuando conviene sugerir y abrir una herramienta de Scolyax.

Reglas de agente:
- Si la intención del usuario implica una acción, LLAMA a la función adecuada con
  los mejores argumentos que puedas inferir (no pidas datos que puedes deducir).
- Puedes llamar varias funciones si el usuario pide varias cosas.
- Si solo es una pregunta de conocimiento, responde con texto, sin funciones.
- Las fechas relativas ("mañana", "el viernes") conviértelas a fecha real usando
  la fecha actual que se te indica.
"""


def is_available() -> bool:
    return _GENAI_OK and bool(os.getenv("NOTEBOOKLM_API_KEY"))


def _client():
    if not is_available():
        return None
    try:
        return genai.Client(api_key=os.getenv("NOTEBOOKLM_API_KEY"))
    except Exception as e:  # pragma: no cover
        logging.warning(f"⚠️ Iris agent client error: {e}")
        return None


def _S(t, desc):
    return types.Schema(type=t, description=desc)


def _tools():
    T = types.Type
    return [types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="create_task",
            description="Crea una tarea académica / pendiente para el estudiante.",
            parameters=types.Schema(
                type=T.OBJECT,
                properties={
                    "title": _S(T.STRING, "Título claro y accionable de la tarea."),
                    "course": _S(T.STRING, "Asignatura o materia, si se menciona."),
                    "due_date": _S(T.STRING, "Fecha/hora límite en ISO 8601 (YYYY-MM-DDTHH:MM) si aplica."),
                    "notes": _S(T.STRING, "Notas o detalles opcionales."),
                },
                required=["title"],
            ),
        ),
        types.FunctionDeclaration(
            name="create_reminder",
            description="Crea un recordatorio con aviso en una fecha y hora concretas.",
            parameters=types.Schema(
                type=T.OBJECT,
                properties={
                    "title": _S(T.STRING, "Qué se debe recordar."),
                    "remind_at": _S(T.STRING, "Fecha y hora del aviso en ISO 8601 (YYYY-MM-DDTHH:MM)."),
                    "type": _S(T.STRING, "Tipo: task, focus o personal."),
                    "description": _S(T.STRING, "Detalle opcional."),
                },
                required=["title", "remind_at"],
            ),
        ),
        types.FunctionDeclaration(
            name="recommend_tool",
            description="Recomienda y abre una herramienta de Scolyax.",
            parameters=types.Schema(
                type=T.OBJECT,
                properties={
                    "tool_id": _S(T.STRING, "Una de: home, tasks, calendar, reminders, summary, timer, achievements, crisis."),
                    "reason": _S(T.STRING, "Por qué le conviene ahora (1 frase)."),
                },
                required=["tool_id"],
            ),
        ),
    ])]


def _fc_to_action(fc) -> Optional[Dict[str, Any]]:
    try:
        args = dict(fc.args) if fc.args else {}
    except Exception:
        args = {}
    name = getattr(fc, "name", None)
    if not name:
        return None
    return {"type": name, "args": args}


def run_agent(message: str, history: Optional[List[Dict[str, str]]] = None,
              context: str = "") -> Dict[str, Any]:
    """
    Ejecuta un turno del agente Iris.

    Returns: { "reply": str, "actions": [ {type, args}, ... ], "source": str }
    """
    client = _client()
    if client is None:
        return {"reply": "", "actions": [], "source": "unavailable"}

    today = _dt.date.today().isoformat()
    nl = "\n"
    convo = ""
    for m in (history or [])[-6:]:
        role = "Usuario" if m.get("role") == "user" else "Iris"
        convo += role + ": " + str(m.get("content", "")) + nl

    parts = ["Fecha actual: " + today + "."]
    if context:
        parts.append("Contexto del estudiante: " + context)
    if convo:
        parts.append("Conversación reciente:" + nl + convo)
    parts.append("Mensaje del usuario: " + message)
    user_block = nl.join(parts)

    system = f"{IRIS_SYSTEM_PROMPT}\n\n{_AGENT_DIRECTIVE}"

    actions: List[Dict[str, Any]] = []
    try:
        resp = client.models.generate_content(
            model=_MODEL,
            contents=user_block,
            config=types.GenerateContentConfig(
                system_instruction=system,
                tools=_tools(),
                temperature=0.4,
                max_output_tokens=1200,
            ),
        )

        fcs = getattr(resp, "function_calls", None) or []
        for fc in fcs:
            act = _fc_to_action(fc)
            if act:
                actions.append(act)

        if actions:
            # Iris confirma en su voz lo que acaba de ejecutar.
            def _fmt(a):
                kv = ", ".join(str(k) + "=" + str(v) for k, v in a["args"].items())
                return a["type"] + "(" + kv + ")"
            done = "; ".join(_fmt(a) for a in actions)
            confirm = client.models.generate_content(
                model=_MODEL,
                contents=(
                    f"El usuario te pidió: \"{message}\".\n"
                    f"Acabas de ejecutar estas acciones en Scolyax: {done}.\n"
                    "Confírmalo en tu voz (1-3 frases, español), de forma cálida y clara, "
                    "y sugiere el siguiente paso. No uses funciones aquí."
                ),
                config=types.GenerateContentConfig(
                    system_instruction=IRIS_SYSTEM_PROMPT,
                    temperature=0.5,
                    max_output_tokens=400,
                ),
            )
            reply = (getattr(confirm, "text", "") or "").strip() or "Listo, lo dejé organizado para ti. ✅"
        else:
            reply = (getattr(resp, "text", "") or "").strip()

        return {"reply": reply, "actions": actions, "source": "agent"}

    except Exception as e:
        logging.error(f"❌ Iris agent error: {e}")
        return {"reply": "", "actions": [], "source": "error", "error": str(e)}
