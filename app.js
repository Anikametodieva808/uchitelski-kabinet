(()=> {
  const $ = id => document.getElementById(id);
  const cfg = window.APP_CONFIG || {};
  const BUCKET = "teacher-resources";
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const allowed = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
    "image/jpeg": "image", "image/png": "image", "image/webp": "image"
  };
  let db = null, user = null, items = [];
  const demo = [
    {id:"d1",title:"Безопасност и организация на работното място",category:"Въведение в професията",type:"Учебен материал",description:"Инструктаж, правила и работна среда."},
    {id:"d2",title:"Мащаби и основни видове линии",category:"Техническо чертане",type:"Работен лист",description:"Опорни знания и задачи за работа в час."},
    {id:"d3",title:"Основни групи строителни материали",category:"Строителни материали",type:"Презентация",description:"Кратко представяне и практическо упражнение."}
  ];
  const login = $("loginDialog"), resource = $("resourceDialog");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const iconFor = x => {
    const t = `${x.type||""} ${x.file_name||""}`.toLowerCase();
    if(t.includes("ppt") || t.includes("презента")) return ["PPT","ppt"];
    if(t.includes("pdf")) return ["PDF","pdf"];
    if(t.includes("word") || t.includes("docx")) return ["W","word"];
    if(t.includes("сним") || /\.(jpg|jpeg|png|webp)$/i.test(x.file_name||"")) return ["▧","image"];
    return ["▤",""];
  };
  function render(){
    const q = $("searchInput").value.trim().toLocaleLowerCase("bg");
    const c = $("categoryFilter").value;
    const arr = items.filter(x => (!c || x.category===c) && (!q || [x.title,x.category,x.description,x.type,x.file_name].join(" ").toLocaleLowerCase("bg").includes(q)));
    $("resourceGrid").innerHTML = arr.map(x => {
      const [symbol,kind] = iconFor(x);
      const hasFile = Boolean(x.file_path || x.url);
      const fileUrl = x.url || "";
      const links = hasFile ? `<div class="file-actions">${fileUrl ? `<a href="${esc(fileUrl)}" target="_blank" rel="noopener noreferrer">Отвори ↗</a><a class="download" href="${esc(fileUrl)}" target="_blank" rel="noopener noreferrer" download>Изтегли ↓</a>` : ""}</div>` : "";
      return `<article class="card"><div class="art ${kind}">${symbol}</div><div class="cardbody"><span class="tag">${esc(x.category||"Други")}</span><h3>${esc(x.title)}</h3><p>${esc(x.description||"Няма добавено описание.")}</p><div class="cardfoot"><span>${esc(x.type||"Материал")}${x.file_name?` · ${esc(x.file_name)}`:""}</span><span>${x.author_email?esc(x.author_email):""}</span></div>${links}</div></article>`;
    }).join("");
    $("emptyState").hidden = arr.length !== 0;
    $("backendNote").textContent = db ? (user ? "Свързана обща библиотека. Влезли сте с учителски профил." : "Материалите са общодостъпни. Влез с учителски профил, за да добавяш нови.") : "Демонстрационен изглед — за споделено качване настрой Supabase Storage.";
  }
  function showMessage(id, msg){ $(id).textContent = msg; }
  function fileExt(file){
    const name = file.name.toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";
    const valid = ["pptx","pdf","docx","jpg","jpeg","png","webp"];
    if(!valid.includes(ext)) return null;
    if(ext==="pptx" && file.type && file.type!=="application/vnd.openxmlformats-officedocument.presentationml.presentation") return null;
    if(ext==="pdf" && file.type && file.type!=="application/pdf") return null;
    if(ext==="docx" && file.type && file.type!=="application/vnd.openxmlformats-officedocument.wordprocessingml.document") return null;
    if(["jpg","jpeg"].includes(ext) && file.type && file.type!=="image/jpeg") return null;
    if(ext==="png" && file.type && file.type!=="image/png") return null;
    if(ext==="webp" && file.type && file.type!=="image/webp") return null;
    return ext;
  }
  async function refresh(){
    if(!db){ items = demo; render(); return; }
    const r = await db.from("resources").select("*").order("created_at",{ascending:false});
    if(r.error){
      items = demo;
      showMessage("backendNote","Не успях да заредя библиотеката: "+r.error.message);
    } else items = r.data || [];
    $("loginOpen").textContent = user ? "Изход" : "Вход за учители";
    render();
  }
  async function init(){
    if(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase){
      db = window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
      const r = await db.auth.getSession();
      user = r.data.session?.user || null;
      db.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;refresh();});
      await refresh();
    } else { items = demo; render(); }
  }
  $("searchInput").addEventListener("input",render);
  $("categoryFilter").addEventListener("change",render);
  document.querySelectorAll("[data-subject]").forEach(a=>a.addEventListener("click",()=>{$("categoryFilter").value=a.dataset.subject;render();}));
  $("loginOpen").addEventListener("click",async()=>{
    if(user){ if(db) await db.auth.signOut(); return; }
    login.showModal();
    showMessage("authMessage",db?"":"Supabase не е настроен. Провери config.js и README.");
  });
  $("authForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!db){showMessage("authMessage","Supabase не е настроен.");return;}
    const btn=$("signIn"); btn.disabled=true;
    const r=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    btn.disabled=false;
    showMessage("authMessage",r.error?r.error.message:"Успешен вход.");
    if(!r.error) login.close();
  });
  $("signUp").addEventListener("click",async()=>{
    if(!db){showMessage("authMessage","Supabase не е настроен.");return;}
    const email=$("email").value.trim(), password=$("password").value;
    if(!email || password.length<6){showMessage("authMessage","Въведи валиден имейл и парола от поне 6 символа.");return;}
    const btn=$("signUp");btn.disabled=true;
    const r=await db.auth.signUp({email,password});btn.disabled=false;
    showMessage("authMessage",r.error?r.error.message:"Профилът е създаден. Ако се изисква потвърждение, провери имейла си.");
  });
  $("addResource").addEventListener("click",()=>{
    showMessage("resourceMessage",user?"":"За добавяне на материали първо влез с учителски профил.");
    $("rFile").value=""; resource.showModal();
  });
  $("cancelResource").addEventListener("click",()=>resource.close());
  $("resourceForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!db || !user){showMessage("resourceMessage","Първо влез с учителски профил.");return;}
    const title=$("rTitle").value.trim(), file=$("rFile").files[0], externalUrl=$("rUrl").value.trim();
    if(!title){showMessage("resourceMessage","Въведи заглавие.");return;}
    if(!file && !externalUrl){showMessage("resourceMessage","Избери файл или добави външна връзка.");return;}
    if(externalUrl && !/^https?:\/\//i.test(externalUrl)){showMessage("resourceMessage","Връзката трябва да започва с https:// или http://");return;}
    if(file && file.size>MAX_FILE_SIZE){showMessage("resourceMessage","Файлът е по-голям от 50 MB. Избери по-малък файл.");return;}
    if(file && !fileExt(file)){showMessage("resourceMessage","Форматът не се поддържа. Използвай PPTX, PDF, DOCX, JPG, PNG или WEBP.");return;}
    const btn=$("saveResource");btn.disabled=true;
    let url=externalUrl, filePath=null, fileName=null, type=$("rType").value;
    try{
      if(file){
        showMessage("resourceMessage","Качвам файла… не затваряй прозореца.");
        const safeName=file.name.normalize("NFKD").replace(/[^\w.-]+/g,"_").replace(/^_+|_+$/g,"").slice(-120) || "material";
        filePath=`${user.id}/${Date.now()}_${safeName}`;
        const up=await db.storage.from(BUCKET).upload(filePath,file,{cacheControl:"3600",upsert:false,contentType:file.type||undefined});
        if(up.error) throw new Error(up.error.message+" — провери дали е създаден Storage bucket и са добавени политиките.");
        const pub=db.storage.from(BUCKET).getPublicUrl(filePath);
        url=pub.data.publicUrl; fileName=file.name;
        const ext=fileExt(file);
        type=ext==="pptx"?"Презентация":ext==="pdf"?"PDF документ":ext==="docx"?"Word документ":"Снимка";
      }
      const row={title,category:$("rCategory").value,type,description:$("rDescription").value.trim(),url:url||"",created_by:user.id,author_email:user.email};
      // Extra columns are optional: the file URL is kept in the existing url column for compatibility.
      const saved=await db.from("resources").insert(row);
      if(saved.error){
        if(filePath) await db.storage.from(BUCKET).remove([filePath]);
        throw new Error(saved.error.message);
      }
      resource.close(); $("resourceForm").reset(); await refresh();
    }catch(err){showMessage("resourceMessage","Неуспешно запазване: "+(err?.message||"неизвестна грешка"));}
    finally{btn.disabled=false;}
  });

  // Уроци, задачи и събития — локално запазване в браузъра
  const plannerKey = "teacherCabinetPlannerV1";

  function getPlannerData() {
    try {
      return JSON.parse(localStorage.getItem(plannerKey)) || {
        lessons: [], tasks: [], events: []
      };
    } catch {
      return { lessons: [], tasks: [], events: [] };
    }
  }

  function savePlannerData(data) {
    localStorage.setItem(plannerKey, JSON.stringify(data));
    renderPlanner();
  }

  function renderPlanner() {
    const data = getPlannerData();

    $("lessonCount").textContent = data.lessons.length;
    $("taskCount").textContent = data.tasks.filter(t => !t.done).length;
    $("eventCount").textContent = data.events.length;
    $("materialCount").textContent = items.length;

    const taskBox = $("taskEmpty");
    if (taskBox) {
      const active = data.tasks.filter(t => !t.done);
      taskBox.innerHTML = active.length
        ? active.map((t, i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #e6e1d8;text-align:left">
            <label style="display:flex;gap:10px;align-items:center">
              <input type="checkbox" data-task="${i}" ${t.done ? "checked" : ""}>
              <span>
                <strong>${esc(t.title)}</strong><br>
                <small>${esc(t.date || "Без срок")}${t.priority ? " · " + esc(t.priority) : ""}</small>
              </span>
            </label>
            <button type="button" class="secondary" data-delete-task="${i}">Изтрий</button>
          </div>`).join("")
        : "☑　Нямаш активни задачи.";
    }

    const lessonSection = $("uroci");
    const oldLessons = $("savedLessons");
    if (lessonSection && oldLessons) {
      oldLessons.innerHTML = data.lessons.length
        ? data.lessons.map((l, i) => `
          <article class="card" style="padding:16px">
            <span class="tag">${esc(l.subject || "Други")}</span>
            <h3>${esc(l.title)}</h3>
            <p>${esc(l.notes || "Няма добавени бележки.")}</p>
            <small>Клас: ${esc(l.grade || "Не е посочен")}</small>
            <button class="secondary" data-delete-lesson="${i}" style="margin-top:12px">Изтрий урока</button>
          </article>`).join("")
        : '<p class="empty">Все още няма запазени уроци.</p>';
    }

    const eventSection = $("kalendar");
    const oldEvents = $("savedEvents");
    if (eventSection && oldEvents) {
      oldEvents.innerHTML = data.events.length
        ? [...data.events].sort((a,b) => (a.date || "").localeCompare(b.date || "")).map((ev,i) => `
          <article class="card" style="padding:16px">
            <span class="tag">${esc(ev.date || "Без дата")}</span>
            <h3>${esc(ev.title)}</h3>
            <p>${esc(ev.notes || "Няма допълнителни бележки.")}</p>
            <button class="secondary" data-delete-event="${i}" style="margin-top:12px">Изтрий събитието</button>
          </article>`).join("")
        : '<p class="empty">Все още няма добавени събития.</p>';
    }
  }

  function addPlannerItem(kind) {
    const prompts = {
      lesson: [
        ["Заглавие на урока:", ""],
        ["Предмет:", "Въведение в професията"],
        ["Клас:", "8. клас"],
        ["Цели и бележки:", ""]
      ],
      task: [
        ["Каква е задачата?", ""],
        ["Срок (ГГГГ-ММ-ДД), по желание:", ""],
        ["Приоритет (Висок/Среден/Нисък):", "Среден"]
      ],
      event: [
        ["Наименование на събитието:", ""],
        ["Дата (ГГГГ-ММ-ДД):", ""],
        ["Бележки:", ""]
      ]
    };

    const answers = [];
    for (const [label, defaultValue] of prompts[kind]) {
      const answer = prompt(label, defaultValue);
      if (answer === null) return;
      answers.push(answer.trim());
    }

    if (!answers[0]) {
      alert("Моля, въведи заглавие.");
      return;
    }

    const data = getPlannerData();

    if (kind === "lesson") {
      data.lessons.push({
        title: answers[0],
        subject: answers[1],
        grade: answers[2],
        notes: answers[3],
        createdAt: new Date().toISOString()
      });
    } else if (kind === "task") {
      data.tasks.push({
        title: answers[0],
        date: answers[1],
        priority: answers[2],
        done: false
      });
    } else {
      data.events.push({
        title: answers[0],
        date: answers[1],
        notes: answers[2]
      });
    }

    savePlannerData(data);
  }

  // Добавяме отделни списъци в съответните секции
  const lessonList = document.createElement("div");
  lessonList.id = "savedLessons";
  lessonList.className = "cards";
  $("uroci").appendChild(lessonList);

  const eventList = document.createElement("div");
  eventList.id = "savedEvents";
  eventList.className = "cards";
  $("kalendar").appendChild(eventList);

  // Бутоните за създаване
  document.querySelectorAll('a[href="#uroci"]').forEach(a => {
    a.addEventListener("click", e => {
      if (e.target.closest(".quick")) {
        e.preventDefault();
        addPlannerItem("lesson");
      }
    });
  });

  document.querySelectorAll('a[href="#zadachi"]').forEach(a => {
    a.addEventListener("click", e => {
      if (e.target.closest(".quick")) {
        e.preventDefault();
        addPlannerItem("task");
      }
    });
  });

  document.querySelectorAll('a[href="#kalendar"]').forEach(a => {
    a.addEventListener("click", e => {
      if (e.target.closest(".quick")) {
        e.preventDefault();
        addPlannerItem("event");
      }
    });
  });

  $("allTasks").addEventListener("click", () => {
    const data = getPlannerData();
    const active = data.tasks.filter(t => !t.done);
    alert(active.length
      ? active.map(t => `${t.title}${t.date ? " — " + t.date : ""}`).join("\n")
      : "Нямаш активни задачи.");
  });

  $("taskEmpty").addEventListener("change", e => {
    const index = e.target.dataset.task;
    if (index === undefined) return;
    const data = getPlannerData();
    const active = data.tasks.filter(t => !t.done);
    if (active[index]) {
      const task = active[index];
      const realIndex = data.tasks.indexOf(task);
      data.tasks[realIndex].done = e.target.checked;
      savePlannerData(data);
    }
  });

  $("taskEmpty").addEventListener("click", e => {
    const taskIndex = e.target.dataset.deleteTask;
    if (taskIndex !== undefined) {
      const data = getPlannerData();
      const active = data.tasks.filter(t => !t.done);
      const task = active[taskIndex];
      if (task && confirm("Да изтрия ли задачата?")) {
        data.tasks.splice(data.tasks.indexOf(task), 1);
        savePlannerData(data);
      }
    }

    const lessonIndex = e.target.dataset.deleteLesson;
    if (lessonIndex !== undefined) {
      const data = getPlannerData();
      if (confirm("Да изтрия ли урока?")) {
        data.lessons.splice(lessonIndex, 1);
        savePlannerData(data);
      }
    }
  });

  $("uroci").addEventListener("click", e => {
    const index = e.target.dataset.deleteLesson;
    if (index === undefined) return;
    const data = getPlannerData();
    if (confirm("Да изтрия ли урока?")) {
      data.lessons.splice(index, 1);
      savePlannerData(data);
    }
  });

  $("kalendar").addEventListener("click", e => {
    const index = e.target.dataset.deleteEvent;
    if (index === undefined) return;
    const data = getPlannerData();
    if (confirm("Да изтрия ли събитието?")) {
      data.events.splice(index, 1);
      savePlannerData(data);
    }
  });

  const originalRefresh = refresh;
  refresh = async function() {
    await originalRefresh();
    renderPlanner();
  };

  // Допълнителни действия от началния екран
  $("quickAdd").addEventListener("click", () => {
    const choice = prompt("Какво искаш да добавиш?\n1 — Урок\n2 — Задача\n3 — Събитие\n4 — Материал");
    if (choice === "1") addPlannerItem("lesson");
    else if (choice === "2") addPlannerItem("task");
    else if (choice === "3") addPlannerItem("event");
    else if (choice === "4") $("addResource").click();
  });

  init();
