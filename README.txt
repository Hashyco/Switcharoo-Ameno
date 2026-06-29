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
