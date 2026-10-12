# Genera todos los íconos y gráficos de la tienda a partir del logo.
# Uso: python make_icons.py <ruta-del-proyecto>   (requiere Pillow)
# Fuente: assets/logo-fuente.png (trazo verde sobre fondo crema).
import os
import sys
from PIL import Image, ImageDraw, ImageFont

root = sys.argv[1]
A = os.path.join(root, 'assets')
S = os.path.join(root, 'store')
CREAM, GREEN, SAGE, NIGHT = (247, 233, 198), (25, 68, 23), (173, 201, 160), (18, 21, 19)


def stroke_mask(src):
    """Alpha del trazo: 255 donde es verde, 0 donde es fondo crema o blanco."""
    rgb = src.convert('RGB')
    lum = rgb.convert('L')
    bg_l, fg_l = 233, 64
    mask = lum.point(lambda v: max(0, min(255, int((bg_l - v) * 255 / (bg_l - fg_l)))))
    return mask


def crop_to_mark(mask, pad=4):
    # El recorte se calcula solo con píxeles claramente del trazo (ignora ruido tenue).
    l, t, r, b = mask.point(lambda v: 255 if v > 128 else 0).getbbox()
    clean = mask.point(lambda v: v if v > 24 else 0)
    return clean.crop((l - pad, t - pad, r + pad, b + pad))


def place(mark_mask, canvas, frac, color, bg=None):
    """Coloca el trazo centrado ocupando `frac` del lado del lienzo."""
    w, h = mark_mask.size
    scale = canvas * frac / max(w, h)
    m = mark_mask.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    img = Image.new('RGBA', (canvas, canvas), bg + (255,) if bg else (0, 0, 0, 0))
    layer = Image.new('RGBA', m.size, color + (255,))
    img.paste(layer, ((canvas - m.width) // 2, (canvas - m.height) // 2), m)
    return img


src = Image.open(os.path.join(A, 'logo-fuente.png'))
mark = crop_to_mark(stroke_mask(src))

place(mark, 1024, 0.56, GREEN, CREAM).convert('RGB').save(f'{A}/icon.png')
place(mark, 1024, 0.50, GREEN).save(f'{A}/android-icon-foreground.png')     # dentro de la zona segura (66%)
Image.new('RGB', (1024, 1024), CREAM).save(f'{A}/android-icon-background.png')
place(mark, 1024, 0.50, (255, 255, 255)).save(f'{A}/android-icon-monochrome.png')
place(mark, 96, 0.82, (255, 255, 255)).save(f'{A}/notification-icon.png')
place(mark, 1024, 0.50, GREEN).save(f'{A}/splash-icon.png')
place(mark, 1024, 0.50, SAGE).save(f'{A}/splash-icon-dark.png')
place(mark, 48, 0.70, GREEN, CREAM).convert('RGB').save(f'{A}/favicon.png')
place(mark, 256, 0.92, GREEN).save(f'{A}/logo-mark.png')                    # usado dentro de la app

place(mark, 512, 0.56, GREEN, CREAM).convert('RGB').save(f'{S}/play-icon-512.png')


def font(size):
    for path in ['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default()


fg = Image.new('RGB', (1024, 500), CREAM)
logo = place(mark, 280, 0.9, GREEN)
fg.paste(logo, (90, 110), logo)
d = ImageDraw.Draw(fg)
d.text((410, 165), 'Finance', font=font(92), fill=GREEN)
d.text((414, 285), 'Tus finanzas, en calma', font=font(40), fill=(96, 120, 88))
fg.save(f'{S}/feature-graphic-1024x500.png')
print('ok')
