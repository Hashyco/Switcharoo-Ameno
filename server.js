const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";
const ROOT = __dirname;
const STORAGE = process.env.STORAGE_DIR || path.join(ROOT, "storage");
const UPLOADS = path.join(STORAGE, "uploads");
const DB_FILE = path.join(STORAGE, "switcharoo.db");
const PUBLIC = path.join(ROOT, "public");
const JWT_SECRET = process.env.JWT_SECRET || "CAMBIA-ESTE-SECRETO-SWITCHAROO-2026";

fs.mkdirSync(UPLOADS, { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");

function hashPin(pin, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(pin), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPin(pin, stored) {
  const [salt, original] = String(stored || "").split(":");
  if (!salt || !original) return false;
  const test = crypto.scryptSync(String(pin), salt, 64);
  const originalBuffer = Buffer.from(original, "hex");
  return test.length === originalBuffer.length && crypto.timingSafeEqual(test, originalBuffer);
}
function id(prefix="id") { return `${prefix}_${crypto.randomUUID()}`; }

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Migración aplicada: ${table}.${column}`);
  }
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      element TEXT NOT NULL,
      logo TEXT NOT NULL,
      color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('admin','captain')),
      team_id TEXT,
      display_name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      FOREIGN KEY(team_id) REFERENCES teams(id)
    );
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_captain INTEGER NOT NULL DEFAULT 0,
      UNIQUE(team_id,name),
      FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      phase TEXT NOT NULL CHECK(phase IN ('league','bracket')),
      stage TEXT NOT NULL,
      round_no INTEGER,
      label TEXT NOT NULL,
      team_a TEXT,
      team_b TEXT,
      best_of INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      winner_id TEXT,
      score_a INTEGER,
      score_b INTEGER,
      evidence_path TEXT,
      notes TEXT,
      approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(team_a) REFERENCES teams(id),
      FOREIGN KEY(team_b) REFERENCES teams(id),
      FOREIGN KEY(winner_id) REFERENCES teams(id)
    );
    CREATE TABLE IF NOT EXISTS match_maps (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      map_index INTEGER NOT NULL,
      mode TEXT NOT NULL,
      map_name TEXT NOT NULL,
      picked_by TEXT,
      score_a INTEGER,
      score_b INTEGER,
      winner_id TEXT,
      played INTEGER NOT NULL DEFAULT 0,
      UNIQUE(match_id,map_index),
      FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS pickban_actions (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      action_index INTEGER NOT NULL,
      action_type TEXT NOT NULL CHECK(action_type IN ('ban','pick')),
      mode TEXT NOT NULL,
      team_id TEXT NOT NULL,
      map_name TEXT,
      completed_at TEXT,
      UNIQUE(match_id,action_index),
      FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS player_stats (
      id TEXT PRIMARY KEY,
      match_map_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      kills INTEGER NOT NULL DEFAULT 0,
      deaths INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      hill_time INTEGER NOT NULL DEFAULT 0,
      objective_kills INTEGER NOT NULL DEFAULT 0,
      plants INTEGER NOT NULL DEFAULT 0,
      defuses INTEGER NOT NULL DEFAULT 0,
      overloads INTEGER NOT NULL DEFAULT 0,
      kill_overloads INTEGER NOT NULL DEFAULT 0,
      bomb_carrier_kills INTEGER NOT NULL DEFAULT 0,
      carrier_kills INTEGER NOT NULL DEFAULT 0,
      kills_as_carrier INTEGER NOT NULL DEFAULT 0,
      UNIQUE(match_map_id,player_id),
      FOREIGN KEY(match_map_id) REFERENCES match_maps(id) ON DELETE CASCADE,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS awards (
      scope_key TEXT PRIMARY KEY,
      player_id TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE SET NULL
    );
  `);

  // Migración segura para instalaciones que ya tienen resultados guardados.
  // ALTER TABLE conserva todas las filas existentes y añade los campos con valor 0.
  ensureColumn("player_stats", "assists", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("player_stats", "objective_kills", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("player_stats", "kill_overloads", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("player_stats", "bomb_carrier_kills", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("player_stats", "carrier_kills", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("player_stats", "kills_as_carrier", "INTEGER NOT NULL DEFAULT 0");

  const count = db.prepare("SELECT COUNT(*) n FROM teams").get().n;
  if (count === 0) {
    const teams = [
      ["inferno","Inferno Legion","Fuego","/assets/inferno.png","#ff5a1f","1111"],
      ["tidal","Tidal Reapers","Agua","/assets/tidal.png","#28a9ff","2222"],
      ["terra","Terra Titans","Tierra","/assets/terra.png","#91b94c","3333"],
      ["storm","Storm Vanguards","Aire","/assets/storm.png","#718dff","4444"]
    ];
    const insertTeam = db.prepare("INSERT INTO teams VALUES (?,?,?,?,?)");
    const insertUser = db.prepare("INSERT INTO users VALUES (?,?,?,?,?)");
    const insertPlayer = db.prepare("INSERT INTO players VALUES (?,?,?,?)");
    db.exec("BEGIN");
    try {
      for (const [tid,name,element,logo,color,pin] of teams) {
        insertTeam.run(tid,name,element,logo,color);
        insertUser.run(id("user"),"captain",tid,`Capitán ${name}`,hashPin(pin));
        for (let i=1;i<=4;i++) insertPlayer.run(`${tid}-p${i}`,tid,`Jugador ${i}`,i===1?1:0);
      }
      insertUser.run(id("user"),"admin",null,"Administrador",hashPin("AMENO2026"));
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  }
}
initDb();

app.use(express.json({limit:"2mb"}));
app.use("/uploads", express.static(UPLOADS));
app.use(express.static(PUBLIC));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_,__,cb)=>cb(null,UPLOADS),
    filename: (_,file,cb)=>{
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
  }),
  limits:{fileSize:5*1024*1024},
  fileFilter:(_,file,cb)=>cb(null,/^image\//.test(file.mimetype))
});

function auth(requiredRole=null) {
  return (req,res,next)=>{
    const token = (req.headers.authorization||"").replace(/^Bearer\s+/,"");
    try {
      const user = jwt.verify(token,JWT_SECRET);
      if (requiredRole && user.role !== requiredRole) return res.status(403).json({error:"Sin permisos."});
      req.user=user; next();
    } catch { return res.status(401).json({error:"Sesión inválida."}); }
  };
}
function team(id){ return db.prepare("SELECT * FROM teams WHERE id=?").get(id); }
function now(){ return new Date().toISOString(); }
function shuffle(arr){
  const out=[...arr];
  for(let i=out.length-1;i>0;i--){const j=crypto.randomInt(i+1);[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
const POOLS = {
  "Hardpoint":["Sake","Colossus","Den","Scar","Gridlock","Hacienda"],
  "Search & Destroy":["Den","Gridlock","Raid","Fringe","Sake","Hacienda"],
  "Overload":["Den","Scar","Gridlock","Exposure"]
};
function sequence(bestOf=5){
  return bestOf===7
    ? ["Hardpoint","Search & Destroy","Overload","Hardpoint","Search & Destroy","Overload","Search & Destroy"]
    : ["Hardpoint","Search & Destroy","Overload","Hardpoint","Search & Destroy"];
}
function randomMaps(bestOf=5){
  const used={};
  return sequence(bestOf).map((mode,index)=>{
    used[mode] ||= [];
    const available=POOLS[mode].filter(m=>!used[mode].includes(m));
    const source=available.length?available:POOLS[mode];
    const map=source[crypto.randomInt(source.length)];
    used[mode].push(map);
    return {index,mode,map};
  });
}

const LEAGUE_MAPS_BY_ROUND = {
  1: [
    {index:0, mode:"Hardpoint", map:"Den"},
    {index:1, mode:"Search & Destroy", map:"Gridlock"},
    {index:2, mode:"Overload", map:"Den"},
    {index:3, mode:"Hardpoint", map:"Sake"},
    {index:4, mode:"Search & Destroy", map:"Fringe"}
  ],
  2: [
    {index:0, mode:"Hardpoint", map:"Sake"},
    {index:1, mode:"Search & Destroy", map:"Raid"},
    {index:2, mode:"Overload", map:"Gridlock"},
    {index:3, mode:"Hardpoint", map:"Colossus"},
    {index:4, mode:"Search & Destroy", map:"Den"}
  ],
  3: [
    {index:0, mode:"Hardpoint", map:"Scar"},
    {index:1, mode:"Search & Destroy", map:"Sake"},
    {index:2, mode:"Overload", map:"Den"},
    {index:3, mode:"Hardpoint", map:"Hacienda"},
    {index:4, mode:"Search & Destroy", map:"Raid"}
  ]
};
function fullMatch(idValue){
  const match=db.prepare("SELECT * FROM matches WHERE id=?").get(idValue);
  if(!match) return null;
  const statStmt=db.prepare("SELECT * FROM player_stats WHERE match_map_id=?");
  match.maps=db.prepare("SELECT * FROM match_maps WHERE match_id=? ORDER BY map_index").all(idValue)
    .map(map=>({...map,stats:statStmt.all(map.id)}));
  match.pickban=db.prepare("SELECT * FROM pickban_actions WHERE match_id=? ORDER BY action_index").all(idValue);
  return match;
}
function bracketLoser(match){
  if(!match||match.approved!==1||!match.winner_id||!match.team_a||!match.team_b) return null;
  return match.winner_id===match.team_a ? match.team_b : match.team_a;
}

function syncBracketProgress(){
  const rows=db.prepare(`
    SELECT id,team_a,team_b,winner_id,status,approved
    FROM matches
    WHERE phase='bracket'
  `).all();

  if(!rows.length) return {updated:0};

  const byId=Object.fromEntries(rows.map(match=>[match.id,match]));
  const winner=idValue=>{
    const match=byId[idValue];
    return match&&match.approved===1 ? match.winner_id : null;
  };
  const loser=idValue=>bracketLoser(byId[idValue]);

  const desired={
    WF:{teamA:winner("WB1"),teamB:winner("WB2")},
    LR1:{teamA:loser("WB1"),teamB:loser("WB2")},
    LF:{teamA:winner("LR1"),teamB:loser("WF")},
    GF:{teamA:winner("WF"),teamB:winner("LF")}
  };

  const updateMatch=db.prepare(`
    UPDATE matches
    SET team_a=?,team_b=?,winner_id=NULL,score_a=NULL,score_b=NULL,
        evidence_path=NULL,notes=NULL,status=?,approved=0,updated_at=?
    WHERE id=?
  `);
  const promoteWaiting=db.prepare(`
    UPDATE matches
    SET status='pickban',updated_at=?
    WHERE id=? AND status='waiting' AND team_a IS NOT NULL AND team_b IS NOT NULL
  `);
  const mapCount=db.prepare("SELECT COUNT(*) n FROM match_maps WHERE match_id=?");
  const pickBanCount=db.prepare("SELECT COUNT(*) n FROM pickban_actions WHERE match_id=?");

  let updated=0;

  for(const [matchId,next] of Object.entries(desired)){
    const current=byId[matchId];
    if(!current) continue;

    const nextA=next.teamA||null;
    const nextB=next.teamB||null;
    const changed=current.team_a!==nextA||current.team_b!==nextB;

    if(changed){
      // No sobrescribir un cruce que ya tenga un resultado aprobado o pendiente.
      // En cruces aún no jugados se eliminan mapas/Pick & Ban anteriores para
      // evitar que queden asociados a participantes diferentes.
      const locked=current.approved===1||current.status==="pending"||current.status==="completed";
      if(!locked){
        if(mapCount.get(matchId).n) db.prepare("DELETE FROM match_maps WHERE match_id=?").run(matchId);
        if(pickBanCount.get(matchId).n) db.prepare("DELETE FROM pickban_actions WHERE match_id=?").run(matchId);
        const status=nextA&&nextB ? "pickban" : "waiting";
        updateMatch.run(nextA,nextB,status,now(),matchId);
        current.team_a=nextA;
        current.team_b=nextB;
        current.status=status;
        updated++;
      }
    }else if(nextA&&nextB&&current.status==="waiting"){
      promoteWaiting.run(now(),matchId);
      current.status="pickban";
      updated++;
    }
  }

  return {updated};
}

function standings(){
  const teams=db.prepare("SELECT * FROM teams").all().map(t=>({...t,played:0,wins:0,losses:0,maps_won:0,maps_lost:0,points:0}));
  const by=Object.fromEntries(teams.map(t=>[t.id,t]));
  const matches=db.prepare("SELECT * FROM matches WHERE phase='league' AND approved=1").all();
  for(const m of matches){
    const a=by[m.team_a],b=by[m.team_b]; if(!a||!b) continue;
    a.played++;b.played++;
    if(m.winner_id===a.id){a.wins++;b.losses++;a.points+=3}else{b.wins++;a.losses++;b.points+=3}
    const maps=db.prepare("SELECT * FROM match_maps WHERE match_id=? AND played=1").all(m.id);
    for(const mm of maps){
      if(mm.winner_id===a.id){a.maps_won++;b.maps_lost++}else{b.maps_won++;a.maps_lost++}
    }
  }
  teams.forEach(t=>t.diff=t.maps_won-t.maps_lost);
  return teams.sort((a,b)=>b.wins-a.wins||b.diff-a.diff||b.maps_won-a.maps_won||a.name.localeCompare(b.name))
    .map((t,i)=>({...t,position:i+1}));
}
const IMPACT_POINTS = Object.freeze({
  kills:100,
  assists:100,
  objectiveKills:125,
  hillBlock:15,
  overloads:300,
  carrierKills:125,
  killsAsCarrier:125,
  plants:100,
  defuses:100
});

const PERFORMANCE_WEIGHTS = Object.freeze({
  kd:0.35,
  objectiveScore:0.25,
  killsPerMap:0.30,
  assistsPerMap:0.10
});

function addImpactScore(row){
  const maps=Number(row.maps||row.maps_played||0);
  const kills=Number(row.kills||0);
  const deaths=Number(row.deaths||0);
  const assists=Number(row.assists||0);
  const hillBlocks=Math.floor(Number(row.hill_time||0)/5);

  // Objective Score utilizado por el rating Mapa Neutral:
  // Hardpoint: Objective Kills y Hill Time.
  // Overload: Overloads, Carrier Kills y Kills as Carrier.
  // Search & Destroy: Plants y Defuses.
  const objective_score=
    Number(row.objective_kills||0)*IMPACT_POINTS.objectiveKills +
    hillBlocks*IMPACT_POINTS.hillBlock +
    Number(row.overloads||0)*IMPACT_POINTS.overloads +
    Number(row.carrier_kills||0)*IMPACT_POINTS.carrierKills +
    Number(row.kills_as_carrier||0)*IMPACT_POINTS.killsAsCarrier +
    Number(row.plants||0)*IMPACT_POINTS.plants +
    Number(row.defuses||0)*IMPACT_POINTS.defuses;

  // Puntaje acumulado informativo para estadísticas de equipos.
  const impact_score=
    kills*IMPACT_POINTS.kills +
    assists*IMPACT_POINTS.assists +
    objective_score;

  return {
    ...row,
    hill_blocks:hillBlocks,
    objective_score,
    objective_score_per_map:maps ? objective_score/maps : 0,
    impact_score,
    kd:deaths ? kills/deaths : kills,
    kills_per_map:maps ? kills/maps : 0,
    assists_per_map:maps ? assists/maps : 0
  };
}

function applyPerformanceRating(rows){
  const bestKd=Math.max(0,...rows.map(r=>Number(r.kd||0)));
  const bestObjectiveScorePerMap=Math.max(
    0,
    ...rows.map(r=>Number(r.objective_score_per_map||0))
  );
  const bestKillsPerMap=Math.max(0,...rows.map(r=>Number(r.kills_per_map||0)));
  const bestAssistsPerMap=Math.max(0,...rows.map(r=>Number(r.assists_per_map||0)));

  return rows.map(row=>{
    const kd_normalized=bestKd
      ? (Number(row.kd||0)/bestKd)*100
      : 0;
    const objective_score_per_map_normalized=bestObjectiveScorePerMap
      ? (Number(row.objective_score_per_map||0)/bestObjectiveScorePerMap)*100
      : 0;
    const kills_per_map_normalized=bestKillsPerMap
      ? (Number(row.kills_per_map||0)/bestKillsPerMap)*100
      : 0;
    const assists_per_map_normalized=bestAssistsPerMap
      ? (Number(row.assists_per_map||0)/bestAssistsPerMap)*100
      : 0;

    const performance_rating=
      kd_normalized*PERFORMANCE_WEIGHTS.kd +
      objective_score_per_map_normalized*PERFORMANCE_WEIGHTS.objectiveScore +
      kills_per_map_normalized*PERFORMANCE_WEIGHTS.killsPerMap +
      assists_per_map_normalized*PERFORMANCE_WEIGHTS.assistsPerMap;

    return {
      ...row,
      kd_normalized,
      objective_score_per_map_normalized,
      // Alias conservado para no romper interfaces antiguas.
      objective_score_normalized:objective_score_per_map_normalized,
      kills_per_map_normalized,
      assists_per_map_normalized,
      performance_rating
    };
  }).sort((a,b)=>
    b.performance_rating-a.performance_rating ||
    b.kd-a.kd ||
    b.objective_score_per_map-a.objective_score_per_map ||
    b.kills_per_map-a.kills_per_map ||
    b.assists_per_map-a.assists_per_map ||
    String(a.name).localeCompare(String(b.name),"es")
  );
}

function playerRanking(filters={}){
  const conditions=["m.approved=1"];
  const params=[];
  if(filters.phase){conditions.push("m.phase=?");params.push(filters.phase)}
  if(filters.roundNo){conditions.push("m.round_no=?");params.push(filters.roundNo)}
  if(filters.matchId){conditions.push("m.id=?");params.push(filters.matchId)}
  if(filters.teamId){conditions.push("p.team_id=?");params.push(filters.teamId)}
  if(filters.mode){conditions.push("mm.mode=?");params.push(filters.mode)}
  const eligible=conditions.join(" AND ");

  const rows=db.prepare(`
    SELECT p.id,p.name,p.team_id,t.name team_name,t.logo,t.color,
      COUNT(DISTINCT CASE WHEN ${eligible} THEN ps.match_map_id END) maps,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.kills ELSE 0 END),0) kills,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.deaths ELSE 0 END),0) deaths,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.assists ELSE 0 END),0) assists,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.hill_time ELSE 0 END),0) hill_time,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.objective_kills ELSE 0 END),0) objective_kills,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.plants ELSE 0 END),0) plants,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.defuses ELSE 0 END),0) defuses,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.overloads ELSE 0 END),0) overloads,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.carrier_kills ELSE 0 END),0) carrier_kills,
      COALESCE(SUM(CASE WHEN ${eligible} THEN ps.kills_as_carrier ELSE 0 END),0) kills_as_carrier
    FROM players p
    JOIN teams t ON t.id=p.team_id
    LEFT JOIN player_stats ps ON ps.player_id=p.id
    LEFT JOIN match_maps mm ON mm.id=ps.match_map_id
    LEFT JOIN matches m ON m.id=mm.match_id
    GROUP BY p.id
  `).all(...params,...params,...params,...params,...params,...params,...params,...params,...params,...params,...params);

  const activeRows=rows.map(addImpactScore).filter(r=>!filters.onlyActive||r.maps>0);
  return applyPerformanceRating(activeRows)
    .map((r,index)=>({...r,position:index+1}));
}
function playerStats(){ return playerRanking(); }

function teamStats(){
  const rows = db.prepare(`
    SELECT t.id,t.name,t.logo,t.color,
      COUNT(DISTINCT CASE WHEN m.approved=1 THEN m.id END) matches_played,
      COUNT(DISTINCT CASE WHEN m.approved=1 AND m.winner_id=t.id THEN m.id END) matches_won,
      COUNT(DISTINCT CASE WHEN m.approved=1 AND m.winner_id IS NOT NULL AND m.winner_id<>t.id THEN m.id END) matches_lost,
      COUNT(DISTINCT CASE WHEN m.approved=1 AND mm.played=1 THEN mm.id END) maps_played,
      COUNT(DISTINCT CASE WHEN m.approved=1 AND mm.played=1 AND mm.winner_id=t.id THEN mm.id END) maps_won,
      COUNT(DISTINCT CASE WHEN m.approved=1 AND mm.played=1 AND mm.winner_id IS NOT NULL AND mm.winner_id<>t.id THEN mm.id END) maps_lost,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.kills ELSE 0 END),0) kills,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.deaths ELSE 0 END),0) deaths,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.assists ELSE 0 END),0) assists,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.hill_time ELSE 0 END),0) hill_time,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.objective_kills ELSE 0 END),0) objective_kills,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.plants ELSE 0 END),0) plants,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.defuses ELSE 0 END),0) defuses,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.overloads ELSE 0 END),0) overloads,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.carrier_kills ELSE 0 END),0) carrier_kills,
      COALESCE(SUM(CASE WHEN m.approved=1 THEN ps.kills_as_carrier ELSE 0 END),0) kills_as_carrier
    FROM teams t
    LEFT JOIN matches m ON (m.team_a=t.id OR m.team_b=t.id)
    LEFT JOIN match_maps mm ON mm.match_id=m.id
    LEFT JOIN player_stats ps ON ps.match_map_id=mm.id
      AND ps.player_id IN (SELECT id FROM players WHERE team_id=t.id)
    GROUP BY t.id
  `).all().map(addImpactScore).sort((a,b)=>
    b.matches_won-a.matches_won || b.impact_score-a.impact_score || b.maps_won-a.maps_won
  );
  return rows.map((r,i)=>({...r,position:i+1,map_diff:r.maps_won-r.maps_lost}));
}

function awardFromRanking(scope,label,ranking){
  const winner=ranking.find(row=>row.maps>0)||null;
  return winner?{scope_key:scope,label,...winner}: {scope_key:scope,label,player_id:null};
}

function automaticAwards(){
  const rounds=[1,2,3].map(round=>awardFromRanking(
    `round-${round}`,
    `Mejor jugador · Jornada ${round}`,
    playerRanking({phase:"league",roundNo:round,onlyActive:true})
  ));
  const tournament=awardFromRanking("tournament","Mejor jugador del torneo",playerRanking({onlyActive:true}));
  const grandFinal=awardFromRanking("grand-final","MVP de la Grand Final",playerRanking({matchId:"GF",onlyActive:true}));

  const modes=[
    {key:"hardpoint",mode:"Hardpoint",label:"Mejor jugador de Hardpoint"},
    {key:"overload",mode:"Overload",label:"Mejor jugador de Overload"},
    {key:"search-destroy",mode:"Search & Destroy",label:"Mejor jugador de Search & Destroy"}
  ].map(item=>({
    key:item.key,
    mode:item.mode,
    ...awardFromRanking(
      `mode-${item.key}`,
      item.label,
      playerRanking({mode:item.mode,onlyActive:true})
    )
  }));

  const teams=db.prepare("SELECT id,name,logo,color FROM teams ORDER BY name").all();
  const overallRanking=playerRanking({onlyActive:true});
  const teamLeaders=teams.map(team=>({
    team,
    ...awardFromRanking(
      `team-${team.id}`,
      `Mejor jugador de ${team.name}`,
      overallRanking.filter(player=>player.team_id===team.id)
    )
  }));
  return {rounds,tournament,grandFinal,modes,teamLeaders};
}

function rankings(){
  return {
    overall:playerRanking(),
    league:playerRanking({phase:"league",onlyActive:true}),
    bracket:playerRanking({phase:"bracket",onlyActive:true}),
    grandFinal:playerRanking({matchId:"GF",onlyActive:true}),
    byMode:{
      hardpoint:playerRanking({mode:"Hardpoint",onlyActive:true}),
      overload:playerRanking({mode:"Overload",onlyActive:true}),
      searchDestroy:playerRanking({mode:"Search & Destroy",onlyActive:true})
    }
  };
}

function state(){
  syncBracketProgress();
  return {
    teams:db.prepare("SELECT * FROM teams").all().map(t=>({...t,roster:db.prepare("SELECT * FROM players WHERE team_id=? ORDER BY is_captain DESC,id").all(t.id)})),
    league:db.prepare("SELECT * FROM matches WHERE phase='league' ORDER BY round_no,id").all().map(m=>fullMatch(m.id)),
    bracket:db.prepare("SELECT * FROM matches WHERE phase='bracket' ORDER BY created_at,id").all().map(m=>fullMatch(m.id)),
    standings:standings(),
    playerStats:playerStats(),
    teamStats:teamStats(),
    awards:automaticAwards(),
    rankings:rankings(),
    impactPoints:IMPACT_POINTS,
    performanceWeights:PERFORMANCE_WEIGHTS,
    ratingSystem:{
      version:"3.4.1",
      name:"Mapa Neutral",
      objectiveMetric:"objective_score_per_map",
      description:"El número total de mapas no otorga ventaja directa en el rating."
    }
  };
}

app.post("/api/login",(req,res)=>{
  const {role,teamId,pin}=req.body||{};
  const user = role==="admin"
    ? db.prepare("SELECT * FROM users WHERE role='admin' LIMIT 1").get()
    : db.prepare("SELECT * FROM users WHERE role='captain' AND team_id=? LIMIT 1").get(teamId);
  if(!user||!verifyPin(pin,user.pin_hash)) return res.status(401).json({error:"Credenciales incorrectas."});
  const token=jwt.sign({id:user.id,role:user.role,teamId:user.team_id,displayName:user.display_name},JWT_SECRET,{expiresIn:"24h"});
  res.json({token,user:{role:user.role,teamId:user.team_id,displayName:user.display_name}});
});
app.get("/api/state",(req,res)=>res.json(state()));

app.post("/api/admin/league",auth("admin"),(req,res)=>{
  const existing=db.prepare("SELECT COUNT(*) n FROM matches").get().n;
  if(existing) return res.status(400).json({error:"Ya existen partidos. Reinicia la competencia antes de generar otra liguilla."});
  const schedule=[
    [["inferno","tidal"],["terra","storm"]],
    [["inferno","terra"],["tidal","storm"]],
    [["inferno","storm"],["tidal","terra"]]
  ];
  const im=db.prepare(`INSERT INTO matches(id,phase,stage,round_no,label,team_a,team_b,best_of,status,created_at,updated_at)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  const imm=db.prepare(`INSERT INTO match_maps(id,match_id,map_index,mode,map_name) VALUES(?,?,?,?,?)`);
  db.exec("BEGIN");
  try{
    let n=1;
    schedule.forEach((round,ri)=>{
      const maps=LEAGUE_MAPS_BY_ROUND[ri+1];
      round.forEach(pair=>{
        const mid=`L${n++}`;
        im.run(mid,"league","Liguilla",ri+1,`Jornada ${ri+1}`,pair[0],pair[1],5,"scheduled",now(),now());
        maps.forEach(m=>imm.run(id("map"),mid,m.index,m.mode,m.map));
      });
    });
    db.exec("COMMIT");
    res.json(state());
  }catch(e){db.exec("ROLLBACK");res.status(500).json({error:e.message});}
});

app.post("/api/admin/bracket",auth("admin"),(req,res)=>{
  const league=db.prepare("SELECT COUNT(*) total,SUM(approved) approved FROM matches WHERE phase='league'").get();
  if(Number(league.total)!==6||Number(league.approved)!==6) return res.status(400).json({error:"La liguilla debe estar completa y aprobada."});
  if(db.prepare("SELECT COUNT(*) n FROM matches WHERE phase='bracket'").get().n) return res.status(400).json({error:"El bracket ya existe."});
  const seeds=standings().map(x=>x.id);
  const defs=[
    ["WB1","Winners","Semifinal Winners 1",seeds[0],seeds[3],5],
    ["WB2","Winners","Semifinal Winners 2",seeds[1],seeds[2],5],
    ["WF","Winners","Winners Final",null,null,5],
    ["LR1","Losers","Losers Round 1",null,null,5],
    ["LF","Losers","Losers Final",null,null,5],
    ["GF","Grand Final","Grand Final",null,null,7]
  ];
  const im=db.prepare(`INSERT INTO matches(id,phase,stage,label,team_a,team_b,best_of,status,created_at,updated_at)
                       VALUES(?,?,?,?,?,?,?,?,?,?)`);
  db.exec("BEGIN");
  try{
    defs.forEach(d=>im.run(d[0],"bracket",d[1],d[2],d[3],d[4],d[5],d[3]&&d[4]?"pickban":"waiting",now(),now()));
    db.exec("COMMIT");res.json(state());
  }catch(e){db.exec("ROLLBACK");res.status(500).json({error:e.message});}
});

app.post("/api/admin/bracket/sync",auth("admin"),(req,res)=>{
  const result=syncBracketProgress();
  res.json({...state(),bracketSync:result});
});

app.post("/api/pickban/start",auth(),(req,res)=>{
  const m=fullMatch(req.body.matchId);
  if(!m||m.phase!=="bracket"||!m.team_a||!m.team_b) return res.status(400).json({error:"Partido no disponible."});
  if(req.user.role!=="admin"&&![m.team_a,m.team_b].includes(req.user.teamId)) return res.status(403).json({error:"Solo los capitanes participantes pueden iniciar el Pick & Ban."});
  if(m.pickban.length) return res.status(400).json({error:"Pick & Ban ya iniciado."});
  const actions=[];
  ["Hardpoint","Search & Destroy","Overload"].forEach(mode=>{
    actions.push(["ban",mode,m.team_a,null]);
    actions.push(["ban",mode,m.team_b,null]);
  });
  sequence(m.best_of).forEach((mode,i)=>actions.push(["pick",mode,i%2===0?m.team_a:m.team_b,i]));
  const ins=db.prepare(`INSERT INTO pickban_actions
    (id,match_id,action_index,action_type,mode,team_id,map_name,completed_at)
    VALUES(?,?,?,?,?,?,?,?)`);
  db.exec("BEGIN");
  try{
    actions.forEach((a,i)=>ins.run(id("pb"),m.id,i,a[0],a[1],a[2],null,null));
    db.exec("COMMIT");res.json(state());
  }catch(e){db.exec("ROLLBACK");res.status(500).json({error:e.message});}
});

app.post("/api/pickban/action",auth(),(req,res)=>{
  const m=fullMatch(req.body.matchId);
  if(!m) return res.status(404).json({error:"Partido no encontrado."});
  const action=m.pickban.find(a=>!a.map_name);
  if(!action) return res.status(400).json({error:"Pick & Ban completado."});
  if(req.user.role!=="admin"&&req.user.teamId!==action.team_id) return res.status(403).json({error:"No es el turno de tu equipo."});
  const used=m.pickban.filter(a=>a.mode===action.mode&&a.map_name).map(a=>a.map_name);
  const requested=String(req.body.map||"").trim();
  const selected=POOLS[action.mode].find(map=>map.toLowerCase()===requested.toLowerCase());
  if(!selected||used.includes(selected)) return res.status(400).json({error:"Mapa no disponible."});
  db.prepare("UPDATE pickban_actions SET map_name=?,completed_at=? WHERE id=?").run(selected,now(),action.id);
  const after=fullMatch(m.id);
  if(after.pickban.every(a=>a.map_name)){
    const picks=after.pickban.filter(a=>a.action_type==="pick");
    const ins=db.prepare(`INSERT INTO match_maps
      (id,match_id,map_index,mode,map_name,picked_by,score_a,score_b,winner_id,played)
      VALUES(?,?,?,?,?,?,?,?,?,?)`);
    picks.forEach((a,i)=>ins.run(id("map"),m.id,i,a.mode,a.map_name,a.team_id,null,null,null,0));
    db.prepare("UPDATE matches SET status='scheduled',updated_at=? WHERE id=?").run(now(),m.id);
  }
  res.json(state());
});

app.post("/api/results/:matchId",auth(),upload.single("evidence"),(req,res)=>{
  const m=fullMatch(req.params.matchId);
  if(!m||!m.team_a||!m.team_b) return res.status(400).json({error:"Partido no disponible."});
  if(req.user.role!=="admin"&&![m.team_a,m.team_b].includes(req.user.teamId)) return res.status(403).json({error:"Tu equipo no participa."});

  // Solo el administrador puede modificar resultados ya aprobados.
  if(m.approved===1 && req.user.role!=="admin"){
    return res.status(403).json({error:"Este resultado ya fue aprobado. Solo el administrador puede modificarlo."});
  }
  let payload;
  try{payload=JSON.parse(req.body.payload||"{}")}catch{return res.status(400).json({error:"Datos inválidos."})}
  const maps=payload.maps||[];
  const required=Math.floor(m.best_of/2)+1;
  let wa=0,wb=0;
  for(let i=0;i<m.maps.length;i++){
    const r=maps[i]||{};
    if(r.scoreA===""||r.scoreB===""||r.scoreA==null||r.scoreB==null) continue;
    const sa=Number(r.scoreA),sb=Number(r.scoreB);
    if(!Number.isInteger(sa)||!Number.isInteger(sb)||sa===sb) return res.status(400).json({error:`Marcador inválido en M${i+1}.`});
    if(sa<0||sb<0) return res.status(400).json({error:`Marcador negativo inválido en M${i+1}.`});
    if(sa>sb)wa++;else wb++;
  }
  if(wa===0&&wb===0) return res.status(400).json({error:"Debes registrar al menos un mapa con marcador válido."});
  if(wa<required&&wb<required) return res.status(400).json({error:`La serie necesita ${required} mapas ganados. Marcador actual de serie: ${wa}-${wb}.`});
  const winner=wa>wb?m.team_a:m.team_b;

  // Desde v2.5.5 cualquier capitán participante puede enviar el resultado.
  // El administrador sigue siendo quien aprueba o rechaza el reporte.
  db.exec("BEGIN");
  try{
    // Al editar, limpia datos previos del partido para recalcular estadísticas sin duplicarlas.
    for(const mm of m.maps){
      db.prepare("DELETE FROM player_stats WHERE match_map_id=?").run(mm.id);
      db.prepare("UPDATE match_maps SET score_a=NULL,score_b=NULL,winner_id=NULL,played=0 WHERE id=?").run(mm.id);
    }

    maps.forEach((r,i)=>{
      if(r.scoreA===""||r.scoreB===""||r.scoreA==null||r.scoreB==null)return;
      const mm=m.maps[i],sa=Number(r.scoreA),sb=Number(r.scoreB),mw=sa>sb?m.team_a:m.team_b;
      db.prepare("UPDATE match_maps SET score_a=?,score_b=?,winner_id=?,played=1 WHERE id=?").run(sa,sb,mw,mm.id);
      for(const s of (r.stats||[])){
        db.prepare(`INSERT INTO player_stats(
          id,match_map_id,player_id,kills,deaths,assists,hill_time,objective_kills,
          plants,defuses,overloads,carrier_kills,kills_as_carrier
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(match_map_id,player_id) DO UPDATE SET
          kills=excluded.kills,deaths=excluded.deaths,assists=excluded.assists,
          hill_time=excluded.hill_time,objective_kills=excluded.objective_kills,
          plants=excluded.plants,defuses=excluded.defuses,overloads=excluded.overloads,
          carrier_kills=excluded.carrier_kills,kills_as_carrier=excluded.kills_as_carrier`)
          .run(
            id("stat"),mm.id,s.playerId,
            Number(s.kills)||0,Number(s.deaths)||0,Number(s.assists)||0,
            Number(s.hillTime)||0,Number(s.objectiveKills)||0,
            Number(s.plants)||0,Number(s.defuses)||0,Number(s.overloads)||0,
            Number(s.carrierKills)||0,Number(s.killsAsCarrier)||0
          );
      }
    });

    const ev=req.file?`/uploads/${req.file.filename}`:m.evidence_path;
    const statusValue=req.user.role==="admin" ? "completed" : "pending";
    const approvedValue=req.user.role==="admin" ? 1 : 0;
    db.prepare(`UPDATE matches SET winner_id=?,score_a=?,score_b=?,evidence_path=?,notes=?,status=?,approved=?,updated_at=? WHERE id=?`)
      .run(winner,wa,wb,ev,String(payload.notes||"").slice(0,1000),statusValue,approvedValue,now(),m.id);
    db.exec("COMMIT");res.json(state());
  }catch(e){db.exec("ROLLBACK");res.status(500).json({error:e.message});}
});

app.post("/api/admin/approve/:matchId",auth("admin"),(req,res)=>{
  const m=fullMatch(req.params.matchId);
  if(!m||m.status!=="pending") return res.status(400).json({error:"No hay resultado pendiente."});
  db.prepare("UPDATE matches SET approved=1,status='completed',updated_at=? WHERE id=?").run(now(),m.id);
  syncBracketProgress();
  res.json(state());
});
app.post("/api/admin/reject/:matchId",auth("admin"),(req,res)=>{
  const m=fullMatch(req.params.matchId);
  if(!m||m.status!=="pending") return res.status(400).json({error:"No hay resultado pendiente."});
  db.exec("BEGIN");
  try{
    m.maps.forEach(mm=>{db.prepare("DELETE FROM player_stats WHERE match_map_id=?").run(mm.id);db.prepare("UPDATE match_maps SET score_a=NULL,score_b=NULL,winner_id=NULL,played=0 WHERE id=?").run(mm.id);});
    db.prepare("UPDATE matches SET winner_id=NULL,score_a=NULL,score_b=NULL,evidence_path=NULL,notes=NULL,status='scheduled',approved=0,updated_at=? WHERE id=?").run(now(),m.id);
    db.exec("COMMIT");res.json(state());
  }catch(e){db.exec("ROLLBACK");res.status(500).json({error:e.message});}
});

app.post("/api/admin/reset-tournament",auth("admin"),(req,res)=>{
  const confirmation=String(req.body?.confirmation||"").trim().toUpperCase();
  if(confirmation!=="REINICIAR"){
    return res.status(400).json({error:"Confirmación incorrecta. Escribe REINICIAR."});
  }

  db.exec("BEGIN");
  try{
    // Los borrados en cascada eliminan mapas, estadísticas y acciones de Pick & Ban.
    db.prepare("DELETE FROM awards").run();
    db.prepare("DELETE FROM matches").run();
    db.exec("COMMIT");

    // Borra evidencias, pero conserva la carpeta.
    for(const file of fs.readdirSync(UPLOADS)){
      const full=path.join(UPLOADS,file);
      try{
        if(fs.statSync(full).isFile()) fs.unlinkSync(full);
      }catch{}
    }

    res.json({ok:true,message:"Torneo reiniciado.",state:state()});
  }catch(e){
    db.exec("ROLLBACK");
    res.status(500).json({error:e.message});
  }
});

app.post("/api/admin/awards",auth("admin"),(req,res)=>{
  const allowed=new Set(["round-1","round-2","round-3","tournament"]);
  const selections=req.body.selections||[];
  db.exec("BEGIN");
  try{
    for(const item of selections){
      if(!allowed.has(item.scopeKey)) continue;
      const playerId=item.playerId||null;
      if(playerId){
        const exists=db.prepare("SELECT id FROM players WHERE id=?").get(playerId);
        if(!exists) throw new Error("Jugador no válido.");
      }
      db.prepare(`
        INSERT INTO awards(scope_key,player_id,updated_at) VALUES(?,?,?)
        ON CONFLICT(scope_key) DO UPDATE SET player_id=excluded.player_id,updated_at=excluded.updated_at
      `).run(item.scopeKey,playerId,now());
    }
    db.exec("COMMIT");
    res.json(state());
  }catch(e){
    db.exec("ROLLBACK");
    res.status(500).json({error:e.message});
  }
});

app.post("/api/admin/rosters",auth("admin"),(req,res)=>{
  const teams=req.body.teams||[];
  db.exec("BEGIN");
  try{
    for(const t of teams){
      for(const p of t.roster||[]) db.prepare("UPDATE players SET name=? WHERE id=? AND team_id=?").run(String(p.name).slice(0,40),p.id,t.id);
      if(t.pin) {
        const u=db.prepare("SELECT id FROM users WHERE role='captain' AND team_id=?").get(t.id);
        db.prepare("UPDATE users SET pin_hash=? WHERE id=?").run(hashPin(t.pin),u.id);
      }
    }
    if(req.body.adminPin){
      const u=db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
      db.prepare("UPDATE users SET pin_hash=? WHERE id=?").run(hashPin(req.body.adminPin),u.id);
    }
    db.exec("COMMIT");res.json(state());
  }catch(e){db.exec("ROLLBACK");res.status(500).json({error:e.message});}
});

app.use((req,res)=>res.sendFile(path.join(PUBLIC,"index.html")));

app.listen(PORT,HOST,()=>{
  console.log(`Switcharoo Ameno Pro activo en http://localhost:${PORT}`);
  console.log(`Base de datos: ${DB_FILE}`);
});
