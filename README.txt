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
