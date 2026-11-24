"""Monta láminas a partir de las capturas: las pantallas principales, los dos aspectos y los últimos cambios."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'capturas')
B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; R = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def lamina(items, salida):
    ancho, sep, margen = 360, 44, 48; alto = round(1688 * ancho / 780)
    W = margen * 2 + ancho * len(items) + sep * (len(items) - 1); H = margen + 64 + alto + 70 + margen - 10
    lienzo = Image.new('RGB', (W, H), (238, 241, 245)); dr = ImageDraw.Draw(lienzo)
    fT, fP, fL = ImageFont.truetype(B, 26), ImageFont.truetype(R, 19), ImageFont.truetype(B, 24)
    x = margen
    for it in items:
        y = margen
        if it.get('letra'):
            dr.ellipse([x, y, x + 44, y + 44], fill=(20, 24, 31)); tw = dr.textlength(it['letra'], font=fL)
            dr.text((x + 22 - tw / 2, y + 7), it['letra'], font=fL, fill=(255, 255, 255)); dr.text((x + 58, y + 6), it['titulo'], font=fT, fill=(20, 24, 31))
        else:
            dr.text((x, y + 6), it['titulo'], font=fT, fill=(20, 24, 31))
        im = Image.open(f"{d}/{it['img']}.png").convert('RGB').resize((ancho, alto), Image.LANCZOS)
        m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, ancho - 1, alto - 1], radius=30, fill=255)
        s = Image.new('RGBA', (ancho + 80, alto + 80), (0, 0, 0, 0)); ImageDraw.Draw(s).rounded_rectangle([40, 48, 40 + ancho, 48 + alto], radius=30, fill=(16, 24, 40, 70)); s = s.filter(ImageFilter.GaussianBlur(18))
        lienzo.paste(s, (x - 40, y + 24), s); lienzo.paste(im, (x, y + 64), m)
        yy = y + 64 + alto + 18
        for linea in it['pie'].split('\n'): dr.text((x, yy), linea, font=fP, fill=(85, 96, 111)); yy += 26
        x += ancho + sep
    lienzo.save(f'{d}/{salida}.png'); print(salida, lienzo.size)
lamina([{'letra': 'A', 'titulo': 'Claro', 'img': 'a-claro-plato', 'pie': 'Limpio y luminoso.'},
        {'letra': 'B', 'titulo': 'Oscuro', 'img': 'a-oscuro-plato', 'pie': 'Los colores resaltan más.'}], 'al-gramo-aspectos')
lamina([{'titulo': '1. Pones los gramos', 'img': '01-plato', 'pie': 'Y te dice las calorías y los\nmacros del plato.'},
        {'titulo': '2. Pones los macros', 'img': '03-macros-60-70-20', 'pie': 'Y te dice cuántos gramos de\ncada cosa. Si falta algo, lo avisa.'},
        {'titulo': '3. Tus macros del día', 'img': '10-mis-macros-definir', 'pie': 'Definir, mantener o ganar,\nsegún tu cuerpo.'}], 'al-gramo-pantallas')
lamina([{'titulo': 'Ordenar: más hidratos', 'img': '14-orden-hid', 'pie': 'El dato por el que ordenas\nsale resaltado en cada fila.'},
        {'titulo': 'Más proteína por caloría', 'img': '14-orden-pk', 'pie': 'Lo más «limpio» para definir.\nTambién: grasa, fibra y calorías.'},
        {'titulo': 'Aspecto: claro u oscuro', 'img': '12-aspecto', 'pie': 'Automático sigue a tu móvil.\nEl aspecto Color queda fuera.'}], 'al-gramo-cambios')
# El día guiado (test/fotos-guiado.js). Las láminas «al-gramo-hoy» y «al-gramo-macros-antes-ahora» de la versión anterior
# se quedan en capturas/ como estaban: enseñan pantallas que ya no existen así.
lamina([{'titulo': '1. Abres y ya te dice', 'img': 'g-1-toca-desayuno', 'pie': 'Qué comida toca, cuánto te\ntoca y cuánto llevas hoy.'},
        {'titulo': '2. Dices qué desayunas', 'img': 'g-2-a-medias', 'pie': 'Va calculando los gramos\ny te dice qué falta.'},
        {'titulo': '3. Te pone los gramos', 'img': 'g-3b-clavado-abajo', 'pie': 'De cada cosa, para clavar\nlo que te toca.'},
        {'titulo': '4. Lo apuntas', 'img': 'g-4-apuntado', 'pie': 'Se limpia y prepara la comida\ncon lo que te queda del día.'}], 'al-gramo-dia-guiado')
lamina([{'titulo': 'Algo entre horas', 'img': 'g-5-entre-horas', 'pie': 'Lo apuntas en gramos, sin\nobjetivo. No gasta una comida.'},
        {'titulo': 'Cómo vas hoy', 'img': 'g-7-hoy', 'pie': 'Todo lo apuntado y un botón\npara preparar lo siguiente.'},
        {'titulo': 'Tu caso: 90 / 250 / 5', 'img': 'c-macros-ahora', 'pie': 'Antes subía la grasa a 9 g.\nAhora dice qué falta y por qué.'}], 'al-gramo-dia-extras')
lamina([{'letra': 'A', 'titulo': 'Solo las calorías', 'img': 'ab-dia-a', 'pie': 'Más limpio. Los macros del\ndía se ven en «Hoy».'},
        {'letra': 'B', 'titulo': 'Con los macros del día', 'img': 'ab-dia-b', 'pie': 'Como está ahora: lo que llevas\nde cada macro, sin salir del plato.'}], 'al-gramo-dia-a-b')
# Lo siguiente, para elegir antes de construir (test/maquetas-siguiente.js): son maquetas dibujadas sobre la app.
lamina([{'letra': 'A', 'titulo': 'Cuatro tamaños', 'img': 'm-tamano-a', 'pie': 'Un toque: suave, normal, fuerte o todo.\nEl resto del día se reajusta solo.'},
        {'letra': 'B', 'titulo': 'Más o menos', 'img': 'm-tamano-b', 'pie': 'Más fino (cinco tamaños), pero\nhay que tocar varias veces.'}], 'al-gramo-tamano-a-b')
lamina([{'letra': 'A', 'titulo': 'Dentro de «Hoy»', 'img': 'm-historial-a1', 'pie': 'Los últimos 7 días arriba. Tocas\nuno y ves lo que comiste.'},
        {'titulo': '…y el mes entero', 'img': 'm-historial-a2', 'pie': 'Al tocar la fecha: cumplidos,\na medias, sin apuntar y la racha.'},
        {'letra': 'B', 'titulo': 'Pestaña «Progreso»', 'img': 'm-historial-b', 'pie': 'Calendario y peso juntos, pero\nuna pestaña más abajo.'}], 'al-gramo-historial-a-b')
lamina([{'titulo': '1. Entra con su código', 'img': 'm-usuarios-1', 'pie': 'Tú le pasas un enlace con su\ncódigo. Sin correo ni contraseña.'},
        {'titulo': '2. Crea su PIN', 'img': 'm-usuarios-2', 'pie': 'Cuatro números. El móvil se queda\ndentro, como en la Jamacasa.'},
        {'titulo': '3. Tú ves quién la usa', 'img': 'm-usuarios-3', 'pie': 'Solo tú: usuarios, actividad\ne invitar a más gente.'},
        {'titulo': '4. Su peso', 'img': 'm-usuarios-4', 'pie': 'En «Mis macros»: lo apunta\ncuando quiera y ve cómo va.'}], 'al-gramo-usuarios')
