"""
Parser de lenguaje natural para transacciones financieras.

Ejemplos que debe entender:
  "almuerzo 15000"          → gasto, comida/comidasFuera, 15000
  "taxi 8.500"              → gasto, transporte/taxiUber, 8500
  "mercado 250.000"         → gasto, comida/mercado, 250000
  "salario 3.500.000"       → ingreso, ingresos/salario, 3500000
  "netflix 45000"           → gasto, familia/suscripciones, 45000
  "gasté 12000 en pizza"    → gasto, comida/comidasFuera, 12000
  "me pagaron 500000"       → ingreso, ingresos/otro, 500000
"""

import re
from categories import KEYWORD_MAP, INGRESO_KEYWORDS


def _parse_monto(text: str) -> float | None:
    """
    Extrae el primer número monetario del texto.
    Soporta:
      - 15000
      - 15.000     (colombiano: punto = separador miles)
      - 1.500.000
      - 15,000
      - 1,500,000
      - 15000.50   (con centavos, raro pero posible)
    """
    # Patrón: número con posibles separadores de miles
    # Primero intenta el formato colombiano (punto como miles, coma como decimal)
    pattern = r'\b(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+)\b'
    matches = re.findall(pattern, text)

    for match in matches:
        raw = match
        # Detectar si el último separador es decimal (< 3 dígitos después)
        # Formato COP: 1.500.000 → todos los puntos son miles
        # Formato con centavos: 15000.50 → punto es decimal
        dot_positions = [i for i, c in enumerate(raw) if c == '.']
        comma_positions = [i for i, c in enumerate(raw) if c == ',']

        cleaned = raw
        if dot_positions and comma_positions:
            # Tiene ambos: ej. 1.500,00 → punto=miles, coma=decimal
            cleaned = raw.replace('.', '').replace(',', '.')
        elif dot_positions:
            # Solo puntos
            after_last_dot = raw[dot_positions[-1] + 1:]
            if len(after_last_dot) == 3:
                # Separador de miles: 1.500 → 1500
                cleaned = raw.replace('.', '')
            else:
                # Decimal: 15000.50 → 15000.50
                cleaned = raw.replace('.', '.')
        elif comma_positions:
            after_last_comma = raw[comma_positions[-1] + 1:]
            if len(after_last_comma) == 3:
                # Miles: 1,500 → 1500
                cleaned = raw.replace(',', '')
            else:
                # Decimal americano: 15000,50
                cleaned = raw.replace(',', '.')

        try:
            value = float(cleaned)
            if value > 0:
                return value
        except ValueError:
            continue

    return None


def _classify(text: str) -> tuple[str, str, str]:
    """
    Retorna (tipo, categoria, subcategoria).
    tipo = 'ingreso' | 'gasto'
    """
    lower = text.lower()

    # Buscar coincidencia por keyword map (orden: frases más largas primero)
    sorted_keywords = sorted(KEYWORD_MAP.keys(), key=len, reverse=True)
    matched_cat = None
    matched_sub = None
    matched_kw = None

    for kw in sorted_keywords:
        if kw in lower:
            matched_cat, matched_sub = KEYWORD_MAP[kw]
            matched_kw = kw
            break

    # Determinar tipo
    tipo = 'gasto'
    if matched_cat == 'ingresos':
        tipo = 'ingreso'
    else:
        # Verificar palabras explícitas de ingreso
        for kw in INGRESO_KEYWORDS:
            if kw in lower:
                tipo = 'ingreso'
                if matched_cat is None:
                    matched_cat = 'ingresos'
                    matched_sub = 'otros'
                break

    # Fallback si no se encontró categoría
    if matched_cat is None:
        matched_cat = 'otro'
        matched_sub = 'otro'

    return tipo, matched_cat, matched_sub


def parse_message(text: str) -> dict | None:
    """
    Parsea un mensaje de texto libre y retorna un dict con:
      {
        'monto': float,
        'tipo': 'ingreso' | 'gasto',
        'categoria': str,
        'subcategoria': str,
        'descripcion': str,  # texto original limpio
      }
    Retorna None si no se puede extraer un monto válido.
    """
    text = text.strip()
    if not text:
        return None

    monto = _parse_monto(text)
    if monto is None or monto < 100:
        return None

    tipo, categoria, subcategoria = _classify(text)

    # Descripción: texto original sin el número
    descripcion = re.sub(r'\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\b', '', text).strip()
    descripcion = re.sub(r'\s+', ' ', descripcion).strip(' .-,')

    return {
        'monto': monto,
        'tipo': tipo,
        'categoria': categoria,
        'subcategoria': subcategoria,
        'descripcion': descripcion or text[:100],
    }
