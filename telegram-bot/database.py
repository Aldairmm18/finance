"""
Capa de acceso a Supabase para el bot de Telegram.
Todas las fechas se manejan en zona horaria Colombia (UTC-5).
Todas las queries incluyen datos de cualquier fuente (app + bot).
"""

import os
from datetime import datetime, date, timedelta, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

COLOMBIA_TZ = timezone(timedelta(hours=-5))

_url = os.getenv('SUPABASE_URL', '')
_key = os.getenv('SUPABASE_KEY', '')

if not _url or not _key:
    raise RuntimeError('Faltan SUPABASE_URL o SUPABASE_KEY en el .env')

supabase: Client = create_client(_url, _key)


def _now_co() -> datetime:
    return datetime.now(COLOMBIA_TZ)


def _today_co() -> date:
    return _now_co().date()


# ─── Escritura ─────────────────────────────────────────────────────────────────

def registrar_transaccion(
    tipo: str,
    monto: float,
    categoria: str,
    subcategoria: str,
    descripcion: str,
    fecha: date | None = None,
    es_extraordinario: bool = False,
) -> dict:
    row = {
        'user_id':           'default',
        'tipo':              tipo,
        'monto':             monto,
        'categoria':         categoria,
        'subcategoria':      subcategoria,
        'descripcion':       descripcion,
        'fecha':             str(fecha or _today_co()),
        'fuente':            'telegram_bot',
        'es_extraordinario': es_extraordinario,
    }
    result = supabase.table('transacciones').insert(row).execute()
    if not result.data:
        raise RuntimeError('Supabase no retorno datos al insertar')
    return result.data[0]


def borrar_ultima_transaccion() -> dict | None:
    result = (
        supabase.table('transacciones')
        .select('*')
        .eq('user_id', 'default')
        .eq('fuente', 'telegram_bot')
        .order('created_at', desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    row = result.data[0]
    supabase.table('transacciones').delete().eq('id', row['id']).execute()
    return row


# ─── Lectura (incluye todas las fuentes: app + bot) ───────────────────────────

def _fetch_transacciones(desde: date, hasta: date) -> list[dict]:
    result = (
        supabase.table('transacciones')
        .select('*')
        .eq('user_id', 'default')
        .gte('fecha', str(desde))
        .lte('fecha', str(hasta))
        .order('fecha', desc=True)
        .order('created_at', desc=True)
        .execute()
    )
    return result.data or []


def obtener_resumen_hoy() -> dict:
    hoy = _today_co()
    return _calcular_resumen(_fetch_transacciones(hoy, hoy), 'hoy')


def obtener_resumen_semana() -> dict:
    hoy = _today_co()
    inicio = hoy - timedelta(days=hoy.weekday())
    return _calcular_resumen(_fetch_transacciones(inicio, hoy), 'esta semana')


def obtener_resumen_mes() -> dict:
    hoy = _today_co()
    inicio = hoy.replace(day=1)
    return _calcular_resumen(_fetch_transacciones(inicio, hoy), 'este mes')


def _calcular_resumen(filas: list[dict], periodo: str) -> dict:
    ingresos = sum(f['monto'] for f in filas if f['tipo'] == 'ingreso')
    gastos   = sum(f['monto'] for f in filas if f['tipo'] == 'gasto')
    extras   = [f for f in filas if f.get('es_extraordinario')]
    return {
        'periodo':         periodo,
        'ingresos':        ingresos,
        'gastos':          gastos,
        'balance':         ingresos - gastos,
        'n_filas':         len(filas),
        'extraordinarios': extras,
        'filas':           filas,
    }


def obtener_gastos_por_categoria(mes: date | None = None) -> list[dict]:
    hoy = _today_co()
    inicio = (mes or hoy).replace(day=1)
    fin    = hoy if mes is None or mes.month == hoy.month else \
             (inicio.replace(month=inicio.month % 12 + 1, day=1) - timedelta(days=1))
    filas  = _fetch_transacciones(inicio, fin)
    gastos = [f for f in filas if f['tipo'] == 'gasto']
    agrupado: dict[str, float] = {}
    for f in gastos:
        cat = f.get('categoria', 'otro')
        agrupado[cat] = agrupado.get(cat, 0) + f['monto']
    return sorted(
        [{'categoria': k, 'total': v} for k, v in agrupado.items()],
        key=lambda x: x['total'], reverse=True,
    )


def obtener_ultimas_transacciones(n: int = 5) -> list[dict]:
    result = (
        supabase.table('transacciones')
        .select('*')
        .eq('user_id', 'default')
        .order('fecha', desc=True)
        .order('created_at', desc=True)
        .limit(max(1, min(n, 20)))
        .execute()
    )
    return result.data or []


def obtener_extraordinarios_mes() -> list[dict]:
    hoy = _today_co()
    inicio = hoy.replace(day=1)
    result = (
        supabase.table('transacciones')
        .select('*')
        .eq('user_id', 'default')
        .eq('es_extraordinario', True)
        .gte('fecha', str(inicio))
        .lte('fecha', str(hoy))
        .order('fecha', desc=True)
        .execute()
    )
    return result.data or []
