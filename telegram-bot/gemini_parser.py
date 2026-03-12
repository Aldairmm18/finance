import json
import os
from typing import Any

from google import genai

from categories import CATEGORY_LABELS, SUBCATEGORY_LABELS


ALLOWED_CATEGORIES = sorted(set(CATEGORY_LABELS.keys()))
ALLOWED_SUBCATEGORIES = sorted(set(SUBCATEGORY_LABELS.keys()))

SYSTEM_PROMPT = (
    "Eres un parser financiero estricto. Lee el mensaje del usuario y devuelve SOLO JSON valido "
    "con esta estructura exacta:\n"
    "{\"monto\": numero|null, \"tipo\": \"gasto\"|\"ingreso\"|null, "
    "\"categoria\": \"string\"|null, \"subcategoria\": \"string\"|null, "
    "\"descripcion\": \"string\"|null, \"es_extraordinario\": booleano|null}\n\n"
    "Reglas:\n"
    "- Usa unicamente categorias y subcategorias existentes.\n"
    f"- Categorias validas: {', '.join(ALLOWED_CATEGORIES)}\n"
    f"- Subcategorias validas: {', '.join(ALLOWED_SUBCATEGORIES)}\n"
    "- Si falta informacion (monto, tipo o categoria), devuelve null en ese campo.\n"
    "- descripcion debe ser breve y humana si es posible (ej: \"Metro\", \"Salario\", \"Mercado\").\n"
    "- es_extraordinario es true si el mensaje indica gasto imprevisto o extra.\n"
    "- No incluyas texto adicional, solo JSON."
)


def _client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("Falta GEMINI_API_KEY en el entorno")
    return genai.Client(api_key=api_key)


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


def _validate_payload(payload: dict) -> dict | None:
    monto = _coerce_number(payload.get("monto"))
    tipo = _normalize_text(payload.get("tipo"))
    categoria = _normalize_text(payload.get("categoria"))
    subcategoria = _normalize_text(payload.get("subcategoria"))
    descripcion = _normalize_text(payload.get("descripcion"))
    es_extraordinario = _coerce_bool(payload.get("es_extraordinario"))

    if tipo:
        tipo = tipo.lower()
    if categoria:
        categoria = categoria.lower()
    if subcategoria:
        subcategoria = subcategoria.lower()

    if tipo not in {"gasto", "ingreso"}:
        return None
    if not categoria or categoria not in ALLOWED_CATEGORIES:
        return None
    if not subcategoria or subcategoria not in ALLOWED_SUBCATEGORIES:
        return None
    if monto is None or monto <= 0:
        return None
    if es_extraordinario is None:
        return None

    return {
        "monto": monto,
        "tipo": tipo,
        "categoria": categoria,
        "subcategoria": subcategoria,
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
            temperature=0.2,
        ),
    )
    raw = getattr(response, "text", "") or ""
    if not raw:
        return None

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, dict):
        return None

    return _validate_payload(payload)
