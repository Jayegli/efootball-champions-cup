(() => {
  const ADMIN_EMAIL = "atinyajohn001@gmail.com";
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_PUBLISHABLE_KEY;
  const $ = (id) => document.getElementById(id);
  const status = (msg, target = "status") => { $(target).textContent = msg || ""; };
  if (!url || !key || url.includes("PASTE_") || key.includes("PASTE_")) {
    status("Add your Supabase Project URL and Publishable Key in config.js, then reload.");
    $("fixtures").innerHTML = '<p class="muted">Website connection has not been configured yet.</p>';
    return;
  }
  const client = window.supabase.createClient(url, key);
  let clubs = [], matches = [], ko = {q:{},s:{},f:{}};

  const clubName = (id) => clubs[Number(id)]?.name || clubs.find(c => c.club_id === Number(id))?.name || "TBC";
  const played = (m) => m.home_score !== null && m.away_score !== null && m.home_score !== undefined && m.away_score !== undefined;
  const safe = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  async function loadData() {
    const [c,m,k] = await Promise.all([
      client.from("clubs").select("*").order("club_id"),
      client.from("matches").select("*").order("round").order("match_id"),
      client.from("knockout_state").select("data").eq("id", true).maybeSingle()
    ]);
    if (c.error || m.error || k.error) throw new Error(c.error?.message || m.error?.message || k.error?.message);
    clubs = c.data || []; matches = m.data || []; ko = k.data?.data || {q:{},s:{},f:{}};
    render();
  }

  function renderStandings() {
    const rows = clubs.map(c => ({...c,mp:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}));
    const byId = new Map(rows.map(r => [r.club_id,r]));
    matches.filter(played).forEach(m => {
      const a = byId.get(m.home_club_id), b = byId.get(m.away_club_id);
      if (!a || !b) return;
      const x = Number(m.home_score), y = Number(m.away_score);
      a.mp++; b.mp++; a.gf+=x; a.ga+=y; b.gf+=y; b.ga+=x;
      if (x>y) {a.w++;a.pts+=3;b.l++;}
      else if (x<y) {b.w++;b.pts+=3;a.l++;}
      else {a.d++;b.d++;a.pts++;b.pts++;}
    });
    rows.forEach(r => r.gd = r.gf-r.ga);
    rows.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name));
    $("standings").querySelector("tbody").innerHTML = rows.map((r,i)=>`<tr><td>${i+1}</td><td>${safe(r.name)}</td><td>${r.mp}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd>0?"+":""}${r.gd}</td><td><b>${r.pts}</b></td></tr>`).join("") || '<tr><td colspan="10">No clubs imported yet.</td></tr>';
  }

  function renderFixtures() {
    const filter = $("roundFilter").value;
    const rounds = [...new Set(matches.map(m=>m.round))].sort((a,b)=>a-b);
    const old = filter;
    $("roundFilter").innerHTML = '<option value="all">All fixtures</option>' + rounds.map(r=>`<option value="${r}">Round ${r}</option>`).join("");
    $("roundFilter").value = rounds.includes(Number(old)) ? old : "all";
    const list = matches.filter(m=>filter==="all" || String(m.round)===filter);
    $("fixtures").innerHTML = list.map(m=>`<div class="fixture"><div class="clubs"><div>${safe(clubName(m.home_club_id))}</div><div>${safe(clubName(m.away_club_id))}</div></div><div class="score">${played(m)?`${m.home_score} – ${m.away_score}`:"vs"}</div>${m.proof_path?`<a class="proof" target="_blank" rel="noopener" href="${client.storage.from("match-proofs").getPublicUrl(m.proof_path).data.publicUrl}">Proof</a>`:""}</div>`).join("") || '<p class="muted">No fixtures have been imported yet.</p>';
    $("playedCount").textContent = `${matches.filter(played).length}/${matches.length || 80}`;
  }

  function renderKnockout() {
    const stages = [["Quarter-finals","q"],["Semi-finals","s"],["Final","f"]];
    $("knockout").innerHTML = stages.map(([label,key])=>{
      const data = ko[key] || {};
      const entries = Object.entries(data);
      return `<div class="ko-card"><h3>${label}</h3>${entries.length?entries.map(([name,v])=>`<div class="ko-line"><span>${safe(name)}</span><b>${safe(typeof v==="object"?JSON.stringify(v):v)}</b></div>`).join(""):'<span class="muted">Awaiting qualification / results</span>'}</div>`;
    }).join("");
  }

  function render() { renderStandings(); renderFixtures(); renderKnockout(); }
  $("roundFilter").addEventListener("change", renderFixtures);

  $("adminOpen").addEventListener("click", async () => {
    $("adminDialog").showModal();
    const {data:{session}} = await client.auth.getSession();
    if (session?.user?.email?.toLowerCase() === ADMIN_EMAIL) showAdmin(session.user.email);
    else { $("loginPanel").hidden=false; $("adminPanel").hidden=true; }
  });

  function showAdmin(email) {
    $("loginPanel").hidden=true; $("adminPanel").hidden=false; $("adminIdentity").textContent=`Signed in as ${email}`;
    renderAdminFixtures();
  }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault(); status("Signing in…","loginMessage");
    const {data,error} = await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    if(error){status(error.message,"loginMessage");return;}
    if(data.user.email.toLowerCase() !== ADMIN_EMAIL){await client.auth.signOut();status("This account is not authorised.","loginMessage");return;}
    showAdmin(data.user.email); status("Signed in successfully.","adminMessage");
  });

  $("logout").addEventListener("click", async()=>{await client.auth.signOut();$("adminPanel").hidden=true;$("loginPanel").hidden=false;$("password").value="";status("Signed out.");});
  $("refreshAdmin").addEventListener("click",async()=>{try{await loadData();renderAdminFixtures();status("Data refreshed.","adminMessage");}catch(e){status(e.message,"adminMessage");}});

  function renderAdminFixtures() {
    $("adminFixtures").innerHTML = matches.map(m=>`<form class="edit-row" data-id="${safe(m.match_id)}">
      <div class="match-title"><b>${safe(clubName(m.home_club_id))}</b> vs <b>${safe(clubName(m.away_club_id))}</b><div class="muted">${safe(m.match_id)} • Round ${m.round}</div></div>
      <label>Home<input name="home" type="number" min="0" step="1" value="${m.home_score??""}"></label>
      <label>Away<input name="away" type="number" min="0" step="1" value="${m.away_score??""}"></label>
      <label>Screenshot<input name="proof" type="file" accept="image/jpeg,image/png,image/webp"></label>
      ${m.proof_path?`<a class="proof" target="_blank" rel="noopener" href="${client.storage.from("match-proofs").getPublicUrl(m.proof_path).data.publicUrl}">View existing proof</a>`:""}
      <button class="primary save" type="submit">Save result</button>
    </form>`).join("") || '<p class="muted">Import your backup to load the fixtures.</p>';
    $("adminFixtures").querySelectorAll("form").forEach(form=>form.addEventListener("submit",saveMatch));
  }

  async function saveMatch(e) {
    e.preventDefault();
    const form=e.currentTarget, id=form.dataset.id, m=matches.find(x=>x.match_id===id);
    const home=form.elements.home.value, away=form.elements.away.value;
    if((home==="") !== (away==="")){status("Enter both scores, or leave both blank.","adminMessage");return;}
    const update={home_score:home===""?null:Number(home),away_score:away===""?null:Number(away)};
    const file=form.elements.proof.files[0];
    if(file){
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)){status("Use a JPG, PNG or WEBP image.","adminMessage");return;}
      if(file.size>10*1024*1024){status("Screenshot must be 10 MB or smaller.","adminMessage");return;}
      const path=`${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const up=await client.storage.from("match-proofs").upload(path,file,{upsert:false,contentType:file.type});
      if(up.error){status(up.error.message,"adminMessage");return;}
      update.proof_path=path; update.proof_name=file.name;
    }
    const {error}=await client.from("matches").update(update).eq("match_id",id);
    if(error){status(error.message,"adminMessage");return;}
    await loadData();renderAdminFixtures();status(`Saved ${id}.`,"adminMessage");
  }

  function dataUrlToBlob(dataUrl) {
    const [meta,b64]=dataUrl.split(",");
    const mime=(meta.match(/data:([^;]+)/)||[])[1]||"image/jpeg";
    const bin=atob(b64); const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    return {blob:new Blob([bytes],{type:mime}),mime};
  }

  $("backupFile").addEventListener("change", async e=>{
    const file=e.target.files[0]; if(!file)return;
    if(!confirm("Import this backup? It will replace the current clubs and league fixtures.")){e.target.value="";return;}
    status("Reading backup…","adminMessage");
    try{
      const backup=JSON.parse(await file.text());
      if(!Array.isArray(backup.clubs)||!Array.isArray(backup.matches))throw new Error("Backup format not recognised.");
      const clubRows=backup.clubs.map((name,i)=>({club_id:i,name}));
      const delM=await client.from("matches").delete().gte("round",0);
      if(delM.error)throw delM.error;
      const delC=await client.from("clubs").delete().gte("club_id",0);
      if(delC.error)throw delC.error;
      const insC=await client.from("clubs").insert(clubRows);
      if(insC.error)throw insC.error;
      let done=0;
      for(const m of backup.matches){
        const row={match_id:m.id,round:Number(m.round),home_club_id:Number(m.a),away_club_id:Number(m.b),
          home_score:m.sa===""?null:Number(m.sa),away_score:m.sb===""?null:Number(m.sb),proof_path:null,proof_name:m.proofName||null};
        if(m.proof && m.proof.startsWith("data:image/")){
          const {blob,mime}=dataUrlToBlob(m.proof);
          const ext=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";
          const path=`${m.id}/imported-proof.${ext}`;
          const up=await client.storage.from("match-proofs").upload(path,blob,{upsert:true,contentType:mime});
          if(up.error)throw up.error;
          row.proof_path=path;
        }
        const ins=await client.from("matches").insert(row);
        if(ins.error)throw ins.error;
        done++;
      }
      const koData=backup.ko||{q:{},s:{},f:{}};
      const saveKo=await client.from("knockout_state").upsert({id:true,data:koData});
      if(saveKo.error)throw saveKo.error;
      await loadData();renderAdminFixtures();
      status(`Imported ${clubRows.length} clubs and ${done} fixtures, including available screenshot evidence.`,"adminMessage");
    }catch(err){status(`Import stopped: ${err.message||err}. Please do not repeat until we check the database.`,"adminMessage");}
    e.target.value="";
  });

  client.auth.onAuthStateChange((_event,session)=>{
    if(session?.user?.email?.toLowerCase()===ADMIN_EMAIL && !$("adminDialog").open) {
      // Keep the public page unchanged; admin panel opens only when requested.
    }
  });

  loadData().catch(err=>status(`Connection error: ${err.message}`));
})();