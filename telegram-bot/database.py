"""
Capa de acceso a Supabase para el bot de Telegram.
Todas las fechas se manejan en zona horaria Colombia (UTC-5).
Todas las queries incluyen datos de cualquier fuente (app + bot).
Soporta multi-usuario via tabla telegram_users.
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


def _coerce_date(value: date | datetime | None) -> date:
    if value is None:
        return _today_co()
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=COLOMBIA_TZ)
        return value.astimezone(COLOMBIA_TZ).date()
    return value


# ─── Multi-usuario ────────────────────────────────────────────────────────────

def vincular_telegram(chat_id: int, email: str, password: str) -> str:
    """
    Vincula un chat_id de Telegram con una cuenta de la app.
    Autentica con email/password via Supabase Auth y guarda el mapping.
    Retorna el user_id vinculado.
    """
    # Autenticar via Supabase Auth
    auth_response = supabase.auth.sign_in_with_password({
        'email': email,
        'password': password,
    })
    user = auth_response.user
    if not user:
        raise RuntimeError('No se pudo autenticar. Verifica tu email y contraseña.')

    user_id = user.id

    # Guardar o actualizar el mapping chat_id → user_id
    supabase.table('telegram_users').upsert(
        {
            'chat_id': chat_id,
            'user_id': user_id,
            'linked_at': _now_co().isoformat(),
        },
        on_conflict='chat_id',
    ).execute()

    # Cerrar la sesión del bot (no necesita mantenerla)
    try:
        supabase.auth.sign_out()
    except Exception:
        pass

    return user_id


def desvincular_telegram(chat_id: int) -> bool:
    """Desvincula un chat_id. Retorna True si había un registro."""
    result = (
        supabase.table('telegram_users')
        .delete()
        .eq('chat_id', chat_id)
        .execute()
    )
    return bool(result.data)


def get_user_id(chat_id: int) -> str | None:
    """Retorna el user_id vinculado a un chat_id, o None si no está vinculado."""
    result = (
        supabase.table('telegram_users')
        .select('user_id')
        .eq('chat_id', chat_id)
        .maybe_single()
        .execute()
    )
    if result.data:
        return result.data['user_id']
    return None


# ─── Escritura ─────────────────────────────────────────────────────────────────

def registrar_transaccion(
    user_id: str,
    tipo: str,
    monto: float,
    categoria: str,
    subcategoria: str,
    descripcion: str,
    fecha: date | None = None,
    es_extraordinario: bool = False,
) -> dict:
    fecha_co = _coerce_date(fecha)
    row = {
        'user_id':           user_id,
        'tipo':              tipo,
        'monto':             monto,
        'categoria':         categoria,
        'subcategoria':      subcategoria,
        'descripcion':       descripcion,
        'fecha':             str(fecha_co),
        'fuente':            'telegram_bot',
        'es_extraordinario': es_extraordinario,
    }
    result = supabase.table('transacciones').insert(row).execute()
    if not result.data:
        raise RuntimeError('Supabase no retorno datos al insertar')
    return result.data[0]


def borrar_ultima_transaccion(user_id: str) -> dict | None:
    result = (
        supabase.table('transacciones')
        .select('*')
        .eq('user_id', user_id)
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

def _fetch_transacciones(user_id: str, desde: date | datetime, hasta: date | datetime) -> list[dict]:
    desde_co = _coerce_date(desde)
    hasta_co = _coerce_date(hasta)
    result = (
        supabase.table('transacciones')
        .select('*')
        .eq('user_id', user_id)
        .gte('fecha', str(desde_co))
        .lte('fecha', str(hasta_co))
        .order('fecha', desc=True)
        .order('created_at', desc=True)
        .execute()
    )
    return result.data or []


def obtener_resumen_hoy(user_id: str) -> dict:
    hoy = _today_co()
    return _calcular_resumen(_fetch_transacciones(user_id, hoy, hoy), 'hoy')


def obtener_resumen_semana(user_id: str) -> dict:
    hoy = _today_co()
    inicio = hoy - timedelta(days=hoy.weekday())
    return _calcular_resumen(_fetch_transacciones(user_id, inicio, hoy), 'esta semana')


def obtener_resumen_mes(user_id: str) -> dict:
    hoy = _today_co()
    inicio = hoy.replace(day=1)
    return _calcular_resumen(_fetch_transacciones(user_id, inicio, hoy), 'este mes')


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


def obtener_gastos_por_categoria(user_id: str, mes: date | datetime | None = None) -> list[dict]:
    hoy = _today_co()
    mes_co = _coerce_date(mes) if mes is not None else hoy
    inicio = mes_co.replace(day=1)
    fin    = hoy if mes is None or mes.month == hoy.month else \
             (inicio.replace(month=inicio.month % 12 + 1, day=1) - timedelta(days=1))
    filas  = _fetch_transacciones(user_id, inicio, fin)
    gastos = [f for f in filas if f['tipo'] == 'gasto']
    agrupado: dict[str, float] = {}
    for f in gastos:
        cat = f.get('categoria', 'otro')
        agrupado[cat] = agrupado.get(cat, 0) + f['monto']
    return sorted(
        [{'categoria': k, 'total': v} for k, v in agrupado.items()],
        key=lambda x: x['total'], reverse=True,
    )


def obtener_ultimas_transacciones(user_id: str, n: int = 5) -> list[dict]:
    result = (
        supabase.table('transacciones')
        .select('*')
        .eq('user_id', user_id)
        .order('fecha', desc=True)
        .order('created_at', desc=True)
        .limit(max(1, min(n, 20)))
        .execute()
    )
    return result.data or []


def obtener_extraordinarios_mes(user_id: str) -> list[dict]:
    hoy = _today_co()
    inicio = hoy.replace(day=1)
    result = (
        supabase.table('transacciones')
        .select('*')
        .eq('user_id', user_id)
        .eq('es_extraordinario', True)
        .gte('fecha', str(inicio))
        .lte('fecha', str(hoy))
        .order('fecha', desc=True)
        .execute()
    )
    return result.data or []
