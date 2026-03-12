"""
@aldair_finance_bot: bot de Telegram para registrar transacciones financieras.
Multi-usuario: requiere vinculación con cuenta de la app via /vincular.

Comandos: /start /ayuda /hoy /semana /mes /balance /categorias /ultimos /borrar /vincular /desvincular
Texto libre: "almuerzo 15000", "salario 3.500.000", "extra multa 200000"
"""

import logging
import os
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

import database as db
from gemini_parser import parse_message_gemini
from categories import CATEGORY_LABELS, SUBCATEGORY_LABELS

load_dotenv()

logging.basicConfig(
    format='%(asctime)s  %(levelname)-8s  %(name)s — %(message)s',
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')


# ─── Helpers de formato ───────────────────────────────────────────────────────

def fmt(monto: float) -> str:
    """Formato COP: 1500000 → $1.500.000"""
    return f"${int(monto):,}".replace(',', '.')

def emoji_tipo(tipo: str) -> str:
    return '💰' if tipo == 'ingreso' else '💸'

def cat_label(cat: str) -> str:
    return CATEGORY_LABELS.get(cat, cat.capitalize())

def sub_label(sub: str) -> str:
    return SUBCATEGORY_LABELS.get(sub, sub)


def _get_uid(update: Update) -> str | None:
    """Retorna el user_id vinculado al chat, o None si no está vinculado."""
    chat_id = update.effective_chat.id
    return db.get_user_id(chat_id)


async def _require_linked(update: Update) -> str | None:
    """Verifica vinculación. Si no está vinculado, envía mensaje y retorna None."""
    uid = _get_uid(update)
    if uid is None:
        await update.message.reply_text(
            "⚠️ *No estás vinculado a una cuenta.*\n\n"
            "Para usar el bot necesitas una cuenta en la app Finance.\n\n"
            "1️⃣ Regístrate en la app\n"
            "2️⃣ Vincula tu Telegram con:\n"
            "`/vincular tu@email.com tuContraseña`\n\n"
            "_Tus datos quedarán sincronizados entre la app y el bot._",
            parse_mode='Markdown',
        )
    return uid


# ─── Comandos ─────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    logger.info('start chat_id=%s', update.effective_chat.id)
    uid = _get_uid(update)
    if uid:
        await update.message.reply_text(
            "👋 *Hola, ya estás vinculado.*\n\n"
            "Escríbeme cualquier gasto o ingreso en texto libre y lo registro.\n\n"
            "Ejemplos:\n"
            "• `almuerzo 15000`\n"
            "• `taxi 8.500`\n"
            "• `salario 3.500.000`\n"
            "• `extra multa 200000` ⚡\n\n"
            "Usa /ayuda para ver todos los comandos.",
            parse_mode='Markdown',
        )
    else:
        await update.message.reply_text(
            "👋 *Hola, soy tu bot de finanzas personales.*\n\n"
            "Para empezar, vincula tu cuenta de la app:\n"
            "`/vincular tu@email.com tuContraseña`\n\n"
            "Si no tienes cuenta, regístrate primero en la app Finance.",
            parse_mode='Markdown',
        )


async def cmd_vincular(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Vincula la cuenta de Telegram con una cuenta de la app."""
    chat_id = update.effective_chat.id

    if not ctx.args or len(ctx.args) < 2:
        await update.message.reply_text(
            "Uso: `/vincular email contraseña`\n\n"
            "Ejemplo: `/vincular aldair@correo.com MiPass123`",
            parse_mode='Markdown',
        )
        return

    email = ctx.args[0]
    password = ' '.join(ctx.args[1:])

    try:
        user_id = db.vincular_telegram(chat_id, email, password)
        logger.info('Vinculado chat_id=%s → user_id=%s', chat_id, user_id[:8])
        await update.message.reply_text(
            "✅ *¡Vinculación exitosa!*\n\n"
            "Tu cuenta de Telegram está conectada con tu cuenta de la app Finance.\n"
            "Ahora puedes registrar gastos e ingresos directamente desde aquí.\n\n"
            "_Escribe /ayuda para ver los comandos disponibles._",
            parse_mode='Markdown',
        )
    except Exception as e:
        logger.error('vincular error: %s', e)
        msg = str(e)
        if 'Invalid login' in msg or 'invalid' in msg.lower():
            await update.message.reply_text(
                "❌ *Credenciales incorrectas.*\n\n"
                "Verifica tu email y contraseña e intenta de nuevo.\n"
                "Usa: `/vincular tu@email.com tuContraseña`",
                parse_mode='Markdown',
            )
        else:
            await update.message.reply_text(
                f"❌ Error al vincular: _{msg[:100]}_",
                parse_mode='Markdown',
            )


async def cmd_desvincular(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Desvincula la cuenta de Telegram."""
    chat_id = update.effective_chat.id
    if db.desvincular_telegram(chat_id):
        logger.info('Desvinculado chat_id=%s', chat_id)
        await update.message.reply_text(
            "🔓 *Cuenta desvinculada.*\n"
            "Ya no se registrarán transacciones desde este chat.\n"
            "Usa `/vincular email contraseña` para volver a vincular.",
            parse_mode='Markdown',
        )
    else:
        await update.message.reply_text(
            "No estabas vinculado a ninguna cuenta.",
        )


async def cmd_ayuda(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "*Comandos disponibles:*\n\n"
        "/hoy — Resumen del día\n"
        "/semana — Resumen de la semana\n"
        "/mes — Resumen del mes\n"
        "/balance — Balance del mes\n"
        "/categorias — Gastos por categoría\n"
        "/ultimos [n] — Últimas transacciones (default 5)\n"
        "/borrar — Elimina la última transacción\n"
        "/vincular email contraseña — Vincular cuenta\n"
        "/desvincular — Desvincular cuenta\n\n"
        "*Texto libre:*\n"
        "`netflix 45000` · `taxi 12.000` · `salario 3.500.000`\n\n"
        "*Gastos imprevistos:*\n"
        "`extra multa 200000` · `imprevisto celular 1.500.000` ⚡",
        parse_mode='Markdown',
    )


def _formato_resumen(r: dict) -> str:
    emoji = '🟢' if r['balance'] >= 0 else '🔴'
    return (
        f"📊 *Resumen {r['periodo']}*\n\n"
        f"💰 Ingresos:  {fmt(r['ingresos'])}\n"
        f"💸 Gastos:    {fmt(r['gastos'])}\n"
        f"{emoji} Balance:   {fmt(r['balance'])}\n\n"
        f"_{r['n_filas']} transacciones_"
    )


async def cmd_hoy(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = await _require_linked(update)
    if not uid:
        return
    try:
        await update.message.reply_text(
            _formato_resumen(db.obtener_resumen_hoy(uid)), parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_hoy: %s', e)
        await update.message.reply_text('❌ Error consultando datos. Intenta de nuevo.')


async def cmd_semana(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = await _require_linked(update)
    if not uid:
        return
    try:
        await update.message.reply_text(
            _formato_resumen(db.obtener_resumen_semana(uid)), parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_semana: %s', e)
        await update.message.reply_text('❌ Error consultando datos. Intenta de nuevo.')


async def cmd_mes(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = await _require_linked(update)
    if not uid:
        return
    try:
        r     = db.obtener_resumen_mes(uid)
        texto = _formato_resumen(r)

        extras = r.get('extraordinarios', [])
        if extras:
            total_extra = sum(f['monto'] for f in extras)
            lineas = ["\n⚡ *Gastos extraordinarios*\n"]
            for f in extras[:5]:
                lineas.append(f"• {fmt(f['monto'])} — _{f.get('descripcion', '')}_")
            if len(extras) > 5:
                lineas.append(f"_...y {len(extras) - 5} más_")
            lineas.append(f"_Total: {fmt(total_extra)}_")
            texto += '\n'.join(lineas)

        await update.message.reply_text(texto, parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_mes: %s', e)
        await update.message.reply_text('❌ Error consultando datos. Intenta de nuevo.')


async def cmd_balance(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = await _require_linked(update)
    if not uid:
        return
    try:
        r   = db.obtener_resumen_mes(uid)
        pct = (r['gastos'] / r['ingresos'] * 100) if r['ingresos'] > 0 else 0
        e   = '🟢' if r['balance'] >= 0 else '🔴'
        await update.message.reply_text(
            f"{e} *Balance del mes*\n\n"
            f"Ingresos: {fmt(r['ingresos'])}\n"
            f"Gastos:   {fmt(r['gastos'])} ({pct:.0f}%)\n"
            f"Balance:  *{fmt(r['balance'])}*",
            parse_mode='Markdown',
        )
    except Exception as e:
        logger.error('cmd_balance: %s', e)
        await update.message.reply_text('❌ Error consultando datos. Intenta de nuevo.')


async def cmd_categorias(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = await _require_linked(update)
    if not uid:
        return
    try:
        datos = db.obtener_gastos_por_categoria(uid)
        if not datos:
            await update.message.reply_text('Sin gastos registrados este mes.')
            return

        total = sum(d['total'] for d in datos)
        lines = ['📂 *Gastos por categoría (mes actual)*\n']
        for d in datos:
            pct = d['total'] / total * 100 if total else 0
            bar = '█' * int(pct / 10) + '░' * (10 - int(pct / 10))
            lines.append(
                f"{bar} *{cat_label(d['categoria'])}*\n"
                f"   {fmt(d['total'])}  ({pct:.0f}%)"
            )
        lines.append(f"\n*Total: {fmt(total)}*")
        await update.message.reply_text('\n'.join(lines), parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_categorias: %s', e)
        await update.message.reply_text('❌ Error consultando datos. Intenta de nuevo.')


async def cmd_ultimos(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = await _require_linked(update)
    if not uid:
        return
    n = 5
    if ctx.args:
        try:
            n = int(ctx.args[0])
        except ValueError:
            pass
    try:
        filas = db.obtener_ultimas_transacciones(uid, n)
        if not filas:
            await update.message.reply_text('Sin transacciones registradas.')
            return

        lines = [f'📋 *Últimas {len(filas)} transacciones*\n']
        for f in filas:
            e     = emoji_tipo(f['tipo'])
            cat   = cat_label(f.get('categoria', ''))
            sub   = sub_label(f.get('subcategoria', ''))
            desc  = f.get('descripcion', '')
            fecha = f.get('fecha', '')
            extra = ' ⚡' if f.get('es_extraordinario') else ''
            lines.append(
                f"{e} *{fmt(f['monto'])}*{extra}  —  {cat} › {sub}\n"
                f"   _{desc}_  `{fecha}`"
            )
        await update.message.reply_text('\n'.join(lines), parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_ultimos: %s', e)
        await update.message.reply_text('❌ Error consultando datos. Intenta de nuevo.')


async def cmd_borrar(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = await _require_linked(update)
    if not uid:
        return
    try:
        fila = db.borrar_ultima_transaccion(uid)
        if not fila:
            await update.message.reply_text('No hay transacciones del bot para borrar.')
            return

        e   = emoji_tipo(fila['tipo'])
        cat = cat_label(fila.get('categoria', ''))
        sub = sub_label(fila.get('subcategoria', ''))
        await update.message.reply_text(
            f"🗑 *Eliminada:*\n"
            f"{e} {fmt(fila['monto'])}  —  {cat} › {sub}\n"
            f"_{fila.get('descripcion', '')}_",
            parse_mode='Markdown',
        )
    except Exception as e:
        logger.error('cmd_borrar: %s', e)
        await update.message.reply_text('❌ Error al borrar. Intenta de nuevo.')


# ─── Mensaje libre ────────────────────────────────────────────────────────────

async def handle_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = await _require_linked(update)
    if not uid:
        return

    text    = (update.message.text or '').strip()
    chat_id = update.effective_chat.id
    logger.info('Mensaje de chat_id=%s: %r', chat_id, text[:60])

    try:
        parsed = parse_message_gemini(text)
    except Exception as exc:
        logger.error('parse_message_gemini error: %s', exc)
        parsed = None

    if parsed is None:
        await update.message.reply_text("¿Cuánto gastaste y en qué fue?")
        return

    try:
        db.registrar_transaccion(
            user_id           = uid,
            tipo              = parsed['tipo'],
            monto             = parsed['monto'],
            categoria         = parsed['categoria'],
            subcategoria      = parsed['subcategoria'],
            descripcion       = parsed['descripcion'],
            es_extraordinario = parsed['es_extraordinario'],
        )

        cat = cat_label(parsed['categoria'])
        sub = sub_label(parsed['subcategoria'])
        tipo_txt = 'gasto' if parsed['tipo'] == 'gasto' else 'ingreso'
        extra_txt = " Lo marqué como extraordinario." if parsed['es_extraordinario'] else ""

        await update.message.reply_text(
            f"¡Anotado! Guardé un {tipo_txt} de {fmt(parsed['monto'])} en {cat} ({sub})."
            f"{extra_txt}"
        )
        logger.info('Guardado: %s %s → %s/%s', parsed['tipo'],
                    fmt(parsed['monto']), parsed['categoria'], parsed['subcategoria'])

    except Exception as exc:
        logger.error('registrar_transaccion: %s', exc)
        await update.message.reply_text(
            f"❌ Error al guardar. Intenta de nuevo.\n_({str(exc)[:80]})_",
            parse_mode='Markdown',
        )


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not TOKEN:
        raise RuntimeError('Falta TELEGRAM_BOT_TOKEN en el .env')

    logger.info('Arrancando bot (token: %s...)', TOKEN[:10])

    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler('start',       cmd_start))
    app.add_handler(CommandHandler('ayuda',       cmd_ayuda))
    app.add_handler(CommandHandler('vincular',    cmd_vincular))
    app.add_handler(CommandHandler('desvincular', cmd_desvincular))
    app.add_handler(CommandHandler('hoy',         cmd_hoy))
    app.add_handler(CommandHandler('semana',      cmd_semana))
    app.add_handler(CommandHandler('mes',         cmd_mes))
    app.add_handler(CommandHandler('balance',     cmd_balance))
    app.add_handler(CommandHandler('categorias',  cmd_categorias))
    app.add_handler(CommandHandler('ultimos',     cmd_ultimos))
    app.add_handler(CommandHandler('borrar',      cmd_borrar))

    # MessageHandler SIEMPRE después de CommandHandlers
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    logger.info('Bot listo. Ctrl+C para detener.')
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
