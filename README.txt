SWITCHAROO AMENO PRO — VERSIÓN 2.0

ARQUITECTURA
- Node.js + Express.
- SQLite real mediante node:sqlite.
- Autenticación JWT.
- Evidencia fotográfica opcional.
- Preparada para Railway con almacenamiento persistente.

INICIO LOCAL
1. Instala Node.js 22.5 o superior.
2. Ejecuta INICIAR_WINDOWS.bat.
3. Abre http://localhost:8080

CREDENCIALES INICIALES
- Administrador: AMENO2026
- Inferno Legion: 1111
- Tidal Reapers: 2222
- Terra Titans: 3333
- Storm Vanguards: 4444

PUBLICAR EN RAILWAY
1. Sube a GitHub el contenido de esta carpeta.
2. Crea un servicio desde el repositorio.
3. Start Command: npm start
4. Crea un volumen con Mount Path: /app/storage
5. Agrega una variable:
   STORAGE_DIR=/app/storage
6. Agrega una variable segura:
   JWT_SECRET=una-clave-larga-y-unica
7. Genera el dominio en Settings > Networking.

IMPORTANTE
- No subas node_modules.
- La base de datos se crea automáticamente al primer arranque.
- Cambia los PIN desde Administración.
- El primer jugador de cada roster es el capitán.


SI NO ABRE EN WINDOWS
1. Confirma que tienes Node.js 22 o superior con: node -v
2. Descomprime toda la carpeta; no ejecutes el BAT dentro del ZIP.
3. Ejecuta INICIAR_WINDOWS.bat.
4. Espera entre 3 y 10 segundos.
5. Si el navegador muestra error, actualiza http://localhost:8080
6. Si falla, ejecuta DIAGNOSTICO_WINDOWS.bat y revisa el mensaje final.


ACTUALIZACIÓN 2.1
- Nuevo logo oficial de la liga con fondo transparente.
- La pantalla de inicio de sesión ya no muestra la contraseña inicial del administrador.


ACTUALIZACIÓN 2.2
- Corregido el Pick & Ban de los brackets.
- Corregidas las inserciones de acciones y mapas en SQLite.
- Ahora se puede escoger escribiendo el número o el nombre del mapa.
- Se muestra claramente de qué equipo es el turno.


ACTUALIZACIÓN 2.3
- Tabla acumulada de estadísticas por equipos para todo el torneo.
- Mejor jugador de cada jornada.
- Mejor jugador del torneo.
- Panel de administración para seleccionar y actualizar los reconocimientos.


ACTUALIZACIÓN 2.4
- Botón exclusivo del administrador para reiniciar los datos competitivos.
- El reinicio conserva equipos, nombres de jugadores y PIN.
- Nuevo Pick & Ban visual mediante tarjetas de mapas.
- Indicador de turno, progreso, historial y actualización automática.
- Los capitanes ya no necesitan escribir manualmente el nombre del mapa.


ACTUALIZACIÓN 2.5
- Nuevo asistente visual y rápido para subir resultados de liguilla y brackets.
- Registro mapa por mapa con marcador grande, botones +/− y progreso de serie.
- Las estadísticas muestran únicamente los campos necesarios para cada modo.
- Revisión final antes de enviar el resultado.
- Nueva sección exclusiva Grand Final.
- Grand Final con versus, logos, referentes, comparativa y estadísticas de finalistas.
- Grand Final configurada como Pick & Ban Mejor de 7.


CORRECCIÓN 2.5.1
- Restaurado el listado de mapas utilizado por el Pick & Ban interactivo.
- Corregido el error del navegador: PB_POOLS is not defined.
- Se mantienen el registro rápido de resultados y la sección Grand Final.


CORRECCIÓN 2.5.2
- Corregida la secuencia del Pick & Ban de la Grand Final Bo7:
  1. Hardpoint
  2. ByD / Search & Destroy
  3. Overload
  4. Hardpoint
  5. ByD / Search & Destroy
  6. Overload
  7. SnD / Search & Destroy
- El séptimo mapa ya no será Hardpoint.


ACTUALIZACIÓN 2.5.3
- La fase de liguilla ya no genera mapas aleatorios.
- Los mapas quedan predeterminados por jornada:

JORNADA 1
1. Hardpoint: Den
2. Search & Destroy: Gridlock
3. Overload: Den
4. Hardpoint: Sake
5. Search & Destroy: Fringe

JORNADA 2
1. Hardpoint: Sake
2. Search & Destroy: Raid
3. Overload: Gridlock
4. Hardpoint: Colossus
5. Search & Destroy: Den

JORNADA 3
1. Hardpoint: Scar
2. Search & Destroy: Sake
3. Overload: Den
4. Hardpoint: Hacienda
5. Search & Destroy: Raid

IMPORTANTE
- Si la liguilla ya fue generada anteriormente, reinicia el torneo desde Administración
  y vuelve a pulsar Generar liguilla para que se apliquen estos mapas.


CORRECCIÓN 2.5.4
- Jornada 2, mapa 5 corregido:
  Search & Destroy: Den


CORRECCIÓN 2.5.5
- Ahora cualquier capitán participante del partido puede enviar el resultado.
- El resultado sigue quedando pendiente de aprobación por el administrador.
- Se mejoraron mensajes de error al enviar resultados.
- Se aclara en pantalla que el reporte se envía para aprobación.
- No es necesario reiniciar el torneo ni borrar la base de datos.


CORRECCIÓN 2.5.6
- El administrador ahora puede editar resultados ya aprobados de liguilla y brackets.
- Se agregó el botón "Editar resultado" para el admin.
- Al editar, se limpian las estadísticas anteriores del partido y se recalculan con los nuevos datos.
- La corrección del admin se guarda como resultado aprobado automáticamente.
- No es necesario reiniciar torneo ni borrar la base de datos.


SWITCHAROO AMENO PRO v3.0 — IMPACT SCORE
- Migración automática y no destructiva de la base de datos existente.
- Campos nuevos: asistencias, objective kills, kill overloads y bomb carrier kills.
- Hardpoint: bajas, muertes, asistencias, hill time y objective kills.
- Overload: bajas, muertes, asistencias, overloads y kill overloads.
- Search & Destroy: bajas, muertes, asistencias, bomb carrier kills, plants y defuses.
- Puntuación automática:
  Bajas +100; asistencias +100; objective kills +125; cada 5 segundos en Hill +15;
  overloads +300; kill overloads +125; plants +100; defuses +100; bomb carrier kills +125.
- Ranking general ordenado de mayor a menor puntuación.
- MVP automático por jornada, torneo, equipo y Grand Final.
- Rankings por liguilla, brackets y Grand Final.
- Los datos anteriores se conservan; los campos nuevos comienzan en 0 para registros históricos.


ACTUALIZACIÓN 3.1.0 — RATING PONDERADO
--------------------------------------
Esta actualización no modifica el esquema de la base de datos y no elimina
resultados, estadísticas, equipos, jugadores, PIN, brackets ni Pick & Ban.

La posición de cada jugador se calcula con un rating normalizado de 0 a 100:

- 35% K/D.
- 25% Objective Score.
- 30% bajas por mapa.
- 10% asistencias por mapa.

Objective Score:
- Overload: 300 puntos.
- Kill Overload: 125 puntos.
- Plant: 100 puntos.
- Defuse: 100 puntos.
- Objective Kill: 125 puntos.
- Cada bloque completo de 5 segundos en Hill: 15 puntos.

Cada componente se compara con el mejor valor del ranking correspondiente.
El rating se usa automáticamente para:
- Ranking general.
- Ranking de liguilla.
- Ranking de brackets.
- Ranking de Grand Final.
- MVP de cada jornada.
- MVP del torneo.
- MVP de la Grand Final.
- Mejor jugador de cada equipo.

Los Bomb Carrier Kills se conservan y se muestran, pero no forman parte del
Objective Score solicitado en esta versión.


ACTUALIZACIÓN 3.2.0 — MEJOR JUGADOR POR MODALIDAD
--------------------------------------------------
No modifica el esquema de la base de datos y no elimina datos existentes.

Se agregaron reconocimientos automáticos para:
- Mejor jugador de Hardpoint.
- Mejor jugador de Overload.
- Mejor jugador de Search & Destroy.

Cada premio utiliza exclusivamente las estadísticas de los mapas de su modo
y aplica la misma fórmula de rating:

- 35% K/D del modo.
- 25% Objective Score del modo.
- 30% bajas por mapa del modo.
- 10% asistencias por mapa del modo.

Objective Score por modalidad:
- Hardpoint: Objective Kills + bloques completos de 5 segundos en Hill.
- Overload: Overloads + Kill Overloads.
- Search & Destroy: Plants + Defuses.

También se agregó un Top 3 automático por cada modalidad.
Los Bomb Carrier Kills se conservan y se muestran, pero no forman parte del
Objective Score establecido para la versión 3.1.


ACTUALIZACIÓN 3.3.0 — SISTEMA MAPA NEUTRAL
-------------------------------------------
Esta actualización NO modifica el esquema de la base de datos y NO elimina:
- Resultados.
- Estadísticas ingresadas.
- Equipos y jugadores.
- Liguilla, brackets o Grand Final.
- Pick & Ban.
- Evidencias.

Nuevo rating:
- 35% K/D normalizado.
- 25% Objective Score POR MAPA normalizado.
- 30% bajas POR MAPA normalizadas.
- 10% asistencias POR MAPA normalizadas.

Objective Score por mapa:
Objective Score acumulado / mapas realmente registrados para el jugador.

El número total de mapas deja de ser una ventaja directa:
- Las estadísticas acumuladas continúan visibles.
- Las estadísticas acumuladas no se utilizan para ordenar.
- Los desempates tampoco utilizan bajas totales ni Objective Score total.
- Los MVP de jornada, torneo, equipo, modo y Grand Final usan el mismo sistema.

Tratamiento de FF:
- Un FF no debe generar estadísticas ficticias.
- Si no se insertan filas de estadísticas, no aumenta el número de mapas del jugador.
- La victoria del equipo puede registrarse por separado del rendimiento individual.
