const S={state:null,token:localStorage.saToken||"",user:JSON.parse(localStorage.saUser||"null"),page:location.hash.slice(1)||"home",pickBanTimer:null,pickBanMatchId:null,resultDraft:null};
const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>[...r.querySelectorAll(q)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function toast(m,t="info"){const e=document.createElement("div");e.className=`toast ${t}`;e.textContent=m;$("#toast-root").append(e);setTimeout(()=>e.remove(),3500)}
async function api(url,opt={}){const h={...(opt.headers||{})};if(S.token)h.Authorization=`Bearer ${S.token}`;if(opt.body&&!(opt.body instanceof FormData))h["Content-Type"]="application/json";const r=await fetch(url,{...opt,headers:h});const d=await r.json().catch(()=>({error:"Respuesta inválida"}));if(!r.ok)throw new Error(d.error||"Error");return d}
const team=id=>S.state?.teams.find(t=>t.id===id);
const match=id=>[...(S.state?.league||[]),...(S.state?.bracket||[])].find(m=>m.id===id);
function shell(){if(!S.state)return;$("#session-label").textContent=S.user?(S.user.role==="admin"?"Administrador":team(S.user.teamId)?.name):"Invitado";$("#login-btn").textContent=S.user?"Salir":"Entrar";$$(".admin-only").forEach(x=>x.classList.toggle("hidden",S.user?.role!=="admin"));$$("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===S.page));$("#login-team").innerHTML=S.state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}
async function load(){try{S.state=await api("/api/state");shell();render()}catch(e){$("#app").innerHTML=`<section class="empty-state"><div><h2>No se pudo cargar</h2><p>${esc(e.message)}</p></div></section>`}}
function cardTeam(t){return `<article class="card team-card" style="--team:${t.color}"><div class="team-card-head"><img class="team-logo" src="${t.logo}"><div class="team-element">${esc(t.element)}</div><h3>${esc(t.name)}</h3></div><ul class="roster-list">${t.roster.map((p,i)=>`<li><span class="roster-index">${i+1}</span><strong>${esc(p.name)}</strong>${p.is_captain?'<span class="captain-tag">CAPITÁN</span>':""}</li>`).join("")}</ul></article>`}
function standings(){return `<div class="table-wrap"><table><thead><tr><th>Pos.</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>MG</th><th>MP</th><th>Dif.</th><th>Pts.</th></tr></thead><tbody>${S.state.standings.map(r=>`<tr><td><span class="rank">${r.position}</span></td><td><div class="mini-team"><img src="${r.logo}"><strong>${esc(r.name)}</strong></div></td><td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.maps_won}</td><td>${r.maps_lost}</td><td>${r.diff}</td><td>${r.points}</td></tr>`).join("")}</tbody></table></div>`}
function mapStrip(m){return `<div class="map-strip ${m.best_of===7?"bo7":""}">${m.maps.map((x,i)=>`<div class="map-chip"><small>M${i+1} · ${esc(x.mode)}</small><strong>${esc(x.map_name)}</strong></div>`).join("")}</div>`}
function canSubmit(m){if(!S.user||m.approved||m.status==="pending"||!m.team_a||!m.team_b||m.maps.length!==m.best_of)return false;return S.user.role==="admin"||[m.team_a,m.team_b].includes(S.user.teamId)}
function matchCard(m){const a=team(m.team_a),b=team(m.team_b);return `<article class="match-card ${m.approved?"completed":m.status==="pending"?"pending":""}"><div class="match-line"><div class="match-team">${a?`<img src="${a.logo}"><span>${esc(a.name)}</span>`:"Por definir"}</div><div class="vs">${m.approved?`${m.score_a}-${m.score_b}`:"VS"}</div><div class="match-team right">${b?`<span>${esc(b.name)}</span><img src="${b.logo}">`:"Por definir"}</div></div><div class="match-meta"><span class="badge">${esc(m.label)}</span><span>Bo${m.best_of}</span>${m.status==="pickban"?`<button class="btn btn-small btn-secondary" data-pb="${m.id}">Pick & Ban</button>`:""}${canSubmit(m)?`<button class="btn btn-small btn-gold" data-result="${m.id}">Subir resultado</button>`:""}${m.status==="pending"&&S.user?.role==="admin"?`<button class="btn btn-small btn-success" data-approve="${m.id}">Aprobar</button><button class="btn btn-small btn-danger" data-reject="${m.id}">Rechazar</button>`:""}</div>${m.maps.length?mapStrip(m):""}</article>`}
function head(t,s,a=""){return `<div class="page-head"><div><h2>${t}</h2><p>${s}</p></div><div class="page-actions">${a}</div></div>`}
function home(){return `<section class="hero"><div class="hero-copy"><div class="eyebrow">PLATAFORMA OFICIAL</div><h2>SWITCHAROO<br><span>AMENO</span></h2><p>Liguilla, brackets, pick & ban, resultados y estadísticas en una sola plataforma.</p></div><img class="hero-logo" src="/assets/league.png"></section><h3 class="section-title">Clasificación</h3><section class="card card-body">${standings()}</section><h3 class="section-title">Equipos</h3><section class="grid grid-4">${S.state.teams.map(cardTeam).join("")}</section>`}
function teamsPage(){return head("Equipos","Rosters oficiales de cuatro jugadores.")+`<section class="grid grid-4">${S.state.teams.map(cardTeam).join("")}</section>`}
function leaguePage(){const a=S.user?.role==="admin"?`<button id="gen-league" class="btn btn-gold">Generar liguilla</button>`:"";return head("Liguilla","Todos contra todos · 3 jornadas · Bo5",a)+(S.state.league.length?`<section class="card card-body">${standings()}</section><h3 class="section-title">Jornadas</h3><section class="grid grid-3">${[1,2,3].map(r=>`<article class="card card-body"><h3>Jornada ${r}</h3>${S.state.league.filter(m=>m.round_no===r).map(matchCard).join("")}</article>`).join("")}</section>`:`<section class="empty-state"><div><h2>Liguilla pendiente</h2><p class="muted">El administrador debe generarla.</p></div></section>`)}
function bracketPage(){const a=S.user?.role==="admin"?`<button id="gen-bracket" class="btn btn-gold">Generar brackets</button>`:"";return head("Brackets","Winners, Losers y Grand Final.",a)+(S.state.bracket.length?`<section class="grid grid-2">${S.state.bracket.map(m=>`<article class="card card-body">${matchCard(m)}</article>`).join("")}</section>`:`<section class="empty-state"><div><h2>Bracket pendiente</h2><p class="muted">Debe finalizar la liguilla.</p></div></section>`)}
function awardCard(a,label){
  return `<article class="card award-card">
    <div class="award-kicker">${esc(label)}</div>
    ${a?.player_id?`<div class="award-player"><img src="${a.logo}"><div><strong>${esc(a.player_name)}</strong><span>${esc(a.team_name)}</span></div></div>`:`<div class="award-empty">Pendiente de seleccionar</div>`}
  </article>`;
}
function teamStatsTable(){
  return `<div class="table-wrap"><table><thead><tr>
    <th>Pos.</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>MG</th><th>MP</th><th>Dif.</th>
    <th>Bajas</th><th>Muertes</th><th>K/D</th><th>Hill Time</th><th>Plantadas</th><th>Desplantadas</th><th>Overloads</th>
  </tr></thead><tbody>${S.state.teamStats.map(t=>`<tr>
    <td><span class="rank">${t.position}</span></td>
    <td><div class="mini-team"><img src="${t.logo}"><strong>${esc(t.name)}</strong></div></td>
    <td>${t.matches_played}</td><td>${t.matches_won}</td><td>${t.matches_lost}</td>
    <td>${t.maps_won}</td><td>${t.maps_lost}</td><td>${t.map_diff}</td>
    <td>${t.kills}</td><td>${t.deaths}</td><td>${Number(t.kd).toFixed(2)}</td>
    <td>${t.hill_time}s</td><td>${t.plants}</td><td>${t.defuses}</td><td>${t.overloads}</td>
  </tr>`).join("")}</tbody></table></div>`;
}

function finalistPlayerStats(teamId){
  return (S.state.playerStats||[])
    .filter(p=>p.team_id===teamId)
    .sort((a,b)=>b.kills-a.kills||Number(b.kd)-Number(a.kd));
}
function referencePlayers(teamId){
  return finalistPlayerStats(teamId).slice(0,2);
}
function finalTeamPanel(t,side){
  const ts=(S.state.teamStats||[]).find(x=>x.id===t.id)||{};
  const refs=referencePlayers(t.id);
  return `<article class="gf-team gf-${side}" style="--gf-color:${t.color}">
    <div class="gf-team-main">
      <img class="gf-team-logo" src="${t.logo}">
      <div><div class="eyebrow">FINALISTA</div><h3>${esc(t.name)}</h3><span>${esc(t.element)}</span></div>
    </div>
    <div class="gf-team-stats">
      <div><strong>${ts.matches_won||0}</strong><span>Series ganadas</span></div>
      <div><strong>${ts.maps_won||0}</strong><span>Mapas ganados</span></div>
      <div><strong>${Number(ts.kd||0).toFixed(2)}</strong><span>K/D equipo</span></div>
      <div><strong>${ts.kills||0}</strong><span>Bajas</span></div>
    </div>
    <div class="gf-reference">
      <h4>Jugadores referentes</h4>
      ${refs.length?refs.map((p,i)=>`<div class="gf-player">
        <span class="gf-player-rank">${i+1}</span>
        <div><strong>${esc(p.name)}</strong><small>${p.kills} bajas · K/D ${Number(p.kd).toFixed(2)}</small></div>
      </div>`).join(""):'<p class="muted">Estadísticas pendientes.</p>'}
    </div>
  </article>`;
}
function grandFinalPlayerTable(finalists){
  const ids=new Set(finalists.map(t=>t.id));
  const rows=(S.state.playerStats||[]).filter(p=>ids.has(p.team_id)).sort((a,b)=>b.kills-a.kills||Number(b.kd)-Number(a.kd));
  return `<div class="table-wrap"><table><thead><tr><th>Pos.</th><th>Jugador</th><th>Equipo</th><th>Mapas</th><th>Bajas</th><th>Muertes</th><th>K/D</th><th>Hill</th><th>Plantadas</th><th>Desplantadas</th><th>Overloads</th></tr></thead>
  <tbody>${rows.map((p,i)=>`<tr><td><span class="rank">${i+1}</span></td><td><strong>${esc(p.name)}</strong></td><td>${esc(p.team_name)}</td><td>${p.maps}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Number(p.kd).toFixed(2)}</td><td>${p.hill_time}s</td><td>${p.plants}</td><td>${p.defuses}</td><td>${p.overloads}</td></tr>`).join("")}</tbody></table></div>`;
}
function grandFinalPage(){
  const gf=(S.state.bracket||[]).find(m=>m.id==="GF");
  if(!gf||!gf.team_a||!gf.team_b){
    return head("Grand Final","La batalla definitiva del Switcharoo Ameno.")+
      `<section class="gf-empty"><img src="/assets/league.png"><div><div class="eyebrow">PRÓXIMAMENTE</div><h2>Finalistas por definir</h2><p>La Grand Final se habilitará cuando termine el Losers Final.</p><span>Formato oficial: Pick & Ban · Mejor de 7</span></div></section>`;
  }
  const a=team(gf.team_a),b=team(gf.team_b);
  const actions=[];
  if(gf.status==="pickban"||gf.pickban?.some(x=>!x.map_name)) actions.push(`<button class="btn btn-gold" data-pb="${gf.id}">Abrir Pick & Ban Bo7</button>`);
  if(canSubmit(gf)) actions.push(`<button class="btn btn-secondary" data-result="${gf.id}">Subir resultado</button>`);
  if(gf.status==="pending"&&S.user?.role==="admin") actions.push(`<button class="btn btn-success" data-approve="${gf.id}">Aprobar resultado</button><button class="btn btn-danger" data-reject="${gf.id}">Rechazar</button>`);
  return `<section class="gf-hero">
    <div class="gf-topline"><span>SWITCHAROO AMENO</span><strong>GRAND FINAL · BO7</strong><span>PICK & BAN</span></div>
    <div class="gf-versus">
      ${finalTeamPanel(a,"left")}
      <div class="gf-center">
        <img src="/assets/league.png">
        <div class="gf-vs">VS</div>
        ${gf.approved?`<div class="gf-final-score">${gf.score_a} — ${gf.score_b}</div>`:'<div class="gf-status">La batalla final</div>'}
      </div>
      ${finalTeamPanel(b,"right")}
    </div>
    <div class="gf-actions">${actions.join("")}</div>
    ${gf.maps?.length?`<div class="gf-map-section"><h3>Mapas de la Grand Final</h3>${mapStrip(gf)}</div>`:""}
  </section>
  <h3 class="section-title">Comparativa de los finalistas</h3>
  <section class="card card-body">${teamStatsTableFiltered([a.id,b.id])}</section>
  <h3 class="section-title">Estadísticas de jugadores finalistas</h3>
  <section class="card card-body">${grandFinalPlayerTable([a,b])}</section>`;
}
function teamStatsTableFiltered(ids){
  const rows=(S.state.teamStats||[]).filter(t=>ids.includes(t.id));
  return `<div class="table-wrap"><table><thead><tr><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>MG</th><th>MP</th><th>Dif.</th><th>Bajas</th><th>Muertes</th><th>K/D</th><th>Hill</th><th>Plantadas</th><th>Desplantadas</th><th>Overloads</th></tr></thead>
  <tbody>${rows.map(t=>`<tr><td><div class="mini-team"><img src="${t.logo}"><strong>${esc(t.name)}</strong></div></td><td>${t.matches_played}</td><td>${t.matches_won}</td><td>${t.matches_lost}</td><td>${t.maps_won}</td><td>${t.maps_lost}</td><td>${t.map_diff}</td><td>${t.kills}</td><td>${t.deaths}</td><td>${Number(t.kd).toFixed(2)}</td><td>${t.hill_time}s</td><td>${t.plants}</td><td>${t.defuses}</td><td>${t.overloads}</td></tr>`).join("")}</tbody></table></div>`;
}
function statsPage(){
  const by=Object.fromEntries((S.state.awards||[]).map(a=>[a.scope_key,a]));
  return head("Estadísticas","Rendimiento acumulado de jugadores y equipos durante todo el torneo.")+
  `<h3 class="section-title">Reconocimientos</h3>
  <section class="grid grid-4 awards-grid">
    ${awardCard(by["round-1"],"Mejor jugador · Jornada 1")}
    ${awardCard(by["round-2"],"Mejor jugador · Jornada 2")}
    ${awardCard(by["round-3"],"Mejor jugador · Jornada 3")}
    ${awardCard(by["tournament"],"Mejor jugador del torneo")}
  </section>
  <h3 class="section-title">Estadísticas por equipos</h3>
  <section class="card card-body">${teamStatsTable()}</section>
  <h3 class="section-title">Estadísticas por jugadores</h3>
  <section class="card card-body"><div class="table-wrap"><table><thead><tr><th>Pos.</th><th>Jugador</th><th>Equipo</th><th>Mapas</th><th>Bajas</th><th>Muertes</th><th>K/D</th><th>Hill Time</th><th>Plantadas</th><th>Desplantadas</th><th>Overloads</th></tr></thead><tbody>${S.state.playerStats.map((p,i)=>`<tr><td><span class="rank">${i+1}</span></td><td><strong>${esc(p.name)}</strong></td><td>${esc(p.team_name)}</td><td>${p.maps}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Number(p.kd).toFixed(2)}</td><td>${p.hill_time}s</td><td>${p.plants}</td><td>${p.defuses}</td><td>${p.overloads}</td></tr>`).join("")}</tbody></table></div></section>`;
}
function adminPage(){
  if(S.user?.role!=="admin")return home();
  const players=S.state.teams.flatMap(t=>t.roster.map(p=>({...p,teamName:t.name})));
  const awardBy=Object.fromEntries((S.state.awards||[]).map(a=>[a.scope_key,a.player_id]));
  const awardSelect=(scope,label)=>`<label>${label}<select data-award="${scope}">
    <option value="">Sin seleccionar</option>
    ${players.map(p=>`<option value="${p.id}" ${awardBy[scope]===p.id?"selected":""}>${esc(p.name)} · ${esc(p.teamName)}</option>`).join("")}
  </select></label>`;
  return head("Administración","Rosters, PIN, reconocimientos y aprobación de resultados.")+
  `<section class="grid grid-2">
    <article class="card card-body"><h3>Rosters y PIN</h3><form id="roster-form" class="simple-form">
      ${S.state.teams.map(t=>`<div class="admin-team-editor"><div class="admin-team-editor-head"><img src="${t.logo}"><strong>${esc(t.name)}</strong></div>${t.roster.map(p=>`<label>${p.is_captain?"Capitán":"Jugador"}<input data-player="${p.id}" data-team="${t.id}" value="${esc(p.name)}"></label>`).join("")}<label>Nuevo PIN<input type="password" data-pin="${t.id}" placeholder="Opcional"></label></div>`).join("")}
      <label>Nuevo PIN admin<input id="admin-pin" type="password" placeholder="Opcional"></label>
      <button class="btn btn-gold">Guardar rosters y PIN</button>
    </form></article>
    <div class="simple-form">
      <article class="card card-body"><h3>Mejores jugadores</h3><p class="muted">Selecciona el MVP de cada jornada y del torneo.</p>
        <form id="awards-form" class="simple-form">
          ${awardSelect("round-1","Mejor jugador · Jornada 1")}
          ${awardSelect("round-2","Mejor jugador · Jornada 2")}
          ${awardSelect("round-3","Mejor jugador · Jornada 3")}
          ${awardSelect("tournament","Mejor jugador del torneo")}
          <button class="btn btn-gold">Guardar reconocimientos</button>
        </form>
      </article>
      <article class="card card-body"><h3>Resultados pendientes</h3>${[...S.state.league,...S.state.bracket].filter(m=>m.status==="pending").map(matchCard).join("")||'<p class="muted">No hay resultados pendientes.</p>'}</article>
      <article class="card card-body danger-zone">
        <div class="danger-zone-head"><div><div class="eyebrow">ZONA DE PELIGRO</div><h3>Reiniciar torneo</h3></div><span>⚠</span></div>
        <p>Elimina liguilla, brackets, resultados, estadísticas, Pick & Ban, MVP y evidencias. Conserva equipos, jugadores y PIN.</p>
        <button id="reset-tournament" class="btn btn-danger">Reiniciar todos los datos</button>
      </article>
    </div>
  </section>`;
}
function render(){shell();const p={home,teams:teamsPage,league:leaguePage,bracket:bracketPage,grandfinal:grandFinalPage,stats:statsPage,admin:adminPage}[S.page]||home;$("#app").innerHTML=p();bind()}
function bind(){
  $$("[data-result]").forEach(b=>b.onclick=()=>openResult(b.dataset.result));
  $$("[data-approve]").forEach(b=>b.onclick=()=>review(b.dataset.approve,true));
  $$("[data-reject]").forEach(b=>b.onclick=()=>review(b.dataset.reject,false));
  $$("[data-pb]").forEach(b=>b.onclick=()=>openPickBan(b.dataset.pb));
  if($("#gen-league"))$("#gen-league").onclick=async()=>{try{S.state=await api("/api/admin/league",{method:"POST",body:"{}"});toast("Liguilla generada","success");render()}catch(e){toast(e.message,"error")}};
  if($("#gen-bracket"))$("#gen-bracket").onclick=async()=>{try{S.state=await api("/api/admin/bracket",{method:"POST",body:"{}"});toast("Bracket generado","success");render()}catch(e){toast(e.message,"error")}};
  if($("#roster-form"))$("#roster-form").onsubmit=saveRosters;
  if($("#awards-form"))$("#awards-form").onsubmit=saveAwards;
  if($("#reset-tournament"))$("#reset-tournament").onclick=resetTournament;
}
async function review(id,ok){try{S.state=await api(`/api/admin/${ok?"approve":"reject"}/${id}`,{method:"POST",body:"{}"});toast(ok?"Aprobado":"Rechazado","success");render()}catch(e){toast(e.message,"error")}}
function resultFieldsForMode(mode){
  if(mode==="Hardpoint") return ["kills","deaths","hillTime"];
  if(mode==="Search & Destroy") return ["kills","deaths","plants","defuses"];
  return ["kills","deaths","overloads"];
}
function resultFieldLabel(field){
  return {kills:"Bajas",deaths:"Muertes",hillTime:"Hill Time",plants:"Plantadas",defuses:"Desplantadas",overloads:"Overloads"}[field]||field;
}
function emptyMapDraft(m,a,b){
  return {scoreA:"",scoreB:"",stats:[...a.roster,...b.roster].map(p=>({playerId:p.id,kills:0,deaths:0,hillTime:0,plants:0,defuses:0,overloads:0}))};
}
function openResult(id){
  const m=match(id),a=team(m.team_a),b=team(m.team_b);
  S.resultDraft={
    matchId:id,current:0,
    maps:m.maps.map(()=>emptyMapDraft(m,a,b)),
    notes:"",evidence:null
  };
  $("#result-modal").showModal();
  renderResultWizard();
}
function seriesScore(){
  const m=match(S.resultDraft.matchId);
  let a=0,b=0;
  S.resultDraft.maps.forEach(x=>{
    if(x.scoreA===""||x.scoreB==="")return;
    const sa=Number(x.scoreA),sb=Number(x.scoreB);
    if(sa>sb)a++;else if(sb>sa)b++;
  });
  return {a,b,needed:Math.floor(m.best_of/2)+1};
}
function syncCurrentResultMap(){
  const d=S.resultDraft;if(!d)return;
  const i=d.current,map=d.maps[i];
  const sa=$("[data-wizard-score-a]"),sb=$("[data-wizard-score-b]");
  if(sa)map.scoreA=sa.value;if(sb)map.scoreB=sb.value;
  $$("[data-wizard-stat]").forEach(input=>{
    const [playerId,field]=input.dataset.wizardStat.split(":");
    const row=map.stats.find(x=>x.playerId===playerId);
    if(row)row[field]=Number(input.value)||0;
  });
  if($("#wizard-notes"))d.notes=$("#wizard-notes").value;
  if($("#wizard-evidence")?.files?.[0])d.evidence=$("#wizard-evidence").files[0];
}
function adjustWizardScore(side,delta){
  const input=$(side==="a"?"[data-wizard-score-a]":"[data-wizard-score-b]");
  input.value=Math.max(0,(Number(input.value)||0)+delta);
}
function renderResultWizard(){
  const d=S.resultDraft,m=match(d.matchId),a=team(m.team_a),b=team(m.team_b),i=d.current,mm=m.maps[i],map=d.maps[i];
  const ss=seriesScore(),finished=ss.a>=ss.needed||ss.b>=ss.needed;
  const fields=resultFieldsForMode(mm.mode);
  const players=[...a.roster,...b.roster];
  const progress=Math.round(((i+1)/m.best_of)*100);
  $("#result-root").innerHTML=`
    <div class="rw-header">
      <div><div class="eyebrow">REGISTRO RÁPIDO DE RESULTADOS</div><h2>${esc(m.label)} · Bo${m.best_of}</h2><p>${esc(a.name)} vs ${esc(b.name)}</p></div>
      <div class="rw-series-score"><div><img src="${a.logo}"><strong>${ss.a}</strong></div><span>SERIE</span><div><strong>${ss.b}</strong><img src="${b.logo}"></div></div>
    </div>
    <div class="rw-progress"><span style="width:${progress}%"></span></div>
    <div class="rw-steps">${m.maps.map((x,n)=>`<button type="button" data-rw-step="${n}" class="${n===i?"active":""} ${d.maps[n].scoreA!==""?"filled":""}"><small>M${n+1}</small><strong>${esc(x.map_name)}</strong></button>`).join("")}</div>
    <div class="rw-map-card">
      <div class="rw-map-title"><span>M${i+1}</span><div><strong>${esc(mm.map_name)}</strong><small>${esc(mm.mode)}</small></div></div>
      <div class="rw-scoreboard">
        <div class="rw-score-team"><img src="${a.logo}"><strong>${esc(a.name)}</strong></div>
        <div class="rw-score-control"><button type="button" data-score="a:-1">−</button><input data-wizard-score-a type="number" min="0" value="${esc(map.scoreA)}" placeholder="0"><button type="button" data-score="a:1">+</button></div>
        <div class="rw-score-divider">VS</div>
        <div class="rw-score-control"><button type="button" data-score="b:-1">−</button><input data-wizard-score-b type="number" min="0" value="${esc(map.scoreB)}" placeholder="0"><button type="button" data-score="b:1">+</button></div>
        <div class="rw-score-team right"><strong>${esc(b.name)}</strong><img src="${b.logo}"></div>
      </div>
      <details class="rw-stats" ${i===0?"open":""}>
        <summary>Agregar estadísticas de jugadores <span>(${fields.map(resultFieldLabel).join(", ")})</span></summary>
        <div class="rw-player-grid">
          ${[a,b].map(t=>`<div class="rw-team-stats"><h4><img src="${t.logo}">${esc(t.name)}</h4>${t.roster.map(p=>{
            const row=map.stats.find(x=>x.playerId===p.id);
            return `<div class="rw-player-row"><strong>${esc(p.name)}</strong>${fields.map(f=>`<label><span>${resultFieldLabel(f)}</span><input data-wizard-stat="${p.id}:${f}" type="number" min="0" value="${row[f]}"></label>`).join("")}</div>`;
          }).join("")}</div>`).join("")}
        </div>
      </details>
    </div>
    <div class="rw-navigation">
      <button type="button" id="rw-prev" class="btn btn-secondary" ${i===0?"disabled":""}>← Mapa anterior</button>
      <span>Gana la serie quien llegue a ${ss.needed} mapas</span>
      ${i<m.best_of-1&&!finished?'<button type="button" id="rw-next" class="btn btn-gold">Guardar y continuar →</button>':'<button type="button" id="rw-review" class="btn btn-gold">Revisar y enviar →</button>'}
    </div>`;
  $$("[data-score]").forEach(btn=>btn.onclick=()=>{const [side,delta]=btn.dataset.score.split(":");adjustWizardScore(side,Number(delta))});
  $$("[data-rw-step]").forEach(btn=>btn.onclick=()=>{syncCurrentResultMap();d.current=Number(btn.dataset.rwStep);renderResultWizard()});
  if($("#rw-prev"))$("#rw-prev").onclick=()=>{syncCurrentResultMap();d.current=Math.max(0,d.current-1);renderResultWizard()};
  if($("#rw-next"))$("#rw-next").onclick=()=>{syncCurrentResultMap();const x=d.maps[d.current];if(x.scoreA===""||x.scoreB===""||Number(x.scoreA)===Number(x.scoreB)){toast("Ingresa un marcador válido para continuar.","error");return}d.current++;renderResultWizard()};
  if($("#rw-review"))$("#rw-review").onclick=()=>{syncCurrentResultMap();renderResultReview()};
}
function renderResultReview(){
  const d=S.resultDraft,m=match(d.matchId),a=team(m.team_a),b=team(m.team_b),ss=seriesScore();
  if(ss.a<ss.needed&&ss.b<ss.needed){toast(`La serie necesita ${ss.needed} mapas ganados.`,"error");return}
  $("#result-root").innerHTML=`
    <div class="rw-review">
      <div class="eyebrow">CONFIRMAR RESULTADO</div><h2>${esc(a.name)} ${ss.a} — ${ss.b} ${esc(b.name)}</h2>
      <div class="rw-review-maps">${m.maps.map((mm,i)=>{const x=d.maps[i];return x.scoreA===""?"":`<div><span>M${i+1}</span><strong>${esc(mm.map_name)}</strong><small>${x.scoreA} — ${x.scoreB}</small></div>`}).join("")}</div>
      <div class="result-grid">
        <label>Evidencia opcional<input id="wizard-evidence" type="file" accept="image/*"></label>
        <label>Notas opcionales<textarea id="wizard-notes">${esc(d.notes)}</textarea></label>
      </div>
      <div class="rw-navigation"><button type="button" id="rw-edit" class="btn btn-secondary">← Editar mapas</button><button type="button" id="rw-submit" class="btn btn-gold">Enviar resultado</button></div>
    </div>`;
  $("#rw-edit").onclick=()=>renderResultWizard();
  $("#rw-submit").onclick=submitResultWizard;
}
async function submitResultWizard(){
  const d=S.resultDraft,m=match(d.matchId);
  if($("#wizard-notes"))d.notes=$("#wizard-notes").value;
  if($("#wizard-evidence")?.files?.[0])d.evidence=$("#wizard-evidence").files[0];
  const fd=new FormData();
  fd.append("payload",JSON.stringify({maps:d.maps,notes:d.notes}));
  if(d.evidence)fd.append("evidence",d.evidence);
  try{
    S.state=await api(`/api/results/${m.id}`,{method:"POST",body:fd});
    $("#result-modal").close();S.resultDraft=null;
    toast("Resultado enviado para aprobación","success");render();
  }catch(err){toast(err.message,"error")}
};
function stopPickBanRefresh(){
  if(S.pickBanTimer){clearInterval(S.pickBanTimer);S.pickBanTimer=null}
  S.pickBanMatchId=null;
}
function pickBanProgress(m){
  const done=m.pickban.filter(a=>a.map_name).length;
  const total=m.pickban.length||1;
  return Math.round((done/total)*100);
}
function renderPickBanModal(id){
  const m=match(id);
  if(!m){$("#pickban-modal").close();stopPickBanRefresh();return}
  const aTeam=team(m.team_a),bTeam=team(m.team_b);
  const action=m.pickban.find(x=>!x.map_name);
  const done=m.pickban.filter(x=>x.map_name);
  const progress=pickBanProgress(m);

  if(!action){
    $("#pickban-root").innerHTML=`<div class="pb-complete">
      <div class="pb-check">✓</div>
      <h2>Pick & Ban completado</h2>
      <p>Los mapas de la serie quedaron definidos.</p>
      <div class="pb-final-maps">${m.maps.map((x,i)=>`<div class="pb-final-map"><span>M${i+1}</span><strong>${esc(x.map_name)}</strong><small>${esc(x.mode)}</small></div>`).join("")}</div>
      <button class="btn btn-gold" data-close-pb>Cerrar</button>
    </div>`;
    $("[data-close-pb]").onclick=()=>$("#pickban-modal").close();
    stopPickBanRefresh();
    render();
    return;
  }

  const currentTeam=team(action.team_id);
  const used=m.pickban.filter(x=>x.mode===action.mode&&x.map_name).map(x=>x.map_name);
  const available=PB_POOLS[action.mode].filter(x=>!used.includes(x));
  const canAct=S.user?.role==="admin"||S.user?.teamId===action.team_id;
  const actionLabel=action.action_type==="ban"?"BANEAR":"ESCOGER";
  const actionIcon=action.action_type==="ban"?"✕":"✓";

  $("#pickban-root").innerHTML=`
    <div class="pb-header">
      <div>
        <div class="eyebrow">PICK & BAN INTERACTIVO</div>
        <h2>${esc(m.label)}</h2>
        <p>${esc(aTeam.name)} vs ${esc(bTeam.name)} · Bo${m.best_of}</p>
      </div>
      <div class="pb-score-logos">
        <img src="${aTeam.logo}" alt="${esc(aTeam.name)}">
        <span>VS</span>
        <img src="${bTeam.logo}" alt="${esc(bTeam.name)}">
      </div>
    </div>

    <div class="pb-progress-wrap">
      <div class="pb-progress-label"><span>Progreso</span><strong>${done.length}/${m.pickban.length}</strong></div>
      <div class="pb-progress"><span style="width:${progress}%"></span></div>
    </div>

    <div class="pb-turn ${canAct?"your-turn":"waiting-turn"}" style="--pb-team:${currentTeam.color}">
      <img src="${currentTeam.logo}">
      <div>
        <small>${canAct?"ES TU TURNO":"TURNO ACTUAL"}</small>
        <h3>${esc(currentTeam.name)}</h3>
        <p><strong>${actionIcon} ${actionLabel}</strong> un mapa de <strong>${esc(action.mode)}</strong></p>
      </div>
    </div>

    ${canAct?`
      <div class="pb-map-grid">
        ${available.map(map=>`<button class="pb-map-btn" data-pb-map="${esc(map)}">
          <span class="pb-map-mode">${esc(action.mode)}</span>
          <strong>${esc(map)}</strong>
          <small>${action.action_type==="ban"?"Eliminar del pool":"Agregar a la serie"}</small>
        </button>`).join("")}
      </div>
      <p class="pb-help">Toca una tarjeta para registrar la acción inmediatamente.</p>
    `:`
      <div class="pb-waiting">
        <div class="spinner"></div>
        <strong>Esperando a ${esc(currentTeam.name)}</strong>
        <p>Esta pantalla se actualiza automáticamente.</p>
      </div>
    `}

    <div class="pb-history">
      <h3>Historial</h3>
      <div class="pb-history-list">
        ${done.length?done.map((x,i)=>`<div class="pb-history-item ${x.action_type}">
          <span>${i+1}</span>
          <img src="${team(x.team_id).logo}">
          <div><strong>${x.action_type==="ban"?"BAN":"PICK"} · ${esc(x.map_name)}</strong><small>${esc(x.mode)} · ${esc(team(x.team_id).name)}</small></div>
        </div>`).join(""):'<p class="muted">Aún no se han realizado acciones.</p>'}
      </div>
    </div>`;

  $$("[data-pb-map]").forEach(btn=>btn.onclick=async()=>{
    const selected=btn.dataset.pbMap;
    $$(".pb-map-btn").forEach(x=>x.disabled=true);
    btn.classList.add("selected");
    try{
      S.state=await api("/api/pickban/action",{method:"POST",body:JSON.stringify({matchId:id,map:selected})});
      toast(`${actionLabel}: ${selected}`,"success");
      renderPickBanModal(id);
    }catch(e){
      toast(e.message,"error");
      renderPickBanModal(id);
    }
  });
}
async function refreshPickBan(){
  if(!S.pickBanMatchId||!$("#pickban-modal").open)return;
  try{
    S.state=await api("/api/state");
    renderPickBanModal(S.pickBanMatchId);
  }catch{}
}
async function openPickBan(id){
  let m=match(id);
  if(!S.user){toast("Inicia sesión como capitán o administrador.","error");return}
  if(!m.pickban.length){
    try{
      S.state=await api("/api/pickban/start",{method:"POST",body:JSON.stringify({matchId:id})});
      m=match(id);
      toast("Pick & Ban iniciado","success");
    }catch(e){toast(e.message,"error");return}
  }
  stopPickBanRefresh();
  S.pickBanMatchId=id;
  renderPickBanModal(id);
  $("#pickban-modal").showModal();
  S.pickBanTimer=setInterval(refreshPickBan,3000);
}
async function resetTournament(){
  const first=confirm("Esta acción eliminará todos los datos competitivos del torneo. Los equipos, jugadores y PIN se conservarán.\n\n¿Deseas continuar?");
  if(!first)return;
  const confirmation=prompt('Para confirmar, escribe exactamente: REINICIAR');
  if(confirmation===null)return;
  try{
    const result=await api("/api/admin/reset-tournament",{method:"POST",body:JSON.stringify({confirmation})});
    S.state=result.state;
    toast("Torneo reiniciado correctamente","success");
    S.page="admin";
    render();
  }catch(err){toast(err.message,"error")}
}
async function saveAwards(e){
  e.preventDefault();
  const selections=$$("[data-award]").map(s=>({scopeKey:s.dataset.award,playerId:s.value||null}));
  try{
    S.state=await api("/api/admin/awards",{method:"POST",body:JSON.stringify({selections})});
    toast("Reconocimientos guardados","success");
    render();
  }catch(err){toast(err.message,"error")}
}
async function saveRosters(e){e.preventDefault();const teams=S.state.teams.map(t=>({id:t.id,roster:t.roster.map(p=>({id:p.id,name:$(`[data-player="${p.id}"]`).value})),pin:$(`[data-pin="${t.id}"]`).value}));try{S.state=await api("/api/admin/rosters",{method:"POST",body:JSON.stringify({teams,adminPin:$("#admin-pin").value})});toast("Guardado","success");render()}catch(err){toast(err.message,"error")}}
$("#nav").onclick=e=>{const b=e.target.closest("[data-page]");if(b){S.page=b.dataset.page;location.hash=S.page;render()}};
$("#login-btn").onclick=()=>{if(S.user){S.user=null;S.token="";localStorage.removeItem("saUser");localStorage.removeItem("saToken");render()}else $("#login-modal").showModal()};
$("#role").onchange=()=>$("#team-label").classList.toggle("hidden",$("#role").value==="admin");
$("#login-form").onsubmit=async e=>{e.preventDefault();try{const d=await api("/api/login",{method:"POST",body:JSON.stringify({role:$("#role").value,teamId:$("#login-team").value,pin:$("#pin").value})});S.token=d.token;S.user=d.user;localStorage.saToken=S.token;localStorage.saUser=JSON.stringify(S.user);$("#login-modal").close();toast("Sesión iniciada","success");render()}catch(err){toast(err.message,"error")}};
$$("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
window.onhashchange=()=>{S.page=location.hash.slice(1)||"home";render()};
load();

$("#pickban-modal").addEventListener("close",stopPickBanRefresh);
