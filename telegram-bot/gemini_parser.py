"""
Parser de transacciones financieras usando Groq (llama-3.3-70b-versatile).
Mantiene los mismos nombres públicos (parse_message_gemini, GeminiParseError)
para no requerir cambios en bot.py.
"""

import json
import logging
import os
import re
from typing import Any, Literal

from groq import Groq
from pydantic import BaseModel, Field

from categories import CATEGORY_LABELS, SUBCATEGORY_LABELS, KEYWORD_MAP, INGRESO_KEYWORDS, INGRESO_CATEGORIES


MASTER_CATEGORIES = [
    "Alimentación",
    "Transporte",
    "Servicios",
    "Ocio",
    "Salud",
    "Educación",
    "Otros",
]

MASTER_CATEGORY_LOOKUP = {c.lower(): c for c in MASTER_CATEGORIES}

LEGACY_TO_MASTER = {
    "comida": "Alimentación",
    "alimentacion": "Alimentación",
    "alimentación": "Alimentación",
    "transporte": "Transporte",
    "hogar": "Servicios",
    "servicios": "Servicios",
    "creditos": "Servicios",
    "créditos": "Servicios",
    "entretenimiento": "Ocio",
    "ocio": "Ocio",
    "salud": "Salud",
    "educacion": "Educación",
    "educación": "Educación",
    "familia": "Otros",
    "salario": "Otros",
    "bonos": "Otros",
    "comisiones": "Otros",
    "dividendos": "Otros",
    "ahorro": "Otros",
    "ingresos": "Otros",
    "otros": "Otros",
    "otro": "Otros",
}

ALLOWED_CATEGORIES = MASTER_CATEGORIES
ALLOWED_SUBCATEGORIES = sorted(set(SUBCATEGORY_LABELS.keys()))

logger = logging.getLogger(__name__)


class GroqTransaction(BaseModel):
    monto: float = Field(..., description="Monto numérico de la transacción.")
    tipo: Literal["gasto", "ingreso"] = Field(..., description="Tipo de transacción.")
    categoria: Literal["Alimentación", "Transporte", "Servicios", "Ocio", "Salud", "Educación", "Otros"] = Field(
        ..., description="Categoría permitida."
    )
    descripcion: str = Field(..., description="Descripción breve de la transacción.")
    es_extraordinario: bool = Field(..., description="Si es un gasto extraordinario.")


SYSTEM_PROMPT = (
    "Eres un asistente financiero experto. Tu tarea es extraer datos y devolver SOLO JSON válido.\n"
    "Campos obligatorios: monto (número), tipo (\"gasto\" o \"ingreso\"), "
    "categoria (string; SOLO una de: Alimentación, Transporte, Servicios, Ocio, Salud, Educación, Otros), "
    "descripcion (string), es_extraordinario (booleano).\n\n"
    "Reglas de inferencia:\n"
    "- Categorías permitidas (usa exactamente una): Alimentación, Transporte, Servicios, Ocio, Salud, Educación, Otros.\n"
    "- Si el usuario no especifica la categoría, INFIÉRELA por contexto "
    "(ej: \"empanada\" -> \"Alimentación\", \"uber\" -> \"Transporte\").\n"
    "- NO inventes categorías nuevas. Si no encaja en ninguna, usa \"Otros\".\n"
    "- Si el usuario no dice si es extraordinario, asume false.\n"
    "- Tu objetivo es NUNCA dejar campos vacíos y NUNCA pedir aclaraciones, "
    "a menos que el monto no exista.\n"
    "- No incluyas texto adicional, solo JSON."
)


class GeminiParseError(Exception):
    """Alias mantenido por compatibilidad con bot.py."""
    def __init__(self, message: str, response_text: str):
        super().__init__(message)
        self.response_text = response_text


def _client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("Falta GROQ_API_KEY en el entorno")
    return Groq(api_key=api_key)


def _classify_from_text(lower: str) -> tuple[str, str]:
    for kw in sorted(KEYWORD_MAP.keys(), key=len, reverse=True):
        if len(kw) <= 3:
            if re.search(r'\b' + re.escape(kw) + r'\b', lower):
                return KEYWORD_MAP[kw]
        else:
            if kw in lower:
                return KEYWORD_MAP[kw]
    return ('otros', 'otros')


def _infer_tipo(lower: str, categoria: str) -> str:
    if categoria in INGRESO_CATEGORIES:
        return 'ingreso'
    for kw in INGRESO_KEYWORDS:
        if kw in lower:
            return 'ingreso'
    return 'gasto'


def _coerce_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"true", "si", "sí"}:
            return True
        if v in {"false", "no"}:
            return False
    return None


def _coerce_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace(".", "").replace(",", ".")
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text if text else None
    return None


def _map_to_master(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        v = value.strip().lower()
    else:
        v = str(value).strip().lower()
    if not v:
        return None
    if v in MASTER_CATEGORY_LOOKUP:
        return MASTER_CATEGORY_LOOKUP[v]
    return LEGACY_TO_MASTER.get(v)


def _validate_payload(payload: dict, text: str) -> dict | None:
    monto = _coerce_number(payload.get("monto"))
    tipo = _normalize_text(payload.get("tipo"))
    categoria = _map_to_master(payload.get("categoria"))
    descripcion = _normalize_text(payload.get("descripcion"))
    es_extraordinario = _coerce_bool(payload.get("es_extraordinario"))

    lower = (text or "").lower()
    descripcion = descripcion or "Sin descripción"
    es_extraordinario = es_extraordinario if es_extraordinario is not None else False

    if not categoria or categoria not in ALLOWED_CATEGORIES:
        cat_infer, sub_infer = _classify_from_text(lower)
        categoria = _map_to_master(cat_infer) or "Otros"
    else:
        sub_infer = _classify_from_text(lower)[1]

    tipo = (tipo or _infer_tipo(lower, categoria)).lower()
    if tipo not in {"gasto", "ingreso"}:
        tipo = _infer_tipo(lower, categoria)

    MAX_MONTO = 100_000_000  # 100 millones COP
    if monto is None or monto <= 0:
        return None
    if monto > MAX_MONTO:
        return None

    if sub_infer not in ALLOWED_SUBCATEGORIES:
        sub_infer = "otros"

    return {
        "monto": monto,
        "tipo": tipo,
        "categoria": categoria,
        "subcategoria": sub_infer,
        "descripcion": descripcion or categoria,
        "es_extraordinario": es_extraordinario,
    }


def parse_message_gemini(text: str) -> dict | None:
    """
    Parsea un mensaje de texto libre usando Groq (llama-3.3-70b-versatile).
    Nombre mantenido por compatibilidad con bot.py.
    """
    text = (text or "").strip()
    if not text:
        return None

    client = _client()
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Mensaje del usuario: {text}"},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=256,
    )

    raw = response.choices[0].message.content or ""
    if not raw:
        raise GeminiParseError("Respuesta vacía de Groq", raw)

    try:
        cleaned = raw.strip()
        if "{" in cleaned and "}" in cleaned:
            cleaned = cleaned[cleaned.find("{"): cleaned.rfind("}") + 1]
        payload = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error("Error parseando Groq: %s. Raw: %s", e, raw)
        raise GeminiParseError(f"JSON inválido: {e}", raw) from e

    if not isinstance(payload, dict):
        raise GeminiParseError("Respuesta no es un objeto JSON", raw)

    return _validate_payload(payload, text)
