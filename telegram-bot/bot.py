"""
@aldair_finance_bot — Bot de Telegram para registrar transacciones financieras.

Comandos:
  /start       — Bienvenida
  /ayuda       — Lista de comandos
  /hoy         — Resumen del día
  /semana      — Resumen de la semana
  /mes         — Resumen del mes
  /balance     — Balance del mes actual
  /categorias  — Gastos por categoría (mes actual)
  /ultimos [n] — Últimas N transacciones (máx 20, default 5)
  /borrar      — Elimina la última transacción

Texto libre:
  "almuerzo 15000"      → registra gasto
  "salario 3.500.000"   → registra ingreso
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
from parser import parse_message
from categories import CATEGORY_LABELS, SUBCATEGORY_LABELS

load_dotenv()

logging.basicConfig(
    format='%(asctime)s  %(levelname)-8s  %(name)s — %(message)s',
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
ALLOWED_CHAT_ID = os.getenv('ALLOWED_CHAT_ID', '')  # Opcional: restringe el bot a 1 chat


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


def _check_allowed(update: Update) -> bool:
    """Si ALLOWED_CHAT_ID está configurado, bloquea otros chats."""
    if not ALLOWED_CHAT_ID:
        return True
    return str(update.effective_chat.id) == ALLOWED_CHAT_ID


# ─── Comandos ─────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return
    await update.message.reply_text(
        "👋 *Hola, soy tu bot de finanzas personales.*\n\n"
        "Escríbeme cualquier gasto o ingreso en texto libre y lo registro automáticamente.\n\n"
        "Ejemplos:\n"
        "• `almuerzo 15000`\n"
        "• `taxi 8.500`\n"
        "• `mercado 250.000`\n"
        "• `salario 3.500.000`\n\n"
        "Usa /ayuda para ver todos los comandos.",
        parse_mode='Markdown',
    )


async def cmd_ayuda(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return
    await update.message.reply_text(
        "*Comandos disponibles:*\n\n"
        "/hoy — Resumen del día de hoy\n"
        "/semana — Resumen de la semana\n"
        "/mes — Resumen del mes\n"
        "/balance — Balance rápido del mes\n"
        "/categorias — Gastos por categoría\n"
        "/ultimos [n] — Últimas transacciones (default 5)\n"
        "/borrar — Elimina la última transacción\n\n"
        "*Para registrar una transacción:*\n"
        "Escribe en texto libre, por ejemplo:\n"
        "`netflix 45000` · `taxi 12.000` · `salario 3.500.000`",
        parse_mode='Markdown',
    )


async def cmd_hoy(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return
    try:
        r = db.obtener_resumen_hoy()
        await update.message.reply_text(_formato_resumen(r), parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_hoy error: %s', e)
        await update.message.reply_text('❌ Error consultando datos.')


async def cmd_semana(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return
    try:
        r = db.obtener_resumen_semana()
        await update.message.reply_text(_formato_resumen(r), parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_semana error: %s', e)
        await update.message.reply_text('❌ Error consultando datos.')


async def cmd_mes(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return
    try:
        r = db.obtener_resumen_mes()
        await update.message.reply_text(_formato_resumen(r), parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_mes error: %s', e)
        await update.message.reply_text('❌ Error consultando datos.')


def _formato_resumen(r: dict) -> str:
    balance_emoji = '🟢' if r['balance'] >= 0 else '🔴'
    lines = [
        f"📊 *Resumen {r['periodo']}*\n",
        f"💰 Ingresos:  {fmt(r['ingresos'])}",
        f"💸 Gastos:    {fmt(r['gastos'])}",
        f"{balance_emoji} Balance:   {fmt(r['balance'])}",
        f"\n_{r['n_filas']} transacciones_",
    ]
    return '\n'.join(lines)


async def cmd_balance(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return
    try:
        r = db.obtener_resumen_mes()
        pct = (r['gastos'] / r['ingresos'] * 100) if r['ingresos'] > 0 else 0
        emoji = '🟢' if r['balance'] >= 0 else '🔴'
        await update.message.reply_text(
            f"{emoji} *Balance del mes*\n\n"
            f"Ingresos: {fmt(r['ingresos'])}\n"
            f"Gastos:   {fmt(r['gastos'])} ({pct:.0f}%)\n"
            f"Balance:  *{fmt(r['balance'])}*",
            parse_mode='Markdown',
        )
    except Exception as e:
        logger.error('cmd_balance error: %s', e)
        await update.message.reply_text('❌ Error consultando datos.')


async def cmd_categorias(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return
    try:
        datos = db.obtener_gastos_por_categoria()
        if not datos:
            await update.message.reply_text('Sin gastos registrados este mes.')
            return

        total = sum(d['total'] for d in datos)
        lines = ['📂 *Gastos por categoría (mes actual)*\n']
        for d in datos:
            pct  = d['total'] / total * 100 if total else 0
            bar  = '█' * int(pct / 10) + '░' * (10 - int(pct / 10))
            lines.append(
                f"{bar} *{cat_label(d['categoria'])}*\n"
                f"   {fmt(d['total'])}  ({pct:.0f}%)"
            )
        lines.append(f"\n*Total: {fmt(total)}*")
        await update.message.reply_text('\n'.join(lines), parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_categorias error: %s', e)
        await update.message.reply_text('❌ Error consultando datos.')


async def cmd_ultimos(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return
    # Parsear argumento opcional: /ultimos 10
    n = 5
    if ctx.args:
        try:
            n = int(ctx.args[0])
        except ValueError:
            pass

    try:
        filas = db.obtener_ultimas_transacciones(n)
        if not filas:
            await update.message.reply_text('Sin transacciones registradas.')
            return

        lines = [f'📋 *Últimas {len(filas)} transacciones*\n']
        for f in filas:
            e    = emoji_tipo(f['tipo'])
            cat  = cat_label(f.get('categoria', ''))
            sub  = sub_label(f.get('subcategoria', ''))
            desc = f.get('descripcion', '')
            fecha = f.get('fecha', '')
            lines.append(
                f"{e} *{fmt(f['monto'])}*  —  {cat} › {sub}\n"
                f"   _{desc}_  `{fecha}`"
            )
        await update.message.reply_text('\n'.join(lines), parse_mode='Markdown')
    except Exception as e:
        logger.error('cmd_ultimos error: %s', e)
        await update.message.reply_text('❌ Error consultando datos.')


async def cmd_borrar(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return
    try:
        fila = db.borrar_ultima_transaccion()
        if not fila:
            await update.message.reply_text('No hay transacciones para borrar.')
            return

        e   = emoji_tipo(fila['tipo'])
        cat = cat_label(fila.get('categoria', ''))
        sub = sub_label(fila.get('subcategoria', ''))
        await update.message.reply_text(
            f"🗑 Eliminada:\n"
            f"{e} {fmt(fila['monto'])}  —  {cat} › {sub}\n"
            f"_{fila.get('descripcion', '')}_",
            parse_mode='Markdown',
        )
    except Exception as e:
        logger.error('cmd_borrar error: %s', e)
        await update.message.reply_text('❌ Error al borrar.')


# ─── Mensaje libre ────────────────────────────────────────────────────────────

async def handle_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not _check_allowed(update):
        return

    text = update.message.text or ''
    parsed = parse_message(text)

    if parsed is None:
        await update.message.reply_text(
            "No entendí el monto. Escribe algo como:\n"
            "`almuerzo 15000` o `salario 3.500.000`",
            parse_mode='Markdown',
        )
        return

    try:
        fila = db.registrar_transaccion(
            tipo        = parsed['tipo'],
            monto       = parsed['monto'],
            categoria   = parsed['categoria'],
            subcategoria= parsed['subcategoria'],
            descripcion = parsed['descripcion'],
        )

        e   = emoji_tipo(parsed['tipo'])
        cat = cat_label(parsed['categoria'])
        sub = sub_label(parsed['subcategoria'])

        await update.message.reply_text(
            f"✅ *Registrado*\n\n"
            f"{e} *{fmt(parsed['monto'])}*\n"
            f"📂 {cat} › {sub}\n"
            f"📝 _{parsed['descripcion']}_\n\n"
            f"_/borrar para deshacer_",
            parse_mode='Markdown',
        )
    except Exception as e:
        logger.error('handle_text error: %s', e)
        await update.message.reply_text('❌ Error guardando la transacción. Intenta de nuevo.')


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not TOKEN:
        raise RuntimeError('Falta TELEGRAM_BOT_TOKEN en el .env')

    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler('start',      cmd_start))
    app.add_handler(CommandHandler('ayuda',      cmd_ayuda))
    app.add_handler(CommandHandler('hoy',        cmd_hoy))
    app.add_handler(CommandHandler('semana',     cmd_semana))
    app.add_handler(CommandHandler('mes',        cmd_mes))
    app.add_handler(CommandHandler('balance',    cmd_balance))
    app.add_handler(CommandHandler('categorias', cmd_categorias))
    app.add_handler(CommandHandler('ultimos',    cmd_ultimos))
    app.add_handler(CommandHandler('borrar',     cmd_borrar))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    logger.info('Bot iniciado. Ctrl+C para detener.')
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
