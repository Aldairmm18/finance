"""
Parser de lenguaje natural para transacciones financieras.

Ejemplos:
  "almuerzo 15000"           → gasto, comida/comidasFuera, 15000
  "taxi 8.500"               → gasto, transporte/taxiUber, 8500
  "mercado 250.000"          → gasto, comida/mercado, 250000
  "salario 3.500.000"        → ingreso, ingresos/salario, 3500000
  "netflix 45000"            → gasto, familia/suscripciones, 45000
  "extra multa 200000"       → gasto, otro/extraordinario, 200000, es_extraordinario=True
  "imprevisto celular 1500000" → gasto, otro/extraordinario, 1500000, es_extraordinario=True
"""

import re
from categories import KEYWORD_MAP, INGRESO_KEYWORDS

# Palabras que marcan el gasto como extraordinario/imprevisto
EXTRA_KEYWORDS = {
    'extra', 'imprevisto', 'extraordinario', 'emergencia',
    'urgencia', 'inesperado', 'urgente', 'accidente',
}


def _parse_monto(text: str) -> float | None:
    """
    Extrae el primer número monetario del texto.
    Soporta formatos colombianos:
      15000 · 15.000 · 1.500.000 · 15,000 · 1,500,000
    """
    pattern = r'\b(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+)\b'
    matches = re.findall(pattern, text)

    for raw in matches:
        dot_pos   = [i for i, c in enumerate(raw) if c == '.']
        comma_pos = [i for i, c in enumerate(raw) if c == ',']
        cleaned = raw

        if dot_pos and comma_pos:
            # 1.500,00 → punto=miles, coma=decimal
            cleaned = raw.replace('.', '').replace(',', '.')
        elif dot_pos:
            after = raw[dot_pos[-1] + 1:]
            cleaned = raw.replace('.', '') if len(after) == 3 else raw
        elif comma_pos:
            after = raw[comma_pos[-1] + 1:]
            cleaned = raw.replace(',', '') if len(after) == 3 else raw.replace(',', '.')

        try:
            v = float(cleaned)
            if v >= 100:
                return v
        except ValueError:
            continue

    return None


def _classify(lower: str) -> tuple[str, str]:
    """Retorna (categoria, subcategoria) buscando en el mapa de keywords."""
    for kw in sorted(KEYWORD_MAP.keys(), key=len, reverse=True):
        if len(kw) <= 3:
            # Palabras cortas: usar word boundary para evitar falsos positivos
            # (ej. "ia" no debe coincidir con "familia", "bus" no con "autobús")
            if re.search(r'\b' + re.escape(kw) + r'\b', lower):
                return KEYWORD_MAP[kw]
        else:
            if kw in lower:
                return KEYWORD_MAP[kw]
    return ('otro', 'otro')


def parse_message(text: str) -> dict | None:
    """
    Parsea un mensaje de texto libre.
    Retorna dict con monto, tipo, categoria, subcategoria, descripcion, es_extraordinario.
    Retorna None si no se puede extraer un monto válido.
    """
    text = text.strip()
    if not text:
        return None

    lower = text.lower()
    monto = _parse_monto(text)
    if monto is None:
        return None

    es_extraordinario = any(kw in lower for kw in EXTRA_KEYWORDS)
    categoria, subcategoria = _classify(lower)

    # Determinar tipo
    tipo = 'gasto'
    if categoria == 'ingresos':
        tipo = 'ingreso'
    else:
        for kw in INGRESO_KEYWORDS:
            if kw in lower:
                tipo = 'ingreso'
                if categoria == 'otro':
                    categoria, subcategoria = 'ingresos', 'otros'
                break

    # Si es extraordinario y no se clasificó, usar categoría genérica
    if es_extraordinario and categoria == 'otro':
        subcategoria = 'extraordinario'

    # Descripción: texto original sin el número
    desc = re.sub(r'\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\b', '', text)
    desc = re.sub(r'\s+', ' ', desc).strip(' .-,')

    return {
        'monto':            monto,
        'tipo':             tipo,
        'categoria':        categoria,
        'subcategoria':     subcategoria,
        'descripcion':      desc or text[:100],
        'es_extraordinario': es_extraordinario,
    }
