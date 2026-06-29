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
      hill_time INTEGER NOT NULL DEFAULT 0,
      plants INTEGER NOT NULL DEFAULT 0,
      defuses INTEGER NOT NULL DEFAULT 0,
      overloads INTEGER NOT NULL DEFAULT 0,
      UNIQUE(match_map_id,player_id),
      FOREIGN KEY(match_map_id) REFERENCES match_maps(id) ON DELETE CASCADE,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );
  `);

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
    ? ["Hardpoint","Search & Destroy","Overload","Hardpoint","Search & Destroy","Overload","Hardpoint"]
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
function fullMatch(idValue){
  const match=db.prepare("SELECT * FROM matches WHERE id=?").get(idValue);
  if(!match) return null;
  match.maps=db.prepare("SELECT * FROM match_maps WHERE match_id=? ORDER BY map_index").all(idValue);
  match.pickban=db.prepare("SELECT * FROM pickban_actions WHERE match_id=? ORDER BY action_index").all(idValue);
  return match;
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
function playerStats(){
  return db.prepare(`
    SELECT p.id,p.name,p.team_id,t.name team_name,t.logo,t.color,
      COUNT(DISTINCT ps.match_map_id) maps,
      COALESCE(SUM(ps.kills),0) kills,
      COALESCE(SUM(ps.deaths),0) deaths,
      COALESCE(SUM(ps.hill_time),0) hill_time,
      COALESCE(SUM(ps.plants),0) plants,
      COALESCE(SUM(ps.defuses),0) defuses,
      COALESCE(SUM(ps.overloads),0) overloads
    FROM players p
    JOIN teams t ON t.id=p.team_id
    LEFT JOIN player_stats ps ON ps.player_id=p.id
    GROUP BY p.id ORDER BY kills DESC, deaths ASC
  `).all().map(r=>({...r,kd:r.deaths?r.kills/r.deaths:r.kills}));
}
function state(){
  return {
    teams:db.prepare("SELECT * FROM teams").all().map(t=>({...t,roster:db.prepare("SELECT * FROM players WHERE team_id=? ORDER BY is_captain DESC,id").all(t.id)})),
    league:db.prepare("SELECT * FROM matches WHERE phase='league' ORDER BY round_no,id").all().map(m=>fullMatch(m.id)),
    bracket:db.prepare("SELECT * FROM matches WHERE phase='bracket' ORDER BY created_at,id").all().map(m=>fullMatch(m.id)),
    standings:standings(),
    playerStats:playerStats()
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
      const maps=randomMaps(5);
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

app.post("/api/pickban/start",auth(),(req,res)=>{
  const m=fullMatch(req.body.matchId);
  if(!m||m.phase!=="bracket"||!m.team_a||!m.team_b) return res.status(400).json({error:"Partido no disponible."});
  if(req.user.role!=="admin"&&req.user.teamId!==m.team_a) return res.status(403).json({error:"Debe iniciar el capitán del equipo A."});
  if(m.pickban.length) return res.status(400).json({error:"Pick & Ban ya iniciado."});
  const actions=[];
  ["Hardpoint","Search & Destroy","Overload"].forEach(mode=>{
    actions.push(["ban",mode,m.team_a,null]);
    actions.push(["ban",mode,m.team_b,null]);
  });
  sequence(m.best_of).forEach((mode,i)=>actions.push(["pick",mode,i%2===0?m.team_a:m.team_b,i]));
  const ins=db.prepare("INSERT INTO pickban_actions VALUES(?,?,?,?,?,?,?)");
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
  if(!POOLS[action.mode].includes(req.body.map)||used.includes(req.body.map)) return res.status(400).json({error:"Mapa no disponible."});
  db.prepare("UPDATE pickban_actions SET map_name=?,completed_at=? WHERE id=?").run(req.body.map,now(),action.id);
  const after=fullMatch(m.id);
  if(after.pickban.every(a=>a.map_name)){
    const picks=after.pickban.filter(a=>a.action_type==="pick");
    const ins=db.prepare("INSERT INTO match_maps VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    picks.forEach((a,i)=>ins.run(id("map"),m.id,i,a.mode,a.map_name,a.team_id,null,null,null,0));
    db.prepare("UPDATE matches SET status='scheduled',updated_at=? WHERE id=?").run(now(),m.id);
  }
  res.json(state());
});

app.post("/api/results/:matchId",auth(),upload.single("evidence"),(req,res)=>{
  const m=fullMatch(req.params.matchId);
  if(!m||!m.team_a||!m.team_b) return res.status(400).json({error:"Partido no disponible."});
  if(req.user.role!=="admin"&&![m.team_a,m.team_b].includes(req.user.teamId)) return res.status(403).json({error:"Tu equipo no participa."});
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
    if(sa>sb)wa++;else wb++;
  }
  if(wa<required&&wb<required) return res.status(400).json({error:`La serie necesita ${required} mapas ganados.`});
  const winner=wa>wb?m.team_a:m.team_b;
  if(req.user.role==="captain"&&req.user.teamId!==winner) return res.status(403).json({error:"Solo el capitán ganador puede enviar."});
  db.exec("BEGIN");
  try{
    maps.forEach((r,i)=>{
      if(r.scoreA===""||r.scoreB===""||r.scoreA==null||r.scoreB==null)return;
      const mm=m.maps[i],sa=Number(r.scoreA),sb=Number(r.scoreB),mw=sa>sb?m.team_a:m.team_b;
      db.prepare("UPDATE match_maps SET score_a=?,score_b=?,winner_id=?,played=1 WHERE id=?").run(sa,sb,mw,mm.id);
      for(const s of (r.stats||[])){
        db.prepare(`INSERT INTO player_stats(id,match_map_id,player_id,kills,deaths,hill_time,plants,defuses,overloads)
          VALUES(?,?,?,?,?,?,?,?,?)
          ON CONFLICT(match_map_id,player_id) DO UPDATE SET
          kills=excluded.kills,deaths=excluded.deaths,hill_time=excluded.hill_time,
          plants=excluded.plants,defuses=excluded.defuses,overloads=excluded.overloads`)
          .run(id("stat"),mm.id,s.playerId,Number(s.kills)||0,Number(s.deaths)||0,Number(s.hillTime)||0,Number(s.plants)||0,Number(s.defuses)||0,Number(s.overloads)||0);
      }
    });
    const ev=req.file?`/uploads/${req.file.filename}`:null;
    db.prepare(`UPDATE matches SET winner_id=?,score_a=?,score_b=?,evidence_path=?,notes=?,status='pending',approved=0,updated_at=? WHERE id=?`)
      .run(winner,wa,wb,ev,String(payload.notes||"").slice(0,1000),now(),m.id);
    db.exec("COMMIT");res.json(state());
  }catch(e){db.exec("ROLLBACK");res.status(500).json({error:e.message});}
});

app.post("/api/admin/approve/:matchId",auth("admin"),(req,res)=>{
  const m=fullMatch(req.params.matchId);
  if(!m||m.status!=="pending") return res.status(400).json({error:"No hay resultado pendiente."});
  db.prepare("UPDATE matches SET approved=1,status='completed',updated_at=? WHERE id=?").run(now(),m.id);
  // Propagate bracket teams
  if(m.id==="WB1"){db.prepare("UPDATE matches SET team_a=?,updated_at=? WHERE id='WF'").run(m.winner_id,now());db.prepare("UPDATE matches SET team_a=?,updated_at=? WHERE id='LR1'").run(m.winner_id===m.team_a?m.team_b:m.team_a,now());}
  if(m.id==="WB2"){db.prepare("UPDATE matches SET team_b=?,updated_at=? WHERE id='WF'").run(m.winner_id,now());db.prepare("UPDATE matches SET team_b=?,updated_at=? WHERE id='LR1'").run(m.winner_id===m.team_a?m.team_b:m.team_a,now());}
  if(m.id==="WF"){db.prepare("UPDATE matches SET team_a=?,updated_at=? WHERE id='GF'").run(m.winner_id,now());db.prepare("UPDATE matches SET team_b=?,updated_at=? WHERE id='LF'").run(m.winner_id===m.team_a?m.team_b:m.team_a,now());}
  if(m.id==="LR1"){db.prepare("UPDATE matches SET team_a=?,updated_at=? WHERE id='LF'").run(m.winner_id,now());}
  if(m.id==="LF"){db.prepare("UPDATE matches SET team_b=?,updated_at=? WHERE id='GF'").run(m.winner_id,now());}
  db.prepare("UPDATE matches SET status='pickban' WHERE phase='bracket' AND team_a IS NOT NULL AND team_b IS NOT NULL AND status='waiting'").run();
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
