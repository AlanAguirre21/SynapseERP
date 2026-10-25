"""Mide el clasificador sobre el conjunto de evaluación — `024`. Imprime los
aciertos (la intención correcta en primer lugar), las respuestas directas
correctas e incorrectas con los umbrales actuales, las frases fuera de
dominio que se responderían con datos, y una tabla para recalibrar.

    python manage.py evaluar_asistente
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.asistente import clasificador, periodos
from apps.asistente.evaluacion import EVALUACION, FUERA_DE_DOMINIO
from core.permissions import ROL_ADMIN


def _clasificar(frase):
    return clasificador.clasificar(periodos.detectar_periodo(frase)[1], ROL_ADMIN)


def evaluar():
    """`{aciertos, total, directas_ok, directas_mal, fuera_directas, fallos, barrido}`."""

    aciertos = total = directas_ok = directas_mal = 0
    fallos = []
    dentro = []
    for intencion, frases in EVALUACION.items():
        for frase in frases:
            total += 1
            resultado = _clasificar(frase)
            dentro.append((resultado['intencion'] == intencion, resultado))
            if resultado['intencion'] == intencion:
                aciertos += 1
            else:
                fallos.append((frase, intencion, resultado['intencion'], resultado['puntuacion']))
            if resultado['confianza'] == clasificador.ALTA:
                if resultado['intencion'] == intencion:
                    directas_ok += 1
                else:
                    directas_mal += 1
    resultados_fuera = {frase: _clasificar(frase) for frase in FUERA_DE_DOMINIO}
    fuera = [frase for frase, resultado in resultados_fuera.items() if resultado['confianza'] == clasificador.ALTA]
    return {
        'aciertos': aciertos, 'total': total, 'directas_ok': directas_ok, 'directas_mal': directas_mal,
        'fuera_directas': fuera, 'fallos': fallos,
        'barrido': barrer_umbrales(dentro, list(resultados_fuera.values())),
    }


def _ventaja(resultado):
    alternativas = resultado['alternativas']
    return alternativas[0]['puntuacion'] - alternativas[1]['puntuacion'] if len(alternativas) > 1 else 1.0


def barrer_umbrales(dentro, fuera):
    """Para cada umbral alto candidato (con el margen actual): respuestas
    directas correctas, incorrectas y fuera de dominio. Sin recalcular
    *embeddings*: reutiliza las puntuaciones ya obtenidas."""

    margen = settings.ASISTENTE_MARGEN
    filas = []
    for centesimas in range(60, 96):
        umbral = centesimas / 100

        def directa(resultado, umbral=umbral):
            return resultado['puntuacion'] >= umbral and _ventaja(resultado) >= margen

        filas.append({
            'umbral': umbral,
            'ok': sum(1 for correcto, r in dentro if correcto and directa(r)),
            'mal': sum(1 for correcto, r in dentro if not correcto and directa(r)),
            'fuera': sum(1 for r in fuera if directa(r)),
        })
    return filas


class Command(BaseCommand):
    help = 'Evalúa el clasificador de intención del asistente.'

    def handle(self, *args, **options):
        r = evaluar()
        self.stdout.write(
            f'Modelo {clasificador.nombre_modelo()} · umbral alto {settings.ASISTENTE_UMBRAL_ALTO}, '
            f'margen {settings.ASISTENTE_MARGEN}, umbral bajo {settings.ASISTENTE_UMBRAL_BAJO}',
        )
        self.stdout.write(f'Aciertos (1.er lugar): {r["aciertos"]}/{r["total"]} = {r["aciertos"] / r["total"]:.1%}')
        self.stdout.write(f'Respuestas directas: {r["directas_ok"]} correctas, {r["directas_mal"]} incorrectas')
        self.stdout.write(f'Fuera de dominio respondidas con datos: {len(r["fuera_directas"])} {r["fuera_directas"]}')
        for frase, esperada, obtenida, puntuacion in r['fallos']:
            self.stdout.write(f'  ✗ «{frase}»: esperada {esperada}, obtenida {obtenida} ({puntuacion:.3f})')

        # Sugerido: el umbral con más respuestas directas correctas y 0 fuera de dominio.
        validas = [fila for fila in r['barrido'] if fila['fuera'] == 0]
        sugerida = max(validas, key=lambda fila: (fila['ok'], -fila['mal'], -fila['umbral']), default=None)
        self.stdout.write('Umbral alto · directas correctas · incorrectas · fuera de dominio')
        for fila in r['barrido']:
            marca = '  (sugerido)' if fila is sugerida else ''
            self.stdout.write(f'  {fila["umbral"]:.2f} · {fila["ok"]} · {fila["mal"]} · {fila["fuera"]}{marca}')
