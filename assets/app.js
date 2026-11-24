/* West-Coast Gota Plant – Tool Access
   Storage: "local" (this browser only) or "supabase" (shared across all devices). Set in config.js. */
(function(){
  "use strict";
  const CFG = Object.assign({storage:"local",supabaseUrl:"",supabaseAnonKey:"",stateId:"gota"}, window.WC_CONFIG||{});
  const LS_KEY = "wc-gota-portal-v1";
  const SS_KEY = "wc-gota-session";
  const $ = id => document.getElementById(id);

  const DEFAULT_STATE = {
    plant:{name:"Gota Plant",location:"West-Coast Pharmaceutical Works Ltd."},
    tools:[
      {id:"bmr",code:"BMR",name:"BMR Tool",desc:"Batch Manufacturing Record preparation",url:""},
      {id:"pv",code:"PV",name:"PV Documentation Studio",desc:"Process validation protocol and report generator",url:"https://wcpv.vercel.app"},
      {id:"cdp",code:"CDP",name:"CDP Tool",desc:"CDP documentation tool",url:""}
    ],
    users:[
      {uid:"admin.gota",name:"Gota Plant Admin",role:"admin",active:true,salt:"wcg-a1",hash:"d4be2c11a7b71a3fb8cbc0caf03af9476648ac58fad5e0a33739cd93c417f374",tools:["bmr","pv","cdp"]},
      {uid:"bhargavi.patel",name:"Bhargavi Patel",role:"user",active:true,salt:"wcg-b1",hash:"22c832b58b357485629e3f47bb2fda2bc02b4e35bbbfcee125ed0cb5d90f79d3",tools:["bmr","pv","cdp"]}
    ]
  };

  let state=null, session=null, tab="dashboard", editingUser=null, editingTool=null, store=null;

  /* ---------- helpers ---------- */
  async function hashPw(salt,pw){
    const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(salt+":"+pw));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  function newSalt(){const a=new Uint8Array(8);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,"0")).join("");}
  const clone=o=>JSON.parse(JSON.stringify(o));
  const normId=s=>String(s||"").trim().toLowerCase();
  const safeUrl=u=>{u=String(u||"").trim();return /^https:\/\//i.test(u)?u:"";};
  const initials=s=>String(s||"?").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
  function el(tag,props,...kids){
    const e=document.createElement(tag);
    if(props) for(const k in props){
      if(k==="class") e.className=props[k];
      else if(k==="text") e.textContent=props[k];
      else if(k==="style") e.style.cssText=props[k];
      else if(k.startsWith("on")) e.addEventListener(k.slice(2),props[k]);
      else e.setAttribute(k,props[k]);
    }
    kids.flat().forEach(c=>{if(c!=null&&c!==false) e.append(c.nodeType?c:document.createTextNode(c));});
    return e;
  }
  function toast(msg,type){
    const t=el("div",{class:"toast"+(type==="error"?" error":""),text:msg});
    $("toasts").append(t);
    setTimeout(()=>{t.classList.add("out");setTimeout(()=>t.remove(),320);},2600);
  }
  function ssGet(){try{return sessionStorage.getItem(SS_KEY);}catch(e){return null;}}
  function ssSet(v){try{v?sessionStorage.setItem(SS_KEY,v):sessionStorage.removeItem(SS_KEY);}catch(e){}}
  function sanitize(s){
    s=s&&typeof s==="object"?s:{};
    return {
      plant:{name:String(s.plant?.name||"Gota Plant"),location:String(s.plant?.location||"")},
      tools:Array.isArray(s.tools)?s.tools.filter(t=>t&&t.id).map(t=>({id:String(t.id),code:String(t.code||""),name:String(t.name||""),desc:String(t.desc||""),url:String(t.url||"")})):[],
      users:Array.isArray(s.users)?s.users.filter(u=>u&&u.uid).map(u=>({uid:String(u.uid),name:String(u.name||u.uid),role:u.role==="admin"?"admin":"user",active:u.active!==false,salt:String(u.salt||""),hash:String(u.hash||""),tools:Array.isArray(u.tools)?u.tools.map(String):[]})):[]
    };
  }
  function confirmBox(title,text,yes){
    return new Promise(res=>{
      $("cTitle").textContent=title;$("cText").textContent=text;$("cYes").textContent=yes||"Remove";
      const d=$("confirmDlg");d.returnValue="";
      d.addEventListener("close",()=>res(d.returnValue==="yes"),{once:true});
      d.showModal();
    });
  }
  function countUp(node,to){
    const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduce||to===0){node.textContent=to;return;}
    const start=performance.now(),dur=700;
    (function step(now){const p=Math.min(1,(now-start)/dur);node.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step);})(start);
  }
  // ripple on buttons
  document.addEventListener("pointerdown",e=>{
    const b=e.target.closest(".btn.primary");if(!b||b.disabled)return;
    const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height);
    const sp=el("span",{class:"ripple",style:`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`});
    b.append(sp);setTimeout(()=>sp.remove(),600);
  });

  /* ---------- storage adapters ---------- */
  const LocalStore={
    label:"Device-only mode: data is saved in this browser. Set up Supabase in config.js to share it across all computers.",
    async load(){
      let s=null;try{s=JSON.parse(localStorage.getItem(LS_KEY)||"null");}catch(e){}
      if(!s){s=clone(DEFAULT_STATE);try{localStorage.setItem(LS_KEY,JSON.stringify(s));}catch(e){}}
      return s;
    },
    async save(s){localStorage.setItem(LS_KEY,JSON.stringify(s));},
    watch(){window.addEventListener("storage",e=>{if(e.key===LS_KEY){try{state=sanitize(JSON.parse(e.newValue));render();}catch(_){}}});}
  };
  function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Could not load "+src));document.head.append(s);});}
  function SupabaseStore(){
    let client=null;
    return {
      label:"Shared mode: users, tools and settings are stored in Supabase and shared on every device.",
      async load(){
        await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js");
        client=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey);
        const {data,error}=await client.from("portal_state").select("data").eq("id",CFG.stateId).maybeSingle();
        if(error) throw error;
        return data?data.data:null;
      },
      async save(s){
        const {error}=await client.from("portal_state").upsert({id:CFG.stateId,data:s,updated_at:new Date().toISOString()});
        if(error) throw error;
      },
      watch(){
        const refresh=async()=>{
          if(document.querySelector("dialog[open]"))return;
          try{const {data}=await client.from("portal_state").select("data").eq("id",CFG.stateId).maybeSingle();
            if(data){const n=sanitize(data.data);if(JSON.stringify(n)!==JSON.stringify(state)){state=n;render(true);}}}catch(e){}
        };
        setInterval(refresh,20000);
        window.addEventListener("focus",refresh);
      }
    };
  }

  let saving=Promise.resolve();
  function save(next){
    state=next;render(true);
    saving=saving.then(()=>store.save(next)).catch(e=>{console.error(e);toast("Couldn't save. Check your connection and try again.","error");});
    return saving;
  }

  /* ---------- views ---------- */
  function show(view){
    ["loadingView","loginView","setupView","appView"].forEach(v=>$(v).classList.toggle("hidden",v!==view));
    const node=$(view);
    if(view==="loginView"||view==="setupView"){
      const c=node.querySelector(".auth-card"),b=node.querySelector(".auth-brand-inner");
      [c,b].forEach(x=>{if(x){x.classList.remove("enter");void x.offsetWidth;x.classList.add("enter");}});
    }
  }
  const me=()=>state&&state.users.find(u=>u.uid===session&&u.active);

  async function boot(){
    store = (CFG.storage==="supabase"&&CFG.supabaseUrl&&CFG.supabaseAnonKey) ? SupabaseStore() : LocalStore;
    try{ const raw=await store.load(); state=raw?sanitize(raw):null; }
    catch(e){ console.error(e); toast("Shared database unreachable. Using this browser only.","error"); store=LocalStore; state=sanitize(await store.load()); }
    store.watch();
    if(!state||!state.users.some(u=>u.role==="admin")){show("setupView");return;}
    session=ssGet(); if(!me()){session=null;ssSet(null);}
    render();
  }

  let lastView="";
  function render(quiet){
    if(!state){show("setupView");return;}
    $("loginPlant").textContent=state.plant.name;
    const u=me();
    if(!u){if(session){session=null;ssSet(null);} if(lastView!=="login"){show("loginView");lastView="login";} return;}
    if(lastView!=="app"){show("appView");lastView="app";quiet=false;}
    const admin=u.role==="admin";
    if(!admin&&tab!=="dashboard")tab="dashboard";
    $("sidePlant").textContent=state.plant.name;
    $("sideLoc").textContent=state.plant.location;
    $("whoName").textContent=u.name;
    $("whoRole").textContent=admin?"Plant admin":"User";
    $("avatar").textContent=initials(u.name);
    document.querySelectorAll("#sideNav [data-admin]").forEach(b=>b.classList.toggle("hidden",!admin));
    document.querySelectorAll("#sideNav button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
    const titles={dashboard:["Dashboard",`Welcome, ${u.name.split(" ")[0]}. Open any tool assigned to you.`],
      tools:["Manage tools","Add tools and set the link each one opens."],
      users:["Manage users","Create IDs and passwords, and choose who sees which tool."],
      settings:["Plant settings","Plant name, location and backups."]};
    $("pageTitle").textContent=titles[tab][0];$("pageSub").textContent=titles[tab][1];
    ["dashboard","tools","users","settings"].forEach(t=>{
      const v=$("view-"+t),on=t===tab;v.classList.toggle("hidden",!on);
      if(on&&!quiet){v.classList.remove("enter-view");void v.offsetWidth;v.classList.add("enter-view");}
    });
    $("modeNote").textContent=store.label;
    renderStats(u,quiet);renderMyTools(u,quiet);
    if(admin){renderTools();renderUsers();renderPlant();}
  }

  function renderStats(u,quiet){
    const box=$("stats");box.replaceChildren();
    const mine=u.role==="admin"?state.tools:state.tools.filter(t=>u.tools.includes(t.id));
    const items=u.role==="admin"
      ?[["Tools",state.tools.length,true],["Users",state.users.length],["Active users",state.users.filter(x=>x.active).length],["Tools with link",state.tools.filter(t=>safeUrl(t.url)).length]]
      :[["Your tools",mine.length,true],["Ready to open",mine.filter(t=>safeUrl(t.url)).length],["Waiting for link",mine.filter(t=>!safeUrl(t.url)).length]];
    items.forEach(([l,n,hero])=>{
      const num=el("div",{class:"num",text:String(n)});
      box.append(el("div",{class:"stat"+(hero?" hero":"")},num,el("div",{class:"lbl",text:l})));
      if(!quiet)countUp(num,n);
    });
    box.classList.remove("enter");if(!quiet){void box.offsetWidth;box.classList.add("enter");}
  }

  function renderMyTools(u,quiet){
    const box=$("myTools");box.replaceChildren();
    const q=$("toolSearch").value.trim().toLowerCase();
    let list=u.role==="admin"?state.tools:state.tools.filter(t=>u.tools.includes(t.id));
    const total=list.length;
    if(q)list=list.filter(t=>(t.code+" "+t.name+" "+t.desc).toLowerCase().includes(q));
    if(!total){box.append(el("div",{class:"empty",text:"No tools assigned to you yet. Ask the plant admin to give you access."}));return;}
    if(!list.length){box.append(el("div",{class:"empty",text:"No tools match your search."}));return;}
    list.forEach(t=>{
      const url=safeUrl(t.url);
      box.append(el("article",{class:"tool-card"},
        el("div",{style:"display:flex;justify-content:space-between;align-items:flex-start;gap:8px"},
          el("div",{class:"tool-icon",text:(t.code||initials(t.name)).slice(0,4)}),
          el("span",{class:"tag "+(url?"live":"pending"),text:url?"Live":"Link pending"})),
        el("h3",{text:t.name}),
        el("p",{text:t.desc||""}),
        url?el("a",{class:"btn primary open",href:url,target:"_blank",rel:"noopener noreferrer",text:"Open "+(t.code||"tool")})
           :el("button",{class:"btn ghost open",type:"button",disabled:"",text:u.role==="admin"?"Add link in Manage tools":"Link coming soon"})
      ));
    });
    box.classList.remove("enter");if(!quiet){void box.offsetWidth;box.classList.add("enter");}
  }

  function toolChecks(container,selected){
    container.replaceChildren();
    if(!state.tools.length){container.append(el("span",{class:"muted small",text:"No tools yet. Add one in Manage tools."}));return;}
    state.tools.forEach(t=>{
      const cb=el("input",{type:"checkbox",value:t.id});cb.checked=selected.includes(t.id);
      container.append(el("label",null,cb,t.code||t.name));
    });
  }
  const checked=c=>[...c.querySelectorAll("input:checked")].map(i=>i.value);

  function renderTools(){
    const body=$("toolRows");body.replaceChildren();
    if(!state.tools.length)body.append(el("tr",null,el("td",{colspan:"4",class:"muted",text:"No tools yet. Add your first tool above."})));
    state.tools.forEach(t=>{
      const n=state.users.filter(u=>u.role==="admin"||u.tools.includes(t.id)).length,url=safeUrl(t.url);
      body.append(el("tr",null,
        el("td",null,el("div",{class:"cell-main"},el("span",{class:"mini",text:(t.code||"?").slice(0,4)}),el("div",null,el("strong",{text:t.name}),el("small",{text:t.desc})))),
        el("td",{class:"link-cell"},url?el("a",{href:url,target:"_blank",rel:"noopener noreferrer",text:url.replace(/^https:\/\//,"")}):el("span",{class:"tag pending",text:"Not set"})),
        el("td",{text:String(n)}),
        el("td",null,el("div",{class:"row-actions"},
          el("button",{class:"btn ghost small",type:"button",text:"Edit",onclick:()=>openToolDlg(t.id)}),
          el("button",{class:"btn danger small",type:"button",text:"Remove",onclick:()=>removeTool(t.id)})))
      ));
    });
    if(!$("uTools").dataset.touched)toolChecks($("uTools"),[]);
  }

  function renderUsers(){
    const body=$("userRows");body.replaceChildren();
    state.users.forEach(u=>{
      const chips=el("div");
      if(u.role==="admin")chips.append(el("span",{class:"chip",text:"All tools"}));
      else{const ts=state.tools.filter(t=>u.tools.includes(t.id));
        if(!ts.length)chips.append(el("span",{class:"muted small",text:"None"}));
        ts.forEach(t=>chips.append(el("span",{class:"chip",text:t.code||t.name})));}
      body.append(el("tr",null,
        el("td",null,el("div",{class:"cell-main"},el("span",{class:"mini round",text:initials(u.name)}),el("div",null,el("strong",{text:u.name}),el("small",{text:u.uid})))),
        el("td",{text:u.role==="admin"?"Admin":"User"}),
        el("td",null,chips),
        el("td",null,el("span",{class:"status "+(u.active?"on":"off"),text:u.active?"Active":"Blocked"})),
        el("td",null,el("div",{class:"row-actions"},
          el("button",{class:"btn ghost small",type:"button",text:"Edit",onclick:()=>openUserDlg(u.uid)}),
          el("button",{class:"btn danger small",type:"button",text:"Remove",onclick:()=>removeUser(u.uid)})))
      ));
    });
  }
  function renderPlant(){
    if(document.activeElement!==$("plantInput"))$("plantInput").value=state.plant.name;
    if(document.activeElement!==$("plantLoc"))$("plantLoc").value=state.plant.location;
  }

  /* ---------- events ---------- */
  document.querySelectorAll(".pw-toggle").forEach(b=>b.addEventListener("click",()=>{
    const i=$(b.dataset.target),show=i.type==="password";i.type=show?"text":"password";b.textContent=show?"Hide":"Show";
  }));

  $("loginForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const id=normId($("loginId").value),pw=$("loginPw").value,u=state.users.find(x=>x.uid===id);
    const fail=msg=>{$("loginErr").textContent=msg;const c=$("loginForm");c.classList.remove("shake");void c.offsetWidth;c.classList.add("shake");};
    if(!u||(await hashPw(u.salt,pw))!==u.hash)return fail("User ID or password is incorrect.");
    if(!u.active)return fail("This account is blocked. Contact the plant admin.");
    $("loginErr").textContent="";$("loginPw").value="";
    session=u.uid;ssSet(u.uid);tab="dashboard";render();
  });
  $("logoutBtn").addEventListener("click",()=>{session=null;ssSet(null);$("appView").classList.remove("nav-open");render();});

  $("setupForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const id=normId($("setupId").value),pw=$("setupPw").value,name=$("setupName").value.trim();
    if(!/^[a-z0-9._-]{3,40}$/.test(id)){$("setupErr").textContent="User ID: 3–40 letters, numbers, dots, dashes or underscores.";return;}
    if(pw.length<6){$("setupErr").textContent="Password must be at least 6 characters.";return;}
    const salt=newSalt(),base=state?clone(state):sanitize({plant:DEFAULT_STATE.plant,tools:DEFAULT_STATE.tools});
    base.users.push({uid:id,name:name||id,role:"admin",active:true,salt,hash:await hashPw(salt,pw),tools:[]});
    session=id;ssSet(id);save(base);
  });

  document.querySelectorAll("#sideNav button").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.tab;$("appView").classList.remove("nav-open");render();}));
  $("menuBtn").addEventListener("click",()=>$("appView").classList.add("nav-open"));
  $("scrim").addEventListener("click",()=>$("appView").classList.remove("nav-open"));
  $("toolSearch").addEventListener("input",()=>{const u=me();if(u)renderMyTools(u,true);});

  $("addToolForm").addEventListener("submit",e=>{
    e.preventDefault();$("toolErr").textContent="";
    const code=$("tCode").value.trim().toUpperCase(),name=$("tName").value.trim(),url=$("tUrl").value.trim(),desc=$("tDesc").value.trim();
    if(url&&!safeUrl(url)){$("toolErr").textContent="Link must start with https://";return;}
    if(state.tools.some(t=>t.code.toUpperCase()===code)){$("toolErr").textContent="A tool with code "+code+" already exists.";return;}
    const next=clone(state);
    next.tools.push({id:(code.toLowerCase().replace(/[^a-z0-9]/g,"")||"tool")+"-"+Date.now().toString(36),code,name,desc,url});
    save(next);e.target.reset();toast("Tool added: "+name);
  });
  async function removeTool(id){
    const t=state.tools.find(x=>x.id===id);if(!t)return;
    if(!await confirmBox("Remove "+t.name+"?","Everyone with access will lose this tool from their dashboard."))return;
    const next=clone(state);next.tools=next.tools.filter(x=>x.id!==id);next.users.forEach(u=>u.tools=u.tools.filter(x=>x!==id));
    save(next);toast("Tool removed: "+t.name);
  }
  function openToolDlg(id){
    const t=state.tools.find(x=>x.id===id);if(!t)return;editingTool=id;
    $("etCode").value=t.code;$("etName").value=t.name;$("etUrl").value=t.url;$("etDesc").value=t.desc;$("etErr").textContent="";
    $("toolDlg").showModal();
  }
  $("toolDlgForm").addEventListener("submit",e=>{
    e.preventDefault();
    const url=$("etUrl").value.trim(),code=$("etCode").value.trim().toUpperCase();
    if(url&&!safeUrl(url)){$("etErr").textContent="Link must start with https://";return;}
    if(state.tools.some(t=>t.id!==editingTool&&t.code.toUpperCase()===code)){$("etErr").textContent="Another tool already uses code "+code+".";return;}
    const next=clone(state),t=next.tools.find(x=>x.id===editingTool);if(!t)return;
    Object.assign(t,{code,name:$("etName").value.trim(),url,desc:$("etDesc").value.trim()});
    save(next);$("toolDlg").close();toast("Tool saved");
  });

  $("uTools").addEventListener("change",()=>{$("uTools").dataset.touched="1";});
  $("addUserForm").addEventListener("submit",async e=>{
    e.preventDefault();$("userErr").textContent="";
    const uid=normId($("uId").value),pw=$("uPw").value,name=$("uName").value.trim(),role=$("uRole").value;
    if(!/^[a-z0-9._-]{3,40}$/.test(uid)){$("userErr").textContent="User ID: 3–40 letters, numbers, dots, dashes or underscores.";return;}
    if(state.users.some(u=>u.uid===uid)){$("userErr").textContent="User ID "+uid+" is already taken.";return;}
    if(pw.length<6){$("userErr").textContent="Password must be at least 6 characters.";return;}
    const salt=newSalt(),hash=await hashPw(salt,pw),next=clone(state);
    next.users.push({uid,name,role,active:true,salt,hash,tools:checked($("uTools"))});
    save(next);e.target.reset();delete $("uTools").dataset.touched;toolChecks($("uTools"),[]);
    toast("User added: "+uid);
  });
  const adminCount=us=>us.filter(u=>u.role==="admin"&&u.active).length;
  async function removeUser(uid){
    if(uid===session){toast("You can't remove your own account.","error");return;}
    const u=state.users.find(x=>x.uid===uid);if(!u)return;
    if(adminCount(state.users.filter(x=>x.uid!==uid))<1){toast("Keep at least one active admin.","error");return;}
    if(!await confirmBox("Remove "+u.name+"?","User ID "+uid+" will no longer be able to sign in."))return;
    const next=clone(state);next.users=next.users.filter(x=>x.uid!==uid);
    save(next);toast("User removed: "+uid);
  }
  function openUserDlg(uid){
    const u=state.users.find(x=>x.uid===uid);if(!u)return;editingUser=uid;
    $("eUid").textContent="User ID: "+u.uid;$("eName").value=u.name;$("eRole").value=u.role;$("eActive").value=u.active?"1":"0";$("ePw").value="";$("eErr").textContent="";
    toolChecks($("eTools"),u.tools);$("userDlg").showModal();
  }
  $("userDlgForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const next=clone(state),u=next.users.find(x=>x.uid===editingUser);if(!u)return;
    u.name=$("eName").value.trim()||u.uid;u.role=$("eRole").value;u.active=$("eActive").value==="1";u.tools=checked($("eTools"));
    if(adminCount(next.users)<1){$("eErr").textContent="Keep at least one active admin.";return;}
    if(u.uid===session&&(!u.active||u.role!=="admin")){$("eErr").textContent="You can't block yourself or remove your own admin role.";return;}
    const pw=$("ePw").value;
    if(pw){if(pw.length<6){$("eErr").textContent="Password must be at least 6 characters.";return;}u.salt=newSalt();u.hash=await hashPw(u.salt,pw);}
    save(next);$("userDlg").close();toast(pw?"User saved and password reset":"User saved");
  });

  $("plantForm").addEventListener("submit",e=>{
    e.preventDefault();const next=clone(state);
    next.plant={name:$("plantInput").value.trim()||"Gota Plant",location:$("plantLoc").value.trim()};
    save(next);toast("Settings saved");
  });
  $("exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const a=el("a",{href:URL.createObjectURL(blob),download:"gota-plant-backup-"+new Date().toISOString().slice(0,10)+".json"});
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    toast("Backup downloaded");
  });
  $("importFile").addEventListener("change",async e=>{
    const f=e.target.files[0];e.target.value="";if(!f)return;
    try{
      const s=sanitize(JSON.parse(await f.text()));
      if(!s.users.some(u=>u.role==="admin"&&u.active))throw new Error("no admin");
      if(!await confirmBox("Restore this backup?","All current users, tools and settings will be replaced.","Restore"))return;
      if(!s.users.some(u=>u.uid===session&&u.active)){session=null;ssSet(null);}
      save(s);toast("Backup restored");
    }catch(err){toast("That file isn't a valid backup.","error");}
  });

  $("pwBtn").addEventListener("click",()=>{$("pwOld").value="";$("pwNew").value="";$("pwErr").textContent="";$("pwDlg").showModal();});
  $("pwForm").addEventListener("submit",async e=>{
    e.preventDefault();const u=me();if(!u)return;
    if((await hashPw(u.salt,$("pwOld").value))!==u.hash){$("pwErr").textContent="Current password is incorrect.";return;}
    const pw=$("pwNew").value;if(pw.length<6){$("pwErr").textContent="New password must be at least 6 characters.";return;}
    const next=clone(state),x=next.users.find(y=>y.uid===u.uid);x.salt=newSalt();x.hash=await hashPw(x.salt,pw);
    save(next);$("pwDlg").close();toast("Password changed");
  });
  document.querySelectorAll("dialog [data-close]").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));

  boot();
})();
