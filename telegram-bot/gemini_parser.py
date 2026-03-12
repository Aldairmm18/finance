import json
import logging
import os
import re
from typing import Any, Literal

from google import genai
from pydantic import BaseModel, Field

from categories import CATEGORY_LABELS, SUBCATEGORY_LABELS, KEYWORD_MAP, INGRESO_KEYWORDS, INGRESO_CATEGORIES
from finance_parser import parse_message as regex_parse_message


ALLOWED_CATEGORIES = sorted(set(CATEGORY_LABELS.keys()))
ALLOWED_SUBCATEGORIES = sorted(set(SUBCATEGORY_LABELS.keys()))

logger = logging.getLogger(__name__)

class GeminiTransaction(BaseModel):
    monto: float = Field(..., description="Monto numérico de la transacción.")
    tipo: Literal["gasto", "ingreso"] = Field(..., description="Tipo de transacción.")
    categoria: str = Field(..., description="Categoría (ej: comida, transporte, otros).")
    descripcion: str = Field(..., description="Descripción breve de la transacción.")
    es_extraordinario: bool = Field(..., description="Si es un gasto extraordinario.")

SYSTEM_PROMPT = (
    "Eres un asistente financiero experto. Tu tarea es extraer datos y devolver SOLO JSON válido.\n"
    "Campos obligatorios: monto (número), tipo (\"gasto\" o \"ingreso\"), "
    "categoria (string), descripcion (string), es_extraordinario (booleano).\n\n"
    "Reglas de inferencia:\n"
    "- Si el usuario no especifica la categoría, INFIÉRELA por contexto "
    "(ej: \"empanada\" -> \"comida\", \"uber\" -> \"transporte\").\n"
    "- Si no puedes inferirla, usa \"otros\".\n"
    "- Si el usuario no dice si es extraordinario, asume false.\n"
    "- Tu objetivo es NUNCA dejar campos vacíos y NUNCA pedir aclaraciones, "
    "a menos que el monto no exista.\n"
    "- No incluyas texto adicional, solo JSON."
)


class GeminiParseError(Exception):
    def __init__(self, message: str, response_text: str):
        super().__init__(message)
        self.response_text = response_text


def _client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("Falta GEMINI_API_KEY en el entorno")
    return genai.Client(api_key=api_key)

def _classify_from_text(lower: str) -> tuple[str, str]:
    for kw in sorted(KEYWORD_MAP.keys(), key=len, reverse=True):
        if len(kw) <= 3:
            if re.search(r'\\b' + re.escape(kw) + r'\\b', lower):
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


def _validate_payload(payload: dict, text: str) -> dict | None:
    monto = _coerce_number(payload.get("monto"))
    tipo = _normalize_text(payload.get("tipo"))
    categoria = _normalize_text(payload.get("categoria"))
    descripcion = _normalize_text(payload.get("descripcion"))
    es_extraordinario = _coerce_bool(payload.get("es_extraordinario"))

    lower = (text or "").lower()
    categoria = (categoria or "").lower()
    descripcion = descripcion or "Sin descripción"
    es_extraordinario = es_extraordinario if es_extraordinario is not None else False

    if not categoria or categoria not in ALLOWED_CATEGORIES:
        cat_infer, sub_infer = _classify_from_text(lower)
        categoria = cat_infer if cat_infer in ALLOWED_CATEGORIES else "otros"
    else:
        sub_infer = _classify_from_text(lower)[1]

    tipo = (tipo or _infer_tipo(lower, categoria)).lower()
    if tipo not in {"gasto", "ingreso"}:
        tipo = _infer_tipo(lower, categoria)
    if monto is None or monto <= 0:
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
    text = (text or "").strip()
    if not text:
        return None

    client = _client()
    prompt = f"{SYSTEM_PROMPT}\n\nMensaje del usuario: {text}"
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=GeminiTransaction.model_json_schema(),
            temperature=0.2,
        ),
    )
    raw = getattr(response, "text", "") or ""
    if not raw:
        raise GeminiParseError("Respuesta vacía", raw)

    try:
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        if "{" in cleaned and "}" in cleaned:
            cleaned = cleaned[cleaned.find("{"): cleaned.rfind("}") + 1]
        payload = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error("Error parseando Gemini: %s. Raw response: %s", e, raw)
        fallback = regex_parse_message(text)
        if fallback:
            return fallback
        raise GeminiParseError(f"JSON inválido: {e}", raw) from e

    if not isinstance(payload, dict):
        logger.error("Error parseando Gemini: %s. Raw response: %s", "Respuesta no es JSON objeto", raw)
        fallback = regex_parse_message(text)
        if fallback:
            return fallback
        raise GeminiParseError("Respuesta no es un objeto JSON", raw)

    return _validate_payload(payload, text)
