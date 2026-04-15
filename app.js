function todayLocal(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
let viewDate=todayLocal();
let events=[],personnel=[],personnel2=[],personnel3=[],keyPresets=['탄약고','정문','후문','무기고'];
let keyCatalog=[];
let otSessions=[];
let entryTypes=['탄약고','무기고','BL탄약고','교탄탄약고','간이탄약고'];
let tlFilter='all'; // 타임라인 필터 상태
let selectedKey=null;
let selectedKeyPersons=new Set();
let selectedHandoverPerson=''; // 인계자 (열쇠탭)
let selectedHvReceiver=new Set(); // 인수자 (점검탭 인수인계)
let selectedHvGiver=''; // 인계자 (점검탭 인수인계)
let inspCategory=null; // 'patrol'|'cctv'|'handover'
let inspMode='timer';  // 'timer'|'manual'
let selectedKeyGroup=null;
let selectedIssueKeyIds=new Set();
let selectedReturnKeyIds=new Set();
let selectedEntryType=null, selectedEntryAction='입장';
let selectedEntryPerson1=new Set(), selectedEntryPerson2=new Set();
const ENTRY_ACTIONS=['입장','퇴장','외출','복귀'];
let selectedPatrolPersons=new Set(), selectedCctvPersons=new Set(), selectedOtPersons=new Set();
let checkedEvents=new Set();
// 게시판 타이머 (entry/patrol/cctv/overtime 통합)
let boardTimers={}; // id -> {interval, startTime, paused, elapsed, category, type, persons, done, note}
let timerIdCounter=0;
let liveRefreshHandle=null;
// 날짜별 데이터 존재 캐시 (localStorage 기반)
let datesWithData=new Set(JSON.parse(localStorage.getItem('event_dates')||'[]'));

// ── 테마 자동 전환 ──
function applyTheme(){
  const h=new Date().getHours();
  const isDark=(h>=7&&h<18);
  document.body.classList.toggle('theme-dark',isDark);
  document.body.classList.toggle('theme-light',!isDark);
}

// ── 뒤로가기 방지 (앱 모드에서 크롬으로 이탈 차단) ──
(function preventBack(){
  history.pushState(null,'',location.href);
  window.addEventListener('popstate',()=>{
    history.pushState(null,'',location.href);
  });
})();

// ── 초기화 ──
function init(){
  // 스플래시 스크린 제거
  setTimeout(()=>{const s=document.getElementById('splash');if(s)s.remove();},2200);
  // 테마 자동 전환
  applyTheme();
  setInterval(applyTheme,60000);
  document.getElementById('setup').style.display='none';
  document.getElementById('app').style.display='block';
  // 헤더 실제 높이 기반으로 context bar top 동적 설정
  requestAnimationFrame(()=>{
    const hh=document.querySelector('.header').offsetHeight;
    document.getElementById('contextBar').style.top=hh+'px';
  });
  setupNav();setupNavDrag();updateDateLabel();
  loadPersonnel();loadEvents();restoreAllTimers();renderAllBoards();
  if(!liveRefreshHandle){liveRefreshHandle=setInterval(()=>{renderAllBoards();},1000);}
}

function setupNav(){
  const pageRender={
    'timeline': ()=>{renderTimeline();},
    'entry-keys': ()=>{renderEntryBoard();renderEntryForm();renderKeyBoard();renderKeyPersonSelector();renderKeyPresets();renderKeyDetailSelector();renderHeldKeySelector();},
    'inspection':()=>{renderInspectionBoard();renderInspForm();},
    'overtime-cal': ()=>{renderOTBoard();renderOTSummary();renderCalendar();},
    'settings': ()=>{renderSettings();renderKeyCatalogEditor();}
  };
  document.querySelectorAll('.nav-item').forEach(n=>{
    n.addEventListener('click',()=>{
      document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      n.classList.add('active');
      document.getElementById('page-'+n.dataset.page).classList.add('active');
      const fn=pageRender[n.dataset.page];
      if(fn)fn();
    });
  });
}
// 네비 드래그 순서 변경
function setupNavDrag(){
  const nav=document.getElementById('bottomNav');
  let dragged=null;
  nav.addEventListener('dragstart',e=>{dragged=e.target.closest('.nav-item');if(dragged)dragged.style.opacity='0.4';});
  nav.addEventListener('dragend',e=>{if(dragged)dragged.style.opacity='1';dragged=null;});
  nav.addEventListener('dragover',e=>{e.preventDefault();});
  nav.addEventListener('drop',e=>{
    e.preventDefault();const target=e.target.closest('.nav-item');
    if(target&&dragged&&target!==dragged){
      const items=[...nav.querySelectorAll('.nav-item')];
      const di=items.indexOf(dragged),ti=items.indexOf(target);
      if(di<ti)target.after(dragged);else target.before(dragged);
      // 순서 저장
      const order=[...nav.querySelectorAll('.nav-item')].map(n=>n.dataset.page);
      localStorage.setItem('nav_order',JSON.stringify(order));
    }
  });
  // 저장된 순서 복원
  try{
    const order=JSON.parse(localStorage.getItem('nav_order')||'[]');
    if(order.length){order.forEach(p=>{const el=nav.querySelector('[data-page="'+p+'"]');if(el)nav.appendChild(el);});}
  }catch(e){}
}


// ── 날짜 이동 ──
function dateShift(base,delta){
  const d=new Date(base+'T00:00:00');d.setDate(d.getDate()+delta);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function updateDateLabel(){
  const d=new Date(viewDate+'T00:00:00');
  const wd=['일','월','화','수','목','금','토'][d.getDay()];
  const today=todayLocal();
  const label=document.getElementById('dateLabel');
  let text=viewDate+' ('+wd+')';
  if(viewDate===today) text='오늘 '+text;
  label.textContent=text;
  label.className='current-date'+(datesWithData.has(viewDate)?' has-data':'');
  document.getElementById('todayDate').textContent=text;
}
function prevDay(){viewDate=dateShift(viewDate,-1);updateDateLabel();loadEvents();}
function nextDay(){viewDate=dateShift(viewDate,+1);updateDateLabel();loadEvents();}
function openCalendar(){
  document.getElementById('calendarInput').value=viewDate;
  document.getElementById('calendarModal').classList.add('show');
}
function closeCalendar(){document.getElementById('calendarModal').classList.remove('show');}
function selectDate(){
  const v=document.getElementById('calendarInput').value;
  if(v){viewDate=v;updateDateLabel();loadEvents();}
  closeCalendar();
}

// ── localStorage 저장/불러오기 ──
function loadEvents(){
  const data=localStorage.getItem('events_'+viewDate);
  if(data){const d=JSON.parse(data);events=d.events||[];}
  else{events=[];}
  loadOtSessions();
  renderTimeline();renderEntryBoard();renderKeyBoard();renderOTBoard();renderOTSummary();updateDateLabel();
}
function loadPersonnel(){
  const data=localStorage.getItem('personnel');
  if(data){
    const d=JSON.parse(data);
    personnel=d.personnel||[];personnel2=d.personnel2||[];personnel3=d.personnel3||[];
    if(d.key_presets)keyPresets=d.key_presets;
    if(d.entry_types)entryTypes=d.entry_types;
    keyCatalog=d.key_catalog||[];
  }
  ensureKeyCatalog();
  renderPersonButtons();renderKeyPresets();renderSettings();renderEntryForm();
  renderPersonChips('patrol');renderPersonChips('cctv');renderPersonChips('ot');
  renderKeyDetailSelector();renderHeldKeySelector();renderOTSummary();
}
function saveEvents(){
  try{
    localStorage.setItem('events_'+viewDate,JSON.stringify({date:viewDate,events}));
    if(!datesWithData.has(viewDate)){datesWithData.add(viewDate);localStorage.setItem('event_dates',JSON.stringify([...datesWithData]));}
    return Promise.resolve(true);
  }catch(e){toast('저장 실패: 저장 공간 부족');return Promise.resolve(false);}
}
function savePersonnel(){
  try{
    ensureKeyCatalog();
    localStorage.setItem('personnel',JSON.stringify({personnel,personnel2,personnel3,key_presets:keyPresets,entry_types:entryTypes,key_catalog:keyCatalog}));
    return Promise.resolve(true);
  }catch(e){toast('저장 실패: 저장 공간 부족');return Promise.resolve(false);}
}

function slugKey(name){return (name||'').replace(/\s+/g,'_');}
function defaultKeysForGroup(group, idx){
  const defs={
    '탄약고':[{name:'외문',qty:1},{name:'내문',qty:1}],
    '정문':[{name:'정문',qty:1}],
    '후문':[{name:'후문',qty:1}],
    '무기고':[{name:'무기고',qty:9}]
  };
  const items=defs[group]||[{name:group,qty:1}];
  const keys=[];let ki=1;
  items.forEach(item=>{
    for(let i=1;i<=item.qty;i++){
      keys.push({id:'g'+idx+'_k'+(ki++),name:item.name,number:i+'번 상'});
      keys.push({id:'g'+idx+'_k'+(ki++),name:item.name,number:i+'번 하'});
    }
  });
  return keys;
}
function ensureKeyCatalog(){
  if(!Array.isArray(keyCatalog)) keyCatalog=[];
  keyPresets.forEach((group,idx)=>{
    let item=keyCatalog.find(g=>g.group===group);
    if(!item){keyCatalog.push({group,keys:defaultKeysForGroup(group,idx)});item=keyCatalog[keyCatalog.length-1];}
    else if(!Array.isArray(item.keys)){item.keys=defaultKeysForGroup(group,idx);}
    item.keys=item.keys.map((k,i)=>({id:k.id||('g'+idx+'_k'+(i+1)),name:k.name||group,number:k.number||((i+1)+'번')}));
  });
  keyCatalog=keyCatalog.filter(g=>keyPresets.includes(g.group));
  if(selectedKeyGroup && !keyPresets.includes(selectedKeyGroup)) selectedKeyGroup=null;
}
function getGroupKeys(group){
  ensureKeyCatalog();
  return (keyCatalog.find(g=>g.group===group)||{keys:[]}).keys||[];
}
function loadOtSessions(){
  try{otSessions=JSON.parse(localStorage.getItem('overtime_'+viewDate)||'[]');if(!Array.isArray(otSessions))otSessions=[];}catch(e){otSessions=[];}
}
function saveOtSessions(){
  try{
    localStorage.setItem('overtime_'+viewDate,JSON.stringify(otSessions));
    if(otSessions.length&&!datesWithData.has(viewDate)){datesWithData.add(viewDate);localStorage.setItem('event_dates',JSON.stringify([...datesWithData]));}
    return Promise.resolve(true);
  }catch(e){toast('저장 실패: 저장 공간 부족');return Promise.resolve(false);}
}
function parseClockToMinutes(v){if(!v||!v.includes(':'))return 0;const [h,m]=v.split(':').map(Number);return (h||0)*60+(m||0);}
function formatHourMinute(totalMinutes){const mins=Math.max(0,Math.floor(totalMinutes));const h=Math.floor(mins/60),m=mins%60;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
function getOtElapsedMs(session){
  const start=parseClockToMinutes(session.start_time);
  const end=parseClockToMinutes(session.end_time||nowTime());
  let diff=end-start;
  if(diff<0) diff=0;
  return diff*60000;
}
function getOtTodayTotalMs(){return otSessions.reduce((sum,s)=>sum+getOtElapsedMs(s),0);}
function getSelectedKeyHolder(){return [...selectedKeyPersons][0]||'';}
function keySigFromEvent(ev){return ev.key_id || [ev.location||'',ev.key_name||'',ev.key_number||''].join('|');}
function getCurrentHeldKeyEntries(){
  const open=[];
  events.filter(e=>e.type==='key').forEach((ev,idx)=>{
    const subjects=[ev.subject,ev.subject2,ev.subject3].filter(Boolean);
    if(ev.action==='issue'){
      subjects.forEach(subject=>{
        open.push({idx,subject,group:ev.location||'',key_id:ev.key_id||'',key_name:ev.key_name||ev.location||'',key_number:ev.key_number||'',time:ev.time||'',sig:keySigFromEvent(ev)});
      });
    }else if(ev.action==='return'){
      const subject=ev.subject||subjects[0]||'';
      const sig=keySigFromEvent(ev);
      const matchIdx=open.findIndex(item=>item.subject===subject&&item.sig===sig);
      if(matchIdx>=0)open.splice(matchIdx,1);
    }
  });
  return open;
}
function getHolderHeldKeys(holder){return getCurrentHeldKeyEntries().filter(item=>item.subject===holder);}
function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}
function makeKeyLabel(group,key){return [group,key.name,key.number].filter(Boolean).join(' / ');}

// ── 진행 중 작업 아코디언 ──
let _activeBlockOpen=false;
function toggleActiveBlock(){
  _activeBlockOpen=!_activeBlockOpen;
  const list=document.getElementById('activeList');
  const arrow=document.getElementById('activeBlockArrow');
  if(list) list.style.display=_activeBlockOpen?'block':'none';
  if(arrow) arrow.style.transform=_activeBlockOpen?'rotate(180deg)':'';
}

// ── 진행 중 작업 블록 렌더링 ──
function renderActiveBlock(){
  const block=document.getElementById('activeBlock');
  const list=document.getElementById('activeList');
  if(!block||!list)return;

  const isToday=viewDate===todayLocal();
  const runningBoards=isToday?Object.entries(boardTimers||{}).filter(([,t])=>!t.done):[];
  const runningOT=otSessions.filter(s=>!s.end_time).map(s=>(['ot_'+s.id,{category:'overtime',type:'초과근무',persons:s.subject,start_time:s.start_time,note:s.note||''}]));
  const running=[...runningBoards,...runningOT];
  if(!running.length){block.style.display='none';return;}
  block.style.display='block';

  const summary=document.getElementById('activeBlockSummary');
  if(summary){
    const count=Object.values(boardTimers).filter(t=>!t.done).length;
    summary.textContent='진행 중 '+count+'건';
  }
  list.style.display=_activeBlockOpen?'block':'none';

  const colors={entry:'#1a73e8',patrol:'#34a853',cctv:'#9334e6',overtime:'#ea4335'};
  const labels={entry:'출입',patrol:'순찰',cctv:'CCTV',overtime:'초과'};

  list.innerHTML=running.map(([id,t])=>{
    const color=colors[t.category]||'#888';
    const label=labels[t.category]||t.category;
    const elapsed=t.category==='overtime'?getOtElapsedMs({start_time:t.start_time,end_time:t.end_time||''}):getBoardElapsed(parseInt(String(id).replace('ot_','')));
    const sub=t.category==='overtime'?(t.start_time+' ~ 현재'):(t.type&&t.type!==label?t.type:'');
    const stopBtn=t.category==='overtime'
      ?'<button class="active-row-stop" onclick="stopOT(\''+String(id).replace('ot_','')+'\')" title="종료"><span class="material-icons-round">stop</span></button>'
      :'<button class="active-row-stop" onclick="stopBoard('+id+')" title="종료"><span class="material-icons-round">stop</span></button>';
    return '<div class="active-row">'
      +'<span class="active-row-type" style="background:'+color+'">'+label+'</span>'
      +'<div class="active-row-info">'
        +'<div class="active-row-persons">'+escapeHtml(t.persons)+'</div>'
        +(sub?'<div class="active-row-sub">'+escapeHtml(sub)+'</div>':'')
      +'</div>'
      +'<span class="active-row-timer">'+fmtTime(elapsed)+'</span>'
      +stopBtn
      +'</div>';
  }).join('');
}

// ── 타임라인 렌더링 ──
function renderTimeline(){
  renderActiveBlock();
  const list=document.getElementById('timelineList'),empty=document.getElementById('emptyMsg'),stats=document.getElementById('statsRow');
  const timelineEvents=events.filter(e=>e.type!=='overtime');
  if(!timelineEvents.length){stats.innerHTML='';}
  else{empty.style.display='none';}

  const lb={entry:'출입',patrol:'순찰',cctv:'CCTV',key:'열쇠',handover:'인수인계',other:'특이'};
  const counts={};timelineEvents.forEach(e=>{counts[e.type]=(counts[e.type]||0)+1;});
  stats.innerHTML=Object.entries(counts).map(([k,v])=>'<span class="stat-badge">'+(lb[k]||k)+' '+v+'건</span>').join('');

  const LOC_PALETTE=['#4285f4','#e8710a','#34a853','#9334e6','#00838f','#c2185b','#fbbc04','#0097a7'];
  const locCount={};timelineEvents.forEach(e=>{if(e.location)locCount[e.location]=(locCount[e.location]||0)+1;});
  const locColor={};let pi=0;Object.keys(locCount).filter(l=>locCount[l]>=2).sort().forEach(l=>{locColor[l]=LOC_PALETTE[pi++%LOC_PALETTE.length];});

  const isToday=viewDate===todayLocal();
  const matchFilter=(cat)=>tlFilter==='all'||(tlFilter==='inspection'?(cat==='patrol'||cat==='cctv'||cat==='handover'):cat===tlFilter);
  const activeIds=isToday?Object.entries(boardTimers).filter(([,t])=>!t.done&&matchFilter(t.category)):[];
  const colors={entry:'#1a73e8',patrol:'#34a853',cctv:'#9334e6'};
  const tlLabels={entry:'출입',patrol:'순찰',cctv:'CCTV'};

  let html='';
  if(activeIds.length){
    html+='<div style="font-size:11px;font-weight:700;color:#e65100;padding:4px 0 6px;letter-spacing:0.5px;">진행 중 '+activeIds.length+'</div>';
    html+=activeIds.map(([id,t])=>{
      const color=colors[t.category]||'#888';
      const label=tlLabels[t.category]||t.category;
      return '<div class="timeline-item timeline-running" style="border-left:3px solid '+color+';padding-left:8px;opacity:0.9;">'
        +'<div class="tl-head"><div class="tl-time-block"><div class="tl-time-range"><span class="tl-time-start">'+escapeHtml(t.startClock||'--:--')+'</span><span class="tl-time-sep">~</span><span class="tl-time-end live">현재</span></div><div class="tl-duration">'+fmtTime(getBoardElapsed(parseInt(id)))+'</div></div><span class="timeline-tag tag-'+t.category+'">'+label+'</span></div>'
        +'<div class="tl-badges"><span class="tl-badge tl-badge-action-in">진행중</span><span class="tl-badge" style="background:#f1f3f4;color:#555;">'+escapeHtml(t.type||'')+'</span>'
        +(t.persons?'<span class="tl-badge" style="background:#f1f3f4;color:#555;">'+escapeHtml(t.persons)+'</span>':'')
        +'</div>'
        +'</div>';
    }).join('');
    html+='<div style="border-top:2px dashed #f0f0f0;margin:8px 0 6px;"></div>';
    html+='<div style="font-size:11px;font-weight:700;color:#888;padding:0 0 6px;letter-spacing:0.5px;">완료 기록</div>';
  }

  const SKIP_ACTIONS=new Set(['start','입장']);
  const completed=timelineEvents
    .map((ev,idx)=>({ev,idx}))
    .filter(({ev})=>!SKIP_ACTIONS.has(ev.action))
    .filter(({ev})=>tlFilter==='all'||(tlFilter==='inspection'?(ev.type==='patrol'||ev.type==='cctv'||ev.type==='handover'||ev.type==='other'):ev.type===tlFilter))
    .sort((a,b)=>{
      const at=(a.ev.end_time||a.ev.time||'').localeCompare(b.ev.end_time||b.ev.time||'');
      return -at;
    });

  if(!completed.length&&!activeIds.length){list.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';

  html+=completed.map(({ev,idx:oi})=>{
    const tc='tag-'+ev.type, tg=lb[ev.type]||ev.type;
    const checked=checkedEvents.has(oi);
    function actionLabel(type,action){
      if(type==='handover')return{text:'인수인계',cls:'tl-badge-action-in'};
      if(type==='entry'){
        if(action==='퇴장'||action==='stop')return{text:'완료',cls:'tl-badge-action-out'};
        if(action==='외출')return{text:'외출',cls:'tl-badge-action-away'};
        if(action==='복귀')return{text:'복귀',cls:'tl-badge-action-in'};
        return{text:action||'',cls:'tl-badge-action-other'};
      }
      if(action==='stop'||action==='종료')return{text:'완료',cls:'tl-badge-action-out'};
      if(action==='issue')return{text:'수령',cls:'tl-badge-action-in'};
      if(action==='return')return{text:'반납',cls:'tl-badge-action-out'};
      return{text:action||'',cls:'tl-badge-action-other'};
    }
    const al=actionLabel(ev.type,ev.action);
    const noteTxt=ev.note?'<div class="tl-detail-group"><b>메모</b> '+escapeHtml(ev.note)+'</div>':'';
    const start=ev.start_time||'';
    const end=ev.end_time||ev.time||'';
    const timeBlock=start?('<div class="tl-time-range"><span class="tl-time-start">'+escapeHtml(start)+'</span><span class="tl-time-sep">~</span><span class="tl-time-end">'+escapeHtml(end)+'</span></div>'):( '<div class="tl-time-single">'+escapeHtml(end)+'</div>' );
    const duration=ev.duration?'<div class="tl-duration">'+escapeHtml(ev.duration)+'</div>':'';
    let badges='<span class="tl-badge '+al.cls+'">'+al.text+'</span>';
    if(ev.manual)badges+='<span class="tl-badge" style="background:#e0f2fe;color:#0369a1;border:none;font-size:10px;padding:2px 7px;">수기</span>';
    let detail='';
    if(ev.type==='entry'){
      if(ev.location)badges+='<span class="tl-badge tl-badge-loc">'+escapeHtml(ev.location)+'</span>';
      detail='<div class="tl-detail-group">'+escapeHtml([ev.subject,ev.subject2].filter(Boolean).join(', '))+'</div>'+noteTxt;
    }else if(ev.type==='patrol'||ev.type==='cctv'){
      detail='<div class="tl-detail-group">'+escapeHtml(ev.subject||'')+'</div>'+noteTxt;
    }else if(ev.type==='key'){
      if(ev.location)badges+='<span class="tl-badge tl-badge-loc">'+escapeHtml(ev.location)+'</span>';
      detail='<div class="tl-detail-group">'+escapeHtml(ev.subject||'')+'</div>'
        +'<div class="tl-detail-group">'+escapeHtml([ev.location,ev.key_name,ev.key_number].filter(Boolean).join(' / '))+'</div>'+noteTxt;
    }else if(ev.type==='handover'){
      if(ev.handover)badges+='<span class="tl-badge tl-badge-loc" style="background:#e0f7fa;color:#006064;">인계: '+escapeHtml(ev.handover)+'</span>';
      detail='<div class="tl-detail-group"><b>인수자</b> '+escapeHtml(ev.subject||'')+'</div>'
        +(ev.handover?'<div class="tl-detail-group"><b>인계자</b> '+escapeHtml(ev.handover)+'</div>':'')
        +noteTxt;
    }else if(ev.type==='other'){
      detail='<div class="tl-detail-group">'+escapeHtml(ev.subject||'')+'</div>'+noteTxt;
    }
    const hasDetail=detail.trim()!=='';
    const toggleBar=hasDetail?'<button class="tl-toggle-bar" id="tlbtn-'+oi+'" onclick="tlToggle(\'tld-'+oi+'\',\'tlbtn-'+oi+'\')"><span class="material-icons-round">expand_more</span><span>상세</span></button>':'';
    const stripe=ev.location&&locColor[ev.location]?'border-left:4px solid '+locColor[ev.location]+';padding-left:8px;':'';
    return '<div class="timeline-item tl-type-'+ev.type+(checked?' checked':'')+'" style="flex-wrap:wrap;'+stripe+'">'
      +'<input type="checkbox" class="timeline-cb" '+(checked?'checked':'')+' onchange="toggleCheck('+oi+',this)" onclick="event.stopPropagation()">'
      +'<div class="tl-main">'
        +'<div class="tl-head"><div class="tl-time-block">'+timeBlock+duration+'</div><span class="timeline-tag '+tc+'">'+tg+'</span>'+badges+'</div>'
      +'</div>'
      +'<span class="timeline-del material-icons-round" onclick="deleteEvent('+oi+')">close</span>'
      +(hasDetail?'<div class="tl-detail" id="tld-'+oi+'">'+detail+'</div>':'')
      +toggleBar
      +'</div>';
  }).join('');

  list.innerHTML=html;
}

// ── 출입 게시판형 ──
function renderEntryForm(){
  document.getElementById('entryTypes').innerHTML=entryTypes.map(t=>'<div class="type-chip'+(selectedEntryType===t?' selected':'')+'" onclick="toggleEntryType(\''+t+'\')">'+t+'</div>').join('');
  document.getElementById('entryActionChips').innerHTML=ENTRY_ACTIONS.map(a=>'<div class="type-chip'+(selectedEntryAction===a?' selected':'')+'" onclick="selectEntryAction(\''+a+'\')">'+a+'</div>').join('');
  document.getElementById('entryPersonChips1').innerHTML=personnel.map(p=>'<div class="person-chip'+(selectedEntryPerson1.has(p.name)?' selected':'')+'" onclick="selectEntryPerson(1,\''+p.name+'\')">'+p.name+'</div>').join('');
  document.getElementById('entryPersonChips2').innerHTML=personnel2.map(p=>'<div class="person-chip'+(selectedEntryPerson2.has(p.name)?' selected':'')+'" onclick="selectEntryPerson(2,\''+p.name+'\')">'+p.name+'</div>').join('');
}
function toggleEntryType(t){selectedEntryType=selectedEntryType===t?null:t;renderEntryForm();}
function selectEntryAction(a){selectedEntryAction=a;renderEntryForm();}
function selectEntryPerson(slot,n){
  const s=slot===1?selectedEntryPerson1:selectedEntryPerson2;
  if(s.has(n))s.delete(n);else s.add(n);
  renderEntryForm();
}

function createEntry(){
  if(!selectedEntryType){toast('유형을 선택하세요');return;}
  if(!selectedEntryPerson1.size&&!selectedEntryPerson2.size){toast('대상자를 선택하세요');return;}
  const s1=[...selectedEntryPerson1].join(', ');
  const s2=[...selectedEntryPerson2].join(', ');
  const parts=[s1,s2].filter(Boolean);
  const subject=parts.join(' / ');
  const ev={time:nowTime(),type:'entry',action:selectedEntryAction,subject:s1||s2,subject2:s1?s2:'',location:selectedEntryType};
  events.push(ev);
  saveEvents().then(ok=>{if(ok){toast(subject+' '+selectedEntryType+' '+selectedEntryAction);renderTimeline();}});
  createBoardTimer('entry',selectedEntryType,subject,'');
  selectedEntryPerson1.clear();selectedEntryPerson2.clear();selectedEntryType=null;renderEntryForm();renderAllBoards();
}
function createPatrol(){
  if(!selectedPatrolPersons.size){toast('대상자를 선택하세요');return;}
  const names=[...selectedPatrolPersons].join(', ');
  const ev={time:nowTime(),type:'patrol',action:'start',subject:names};
  events.push(ev);
  saveEvents().then(ok=>{if(ok){toast(names+' 순찰 시작');renderTimeline();}else{events.pop();toast('저장 실패. 다시 시도해주세요.');}});
  createBoardTimer('patrol','순찰',names,'');
  selectedPatrolPersons.clear();renderInspForm();renderAllBoards();
}
function createCCTV(){
  if(!selectedCctvPersons.size){toast('대상자를 선택하세요');return;}
  const names=[...selectedCctvPersons].join(', ');
  const ev={time:nowTime(),type:'cctv',action:'start',subject:names};
  events.push(ev);
  saveEvents().then(ok=>{if(ok){toast(names+' CCTV 점검 시작');renderTimeline();}else{events.pop();toast('저장 실패. 다시 시도해주세요.');}});
  createBoardTimer('cctv','CCTV',names,'');
  selectedCctvPersons.clear();renderInspForm();renderAllBoards();
}
function createOT(){
  if(!selectedOtPersons.size){toast('대상자를 선택하세요');return;}
  const names=[...selectedOtPersons].join(', ');
  const note=document.getElementById('otNote').value.trim();
  const baseTime=getTimePicker('otBaseTp');
  const endTime=getTimePicker('otEndTp');
  if(baseTime>=endTime){toast('종료시각이 기준시간보다 이후여야 합니다');return;}
  otSessions.push({id:'ot_'+Date.now(),subject:names,start_time:baseTime,end_time:endTime,note});
  saveOtSessions().then(()=>{toast(names+' 초과근무 등록');renderOTBoard();renderOTSummary();renderActiveBlock();});
  document.getElementById('otNote').value='';
  makeTimePicker('otBaseTp');makeTimePicker('otEndTp');
  selectedOtPersons.clear();renderPersonChips('ot');renderAllBoards();
}

function fmtTime(ms){
  const s=Math.floor(ms/1000),m=Math.floor(s/60),sec=s%60;
  return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}

// ── 대상자 칩 렌더링 (복수 선택, patrol/cctv/ot용) ──
function renderPersonChips(ctx){
  const map={patrol:'patrolPersonChips',cctv:'cctvPersonChips',ot:'otPersonChips'};
  const sets={patrol:selectedPatrolPersons,cctv:selectedCctvPersons,ot:selectedOtPersons};
  const el=document.getElementById(map[ctx]);if(!el)return;
  const sel=sets[ctx];
  el.innerHTML=personnel.map(p=>'<div class="person-chip'+(sel.has(p.name)?' selected':'')+'" onclick="toggleBoardPerson(\''+ctx+'\',\''+p.name+'\')">'+p.name+'</div>').join('');
}
function toggleBoardPerson(ctx,name){
  const sets={patrol:selectedPatrolPersons,cctv:selectedCctvPersons,ot:selectedOtPersons};
  const s=sets[ctx];
  if(s.has(name))s.delete(name);else s.add(name);
  renderPersonChips(ctx);
}
function renderPersonChipsQuickStart(ctx){
  const map={patrol:'patrolPersonChips',cctv:'cctvPersonChips'};
  const el=document.getElementById(map[ctx]);if(!el)return;
  const color=ctx==='patrol'?'#34a853':'#9334e6';
  el.innerHTML=personnel.map(p=>'<div class="person-chip" style="cursor:pointer;" onclick="quickStartInsp(\''+ctx+'\',\''+escapeHtml(p.name)+'\')">'+escapeHtml(p.name)+'</div>').join('')||'<span style="font-size:12px;color:#aaa;">설정에서 대상자를 추가하세요</span>';
}
function quickStartInsp(ctx,name){
  if(ctx==='patrol'){
    selectedPatrolPersons.clear();selectedPatrolPersons.add(name);
    createPatrol();
  }else if(ctx==='cctv'){
    selectedCctvPersons.clear();selectedCctvPersons.add(name);
    createCCTV();
  }
}

// ── 통합 보드 렌더링 (entry/patrol/cctv/overtime 공용) ──
function renderBoard(category, boardId, typeColor){
  const board=document.getElementById(boardId);
  // 재렌더 전 열려있는 메모 슬라이드 ID 저장
  const openMemos=new Set([...board.querySelectorAll('[id^="memo-slide-"]')].filter(el=>el.style.display==='block').map(el=>el.id.replace('memo-slide-','')));
  // boardTimers는 오늘 날짜에만 표시 (과거 날짜 조회 시 잔존 타이머 노출 방지)
  const isToday=viewDate===todayLocal();
  const allIds=isToday?Object.keys(boardTimers).filter(id=>boardTimers[id].category===category):[];
  if(!allIds.length){board.innerHTML='<div class="empty-state"><span class="material-icons-round">check_circle</span><p>기록이 없어요</p></div>';return;}

  // 진행 중: startTime DESC / 완료: endAt DESC
  const openIds=allIds.filter(id=>!boardTimers[id].done).sort((a,b)=>boardTimers[b].startTime-boardTimers[a].startTime);
  const doneIds=allIds.filter(id=>boardTimers[id].done).sort((a,b)=>(boardTimers[b].endAt||0)-(boardTimers[a].endAt||0));

  const sectionHdr=(label,count)=>'<div class="section-hdr">'+label+' '+count+'</div>';

  const renderRow=(id)=>{
    const t=boardTimers[id];
    const elapsed=getBoardElapsed(id);
    const time=fmtTime(elapsed);
    const tc=typeColor||'#1a73e8';
    const editBtn='<button class="btn-icon btn-edit" onclick="editBoard('+id+')"><span class="material-icons-round">edit</span></button>';
    const delBtn='<button class="btn-icon btn-del" onclick="deleteBoardTimer('+id+')"><span class="material-icons-round">delete</span></button>';
    if(t.done){
      return '<div class="entry-row done">'+editBtn+'<div class="entry-info"><span class="entry-type" style="background:'+tc+'">'+t.type+'</span><span class="entry-persons">'+escapeHtml(t.persons)+'</span></div><span class="entry-timer">'+time+'</span>'+(t.note?'<span class="note-preview" title="'+escapeHtml(t.note)+'">'+escapeHtml(t.note)+'</span>':'')+delBtn+'</div>';
    }
    const running=!t.paused;
    const noteBtn=category==='cctv'?'<button class="btn-icon btn-memo" onclick="openMemo('+id+')"><span class="material-icons-round">edit_note</span></button>':'';
    return '<div class="entry-row">'+editBtn+'<div class="entry-info"><span class="entry-type" style="background:'+tc+'">'+t.type+'</span><span class="entry-persons">'+escapeHtml(t.persons)+'</span></div><span class="entry-timer'+(running?' running':'')+'">'+time+'</span><div class="entry-actions">'
      +noteBtn
      +(running?'<button class="btn-pause" onclick="pauseBoard('+id+')"><span class="material-icons-round">pause</span></button>'
               :'<button class="btn-play" onclick="resumeBoard('+id+')"><span class="material-icons-round">play_arrow</span></button>')
      +'<button class="btn-stop-entry" onclick="stopBoard('+id+')"><span class="material-icons-round">stop</span></button>'
      +delBtn+'</div></div>';
  };

  let html='';
  if(openIds.length){
    html+=sectionHdr('진행 중',openIds.length);
    html+=openIds.map(renderRow).join('');
  }
  if(doneIds.length){
    html+=sectionHdr('완료',doneIds.length);
    html+=doneIds.map(renderRow).join('');
  }
  board.innerHTML=html;
  // 메모 슬라이드 열림 상태 복원
  openMemos.forEach(id=>{const el=document.getElementById('memo-slide-'+id);if(el)el.style.display='block';});
}
function renderEntryBoard(){renderBoard('entry','entryBoard','#1a73e8');}
function renderInspectionBoard(){
  const board=document.getElementById('inspectionBoard');if(!board)return;
  // 재렌더 전 열려있는 메모 슬라이드 ID 저장
  const openMemos=new Set([...board.querySelectorAll('[id^="memo-slide-"]')].filter(el=>el.style.display==='block').map(el=>el.id.replace('memo-slide-','')));
  const isToday=viewDate===todayLocal();
  const catColors={patrol:'#34a853',cctv:'#9334e6'};
  const allIds=isToday?Object.keys(boardTimers).filter(id=>boardTimers[id].category==='patrol'||boardTimers[id].category==='cctv'):[];
  // 인수인계 이벤트 (events 배열 직접)
  const handoverEvs=events.reduce((acc,ev,idx)=>{if(ev.type==='handover')acc.push({ev,idx});return acc;},[]).sort((a,b)=>b.ev.time.localeCompare(a.ev.time));
  if(!allIds.length&&!handoverEvs.length){board.innerHTML='<div class="empty-state"><span class="material-icons-round">check_circle</span><p>기록이 없어요</p></div>';return;}
  const openIds=allIds.filter(id=>!boardTimers[id].done).sort((a,b)=>boardTimers[b].startTime-boardTimers[a].startTime);
  const doneIds=allIds.filter(id=>boardTimers[id].done).sort((a,b)=>(boardTimers[b].endAt||0)-(boardTimers[a].endAt||0));
  const sectionHdr=(label,count)=>'<div class="section-hdr">'+label+' '+count+'</div>';
  const renderRow=(id)=>{
    const t=boardTimers[id];
    const elapsed=getBoardElapsed(id);
    const time=fmtTime(elapsed);
    const tc=catColors[t.category]||'#888';
    const editBtn='<button class="btn-icon btn-edit" onclick="editBoard('+id+')"><span class="material-icons-round">edit</span></button>';
    const delBtn='<button class="btn-icon btn-del" onclick="deleteBoardTimer('+id+')"><span class="material-icons-round">delete</span></button>';
    if(t.done){
      return '<div class="entry-row done">'+editBtn+'<div class="entry-info"><span class="entry-type" style="background:'+tc+'">'+t.type+'</span><span class="entry-persons">'+t.persons+'</span></div><span class="entry-timer">'+time+'</span>'+(t.note?'<span class="note-preview" title="'+escapeHtml(t.note)+'">'+escapeHtml(t.note)+'</span>':'')+delBtn+'</div>';
    }
    const running=!t.paused;
    const noteBtn=t.category==='cctv'?'<button class="btn-icon btn-memo" onclick="openMemo('+id+')"><span class="material-icons-round">edit_note</span></button>':'';
    const memoSlide=t.category==='cctv'?'<div id="memo-slide-'+id+'" style="display:none;width:100%;margin-top:8px;padding:8px;background:#f3e8ff;border-radius:10px;box-sizing:border-box;">'
      +'<textarea id="memo-ta-'+id+'" rows="3" style="width:100%;border:1px solid #c084fc;border-radius:8px;padding:8px;font-size:14px;box-sizing:border-box;resize:vertical;">'+escapeHtml(t.note||'')+'</textarea>'
      +'<button onclick="saveMemo('+id+')" style="margin-top:6px;width:100%;background:#9334e6;color:#fff;border:none;border-radius:8px;padding:8px;font-size:14px;cursor:pointer;">저장</button>'
      +'</div>':'';
    return '<div class="entry-row" style="flex-wrap:wrap;">'+editBtn+'<div class="entry-info"><span class="entry-type" style="background:'+tc+'">'+t.type+'</span><span class="entry-persons">'+t.persons+'</span></div><span class="entry-timer'+(running?' running':'')+'">'+time+'</span><div class="entry-actions">'+noteBtn+(running?'<button class="btn-pause" onclick="pauseBoard('+id+')"><span class="material-icons-round">pause</span></button>':'<button class="btn-play" onclick="resumeBoard('+id+')"><span class="material-icons-round">play_arrow</span></button>')+'<button class="btn-stop-entry" onclick="stopBoard('+id+')"><span class="material-icons-round">stop</span></button>'+delBtn+'</div>'+memoSlide+'</div>';
  };
  let html='';
  if(openIds.length){html+=sectionHdr('진행 중',openIds.length);html+=openIds.map(renderRow).join('');}
  if(doneIds.length){html+=sectionHdr('완료',doneIds.length);html+=doneIds.map(renderRow).join('');}
  if(handoverEvs.length){
    html+=sectionHdr('인수인계',handoverEvs.length);
    html+=handoverEvs.map(({ev,idx})=>{
      const manualTag=ev.manual?'<span style="font-size:10px;padding:2px 6px;background:#e0f7fa;color:#006064;border-radius:8px;font-weight:600;margin-right:6px;">수기</span>':'';
      const delBtn='<button class="btn-icon-sm btn-del" style="margin-left:6px;" onclick="deleteHandoverEvent('+idx+')"><span class="material-icons-round">delete</span></button>';
      return '<div class="entry-row done"><div class="entry-info"><span class="entry-type" style="background:#0097a7;">인수인계</span><span class="entry-persons">'+(ev.handover?escapeHtml(ev.handover)+' → ':'')+escapeHtml(ev.subject||'')+'</span></div>'
        +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;margin-left:auto;">'+manualTag+'<span style="font-size:13px;color:#0097a7;font-weight:700;">'+escapeHtml(ev.time)+'</span></div>'
        +delBtn+'</div>';
    }).join('');
  }
  board.innerHTML=html;
  // 메모 슬라이드 열림 상태 복원
  openMemos.forEach(id=>{const el=document.getElementById('memo-slide-'+id);if(el)el.style.display='block';});
}
async function deleteHandoverEvent(idx){
  if(!confirm('삭제할까요?'))return;
  const bk=[...events];events.splice(idx,1);
  if(await saveEvents()){toast('삭제');renderTimeline();renderInspectionBoard();}
  else{events=bk;toast('저장 실패.');}
}
function renderAllBoards(){renderEntryBoard();renderInspectionBoard();renderOTBoard();renderOTSummary();renderActiveBlock();}

// ── 통합 타이머 로직 ──
function getBoardElapsed(id){
  const t=boardTimers[id];if(!t)return 0;
  if(t.paused||t.done)return t.elapsed;
  return t.elapsed+(Date.now()-t.startTime);
}
function createBoardTimer(category, type, persons, note){
  const id=++timerIdCounter;
  boardTimers[id]={startTime:Date.now(),startClock:nowTime(),paused:false,elapsed:0,category,type,persons,done:false,note:note||''};
  saveBoardState();
  return id;
}
function pauseBoard(id){
  const t=boardTimers[id];if(!t)return;
  t.paused=true;t.elapsed+=(Date.now()-t.startTime);
  saveBoardState();renderAllBoards();
}
function resumeBoard(id){
  const t=boardTimers[id];if(!t)return;
  t.paused=false;t.startTime=Date.now();
  saveBoardState();renderAllBoards();
}
function stopBoard(id){
  const t=boardTimers[id];if(!t)return;
  if(!t.paused)t.elapsed+=(Date.now()-t.startTime);
  t.done=true;t.endAt=Date.now();
  const dur=fmtTime(t.elapsed);
  const evType=t.category==='cctv'?'cctv':t.category;
  const evAction=evType==='entry'?'퇴장':'stop';
  const endClock=nowTime();
  const ev={time:endClock,type:evType,action:evAction,subject:t.persons,location:t.type,duration:dur,note:t.note||'',start_time:t.startClock||'',end_time:endClock};
  events.push(ev);
  saveEvents().then(ok=>{if(ok){toast(t.persons+' '+t.type+' 종료 ('+dur+')');renderTimeline();}});
  saveBoardState();renderAllBoards();
}
// CCTV 메모 인라인 슬라이드
function openMemo(id){
  const el=document.getElementById('memo-slide-'+id);
  if(!el)return;
  const open=el.style.display==='block';
  el.style.display=open?'none':'block';
  if(!open){const ta=document.getElementById('memo-ta-'+id);if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);}}
}
function saveMemo(id){
  const ta=document.getElementById('memo-ta-'+id);if(!ta)return;
  const t=boardTimers[id];if(!t)return;
  t.note=ta.value;
  saveBoardState();
  const el=document.getElementById('memo-slide-'+id);if(el)el.style.display='none';
  toast('메모 저장');renderAllBoards();
}
function saveBoardState(){
  try{
    const s={};Object.entries(boardTimers).forEach(([id,t])=>{
      s[id]={category:t.category,type:t.type,persons:t.persons,elapsed:t.paused||t.done?t.elapsed:t.elapsed+(Date.now()-t.startTime),paused:t.paused,done:t.done,note:t.note||'',startClock:t.startClock||'',endAt:t.endAt||0};
    });
    localStorage.setItem('boardTimers',JSON.stringify(s));
  }catch(e){}
}
function restoreAllTimers(){
  try{
    const s=JSON.parse(localStorage.getItem('boardTimers')||'{}');
    let purged=false;
    Object.entries(s).forEach(([id,t])=>{
      // FIXED_V2: category='overtime' entries are legacy (old timer-based OT). Drop them.
      if(t.category==='overtime'){purged=true;return;}
      const nid=parseInt(id);if(nid>=timerIdCounter)timerIdCounter=nid;
      boardTimers[nid]={...t,startTime:Date.now(),startClock:t.startClock||nowTime()};
    });
    if(purged)saveBoardState();
  }catch(e){}
}

// ── 공통 함수 ──
function nowTime(){const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}

// ── 시간 스피너 (Time Picker) ──
const _timePickers={};
function makeTimePicker(containerId,initTime){
  const t=initTime||nowTime();
  const parts=t.split(':');
  const h=parseInt(parts[0])||0,m=parseInt(parts[1])||0;
  _timePickers[containerId]={h,m};
  _renderTp(containerId);
}
function getTimePicker(containerId){
  const s=_timePickers[containerId];
  if(!s)return nowTime();
  return String(s.h).padStart(2,'0')+':'+String(s.m).padStart(2,'0');
}
function _renderTp(id){
  const el=document.getElementById(id);if(!el)return;
  const s=_timePickers[id];if(!s)return;
  const ampm=s.h<12?'오전':'오후';
  const h12=s.h%12||12;
  el.innerHTML='<div class="tp-wrap">'
    +'<div class="tp-col"><button class="tp-btn" ontouchstart="" onclick="_tpAdj(\''+id+'\',\'ap\',1)">▲</button>'
    +'<div class="tp-val tp-ampm">'+ampm+'</div>'
    +'<button class="tp-btn" ontouchstart="" onclick="_tpAdj(\''+id+'\',\'ap\',-1)">▼</button></div>'
    +'<div class="tp-col"><button class="tp-btn" ontouchstart="" onclick="_tpAdj(\''+id+'\',\'h\',1)">▲</button>'
    +'<div class="tp-val">'+String(h12).padStart(2,'0')+'</div>'
    +'<button class="tp-btn" ontouchstart="" onclick="_tpAdj(\''+id+'\',\'h\',-1)">▼</button></div>'
    +'<div class="tp-sep">:</div>'
    +'<div class="tp-col"><button class="tp-btn" ontouchstart="" onclick="_tpAdj(\''+id+'\',\'m\',1)">▲</button>'
    +'<div class="tp-val">'+String(s.m).padStart(2,'0')+'</div>'
    +'<button class="tp-btn" ontouchstart="" onclick="_tpAdj(\''+id+'\',\'m\',-1)">▼</button></div>'
    +'</div>';
}
function _tpAdj(id,field,delta){
  const s=_timePickers[id];if(!s)return;
  if(field==='ap'){s.h=(s.h+12)%24;}
  else if(field==='h'){
    const pm=s.h>=12;let h12=s.h%12||12;h12+=delta;
    if(h12>12)h12=1;if(h12<1)h12=12;
    s.h=pm?(h12%12)+12:h12%12;
  }else if(field==='m'){s.m=(s.m+delta+60)%60;}
  _renderTp(id);
}
function getKeyHolders(){
  const holders=new Set();
  getCurrentHeldKeyEntries().forEach(item=>holders.add(item.subject));
  return holders;
}
function getRoleRank(name){
  if(!name)return 99;
  if(name.includes('탄약관')&&!name.includes('반장'))return 1;
  if(name.includes('탄약반장'))return 2;
  if(name.includes('관리병'))return 3;
  return 4;
}
function renderKeyPersonSelector(){
  const el=document.getElementById('keyPersonSelector');if(!el)return;
  const holders=getKeyHolders();
  const recent=JSON.parse(localStorage.getItem('keyRecentUse')||'{}');
  const allNames=[...new Set([...personnel,...personnel2,...personnel3].map(p=>p.name))];
  const holding=allNames.filter(n=>holders.has(n));
  const rest=allNames.filter(n=>!holders.has(n)).sort((a,b)=>{const rd=getRoleRank(a)-getRoleRank(b);if(rd!==0)return rd;return (recent[b]||0)-(recent[a]||0);});
  const recommended=rest.slice(0,3);
  const others=rest.slice(3);
  function btn(n){
    const isHolding=holders.has(n);
    const isSel=selectedKeyPersons.has(n);
    let cls='kp-person-btn'+(isHolding?' holding':'')+(isSel?' selected':'');
    return '<button class="'+cls+'" onclick="toggleKeyPerson(\''+n+'\')">'+escapeHtml(n)+'</button>';
  }
  function section(label,names){if(!names.length)return'';return'<div class="kp-section-hdr">'+label+'</div>'+names.map(btn).join('');}
  el.innerHTML=section('현재 보유 중',holding)+section('추천 대상 (인수자)',recommended)+(others.length?section('전체 목록',others):'');
}
function toggleKeyPerson(name){
  if(selectedKeyPersons.has(name))selectedKeyPersons.clear();
  else{selectedKeyPersons.clear();selectedKeyPersons.add(name);}
  selectedReturnKeyIds.clear();
  renderKeyPersonSelector();
  renderHeldKeySelector();
  updateKeyBtns();
}
function updateKeyBtns(){
  const holder=getSelectedKeyHolder();
  const bi=document.getElementById('btnKeyIssue');
  const br=document.getElementById('btnKeyReturn');
  const canIssue=!!holder&&selectedIssueKeyIds.size>0;
  const canReturn=!!holder&&selectedReturnKeyIds.size>0;
  if(bi){bi.disabled=!canIssue;bi.style.opacity=canIssue?'1':'0.4';bi.style.cursor=canIssue?'pointer':'not-allowed';}
  if(br){br.disabled=!canReturn;br.style.opacity=canReturn?'1':'0.4';br.style.cursor=canReturn?'pointer':'not-allowed';}
  const summary=document.getElementById('keySelectionSummary');
  if(summary){
    const group=selectedKeyGroup||'';
    const selected=getGroupKeys(group).filter(k=>selectedIssueKeyIds.has(k.id)).map(k=>makeKeyLabel(group,k));
    summary.innerHTML=selected.length?('<div class="key-summary-title">선택된 수령 키</div>'+selected.map(v=>'<span class="key-summary-chip">'+escapeHtml(v)+'</span>').join('')):'<div class="key-summary-empty">선택된 수령 키 없음</div>';
  }
  const rsummary=document.getElementById('keyReturnSummary');
  if(rsummary){
    const held=getHolderHeldKeys(holder).filter(k=>selectedReturnKeyIds.has(k.sig));
    rsummary.innerHTML=held.length?('<div class="key-summary-title">선택된 반납 키</div>'+held.map(k=>'<span class="key-summary-chip">'+escapeHtml([k.group,k.key_name,k.key_number].filter(Boolean).join(' / '))+'</span>').join('')):'<div class="key-summary-empty">선택된 반납 키 없음</div>';
  }
}
// ── 점검 통합 폼 ──
function selectInspCategory(cat){
  inspCategory=cat;inspMode='timer';renderInspForm();
}
function selectInspMode(mode){
  inspMode=mode;renderInspForm();
}
function renderInspForm(){
  const area=document.getElementById('inspFormArea');if(!area)return;
  const CATS=[
    {id:'patrol', label:'순찰', color:'#34a853', icon:'directions_walk'},
    {id:'cctv',   label:'CCTV', color:'#9334e6', icon:'videocam'},
    {id:'handover',label:'인수인계',color:'#0097a7',icon:'swap_horiz'}
  ];
  area.innerHTML=CATS.map(c=>
    '<button class="insp-big-btn" style="background:'+c.color+';" onclick="openInspModal(\''+c.id+'\')">'
      +'<span class="material-icons-round">'+c.icon+'</span>'+c.label+'</button>'
  ).join('')
    +'<button class="insp-manual-btn" onclick="openManualInspModal()">✏️ 수기 입력</button>';
}
// ── 점검 모달 ──
function openInspModal(cat){
  const modal=document.getElementById('inspModal');
  const content=document.getElementById('inspModalContent');
  const info={patrol:{label:'순찰',color:'#34a853'},cctv:{label:'CCTV',color:'#9334e6'},handover:{label:'인수인계',color:'#0097a7'}}[cat];
  if(cat==='patrol'||cat==='cctv'){
    content.innerHTML='<div class="insp-modal-title" style="color:'+info.color+'">'+info.label+' 대상자 선택</div>'
      +'<div class="person-selector" id="inspModalChips"></div>';
    modal.classList.add('open');
    const el=document.getElementById('inspModalChips');
    el.innerHTML=personnel.map(p=>'<div class="person-chip" onclick="quickStartFromModal(\''+cat+'\',\''+escapeHtml(p.name)+'\')">'+escapeHtml(p.name)+'</div>').join('')||'<span style="font-size:12px;color:#aaa;">설정에서 대상자를 추가하세요</span>';
  }else{
    selectedHvReceiver.clear();selectedHvGiver='';
    content.innerHTML='<div class="insp-modal-title" style="color:'+info.color+'">인수자 선택 <span style="font-weight:400;color:#999;font-size:11px;">(받는 사람)</span></div>'
      +'<div class="person-selector" id="inspModalChips"></div>';
    modal.classList.add('open');
    renderModalHvReceiverChips();
  }
}
function closeInspModal(){document.getElementById('inspModal').classList.remove('open');}
function quickStartFromModal(cat,name){
  if(cat==='patrol'){
    selectedPatrolPersons.clear();selectedPatrolPersons.add(name);
    createPatrol();
    showStopwatch(name,'순찰','#34a853',timerIdCounter);
  }else if(cat==='cctv'){
    selectedCctvPersons.clear();selectedCctvPersons.add(name);
    createCCTV();
    showStopwatch(name,'CCTV','#9334e6',timerIdCounter);
  }
}
let _swInterval=null,_swLocked=false,_swTimerId=null;
let _lockPressTimer=null;
let _lockProgress=0;

function showStopwatch(name,label,color,timerId){
  // CCTV는 잠금 없이 바로 시작, 순찰은 잠금
  _swLocked=(label!=='CCTV');
  _swTimerId=timerId||null;
  const content=document.getElementById('inspModalContent');
  const startMs=Date.now();
  // 잠금 필요할 때만 오버레이 HTML 포함
  const overlayHtml=_swLocked
    ?'<div id="swLockOverlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.7);border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;">'
      +'<span class="material-icons-round" id="lockIcon" style="font-size:48px;color:#fff;margin-bottom:8px;cursor:pointer;user-select:none;">lock</span>'
      +'<span style="color:#fff;font-size:14px;margin-bottom:12px;">5초 동안 꾹 눌러 잠금 해제</span>'
      +'<div style="width:60%;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;overflow:hidden;">'
        +'<div id="lockProgress" style="width:0%;height:100%;background:#4caf50;border-radius:3px;transition:width 0.3s;"></div>'
      +'</div>'
    +'</div>'
    :'';
  const lockToggleBtn=_swLocked
    ?'<button class="sw-stop-btn" style="background:#78909c;" id="swLockBtn" onclick="toggleSwLock()"><span class="material-icons-round" style="font-size:28px;color:#fff;">lock_open</span></button>'
    :'';
  content.innerHTML='<div class="sw-label" style="color:'+color+'">'+label+'</div>'
    +'<div class="sw-subject">'+escapeHtml(name)+'</div>'
    +'<div class="sw-display" id="swTime">00:00</div>'
    +'<textarea id="swMemoInput" class="sw-memo-input" placeholder="메모 (선택)"></textarea>'
    +'<div style="display:flex;justify-content:center;gap:20px;margin-top:8px;">'
      +'<button class="sw-stop-btn" style="background:'+color+';" id="swStopBtn" '+(  _swLocked?'disabled style="background:'+color+';opacity:0.4;cursor:not-allowed;"':''  )+' onclick="closeStopwatch()">중지</button>'
      +lockToggleBtn
    +'</div>'
    +overlayHtml;
  content.style.position='relative';
  // 잠금 상태면 오버레이 이벤트 바인딩
  renderLockOverlay();
  clearInterval(_swInterval);
  _swInterval=setInterval(()=>{
    const el=document.getElementById('swTime');if(!el){clearInterval(_swInterval);return;}
    const diff=Math.floor((Date.now()-startMs)/1000);
    const m=String(Math.floor(diff/60)).padStart(2,'0');
    const s=String(diff%60).padStart(2,'0');
    el.textContent=m+':'+s;
  },1000);
}
function renderLockOverlay(){
  const overlay=document.getElementById('swLockOverlay');
  if(!overlay)return;
  const stopBtn=document.getElementById('swStopBtn');
  if(_swLocked){
    overlay.style.display='flex';
    if(stopBtn){stopBtn.disabled=true;stopBtn.style.opacity='0.4';stopBtn.style.cursor='not-allowed';}
    // 잠금 아이콘에만 롱프레스 이벤트 바인딩
    const lockIcon=document.getElementById('lockIcon');
    if(lockIcon){
      lockIcon.onmousedown=startLockUnpress;
      lockIcon.ontouchstart=startLockUnpress;
      lockIcon.onmouseup=cancelLockUnpress;
      lockIcon.ontouchend=cancelLockUnpress;
      lockIcon.onmouseleave=cancelLockUnpress;
    }
    // 오버레이 전체 클릭 차단 (아이콘 외 영역)
    overlay.onclick=function(e){e.preventDefault();e.stopPropagation();};
  }else{
    overlay.style.display='none';
    if(stopBtn){stopBtn.disabled=false;stopBtn.style.opacity='1';stopBtn.style.cursor='pointer';}
  }
}
function startLockUnpress(e){
  e.stopPropagation();
  e.preventDefault();
  _lockProgress=0;
  const prog=document.getElementById('lockProgress');
  if(prog) prog.style.width='0%';
  _lockPressTimer=setInterval(()=>{
    _lockProgress++;
    const p=document.getElementById('lockProgress');
    if(p) p.style.width=(_lockProgress*20)+'%';
    if(_lockProgress>=5){
      clearInterval(_lockPressTimer);
      _lockPressTimer=null;
      _swLocked=false;
      renderLockOverlay();
      toast('잠금 해제됨');
    }
  },1000);
}
function cancelLockUnpress(){
  clearInterval(_lockPressTimer);
  _lockPressTimer=null;
  _lockProgress=0;
  const prog=document.getElementById('lockProgress');
  if(prog) prog.style.width='0%';
}
function toggleSwLock(){
  if(!_swLocked){
    // 해제 상태에서 누르면 즉시 잠금
    _swLocked=true;
    renderLockOverlay();
    toast('잠금 설정됨');
  }
  // 잠금 상태에서는 아이콘 롱프레스로만 해제 (toggleSwLock 버튼은 잠금 오버레이 뒤에 가려짐)
}
function closeStopwatch(){
  if(_swLocked)return;
  // 메모 저장 → 보드 타이머에 반영
  const memoEl=document.getElementById('swMemoInput');
  if(memoEl&&_swTimerId!=null&&boardTimers[_swTimerId]){
    boardTimers[_swTimerId].note=memoEl.value.trim();
    saveBoardState();
  }
  clearInterval(_swInterval);_swInterval=null;
  closeInspModal();
  renderInspForm();renderAllBoards();
}
// 모달 인수인계 칩
function renderModalHvReceiverChips(){
  const el=document.getElementById('inspModalChips');if(!el)return;
  const all=[...new Set([...personnel,...personnel2].map(p=>p.name))];
  el.innerHTML=all.map(n=>'<div class="person-chip'+(selectedHvReceiver.has(n)?' selected':'')+'" onclick="toggleModalHvReceiver(\''+escapeHtml(n)+'\')">'+escapeHtml(n)+'</div>').join('')||'<span style="font-size:12px;color:#aaa;">설정에서 대상자를 추가하세요</span>';
}
function toggleModalHvReceiver(name){
  if(selectedHvReceiver.has(name))selectedHvReceiver.delete(name);else selectedHvReceiver.add(name);
  renderModalHvReceiverChips();
  if(selectedHvReceiver.size){
    // 인수자 선택 완료 → 인계자 목록 표시
    const content=document.getElementById('inspModalContent');
    const receiver=[...selectedHvReceiver].join(', ');
    content.innerHTML='<div class="insp-modal-title" style="color:#0097a7">인수자: '+escapeHtml(receiver)+'</div>'
      +'<div class="insp-modal-title">인계자 선택 <span style="font-weight:400;color:#999;font-size:11px;">(넘기는 사람)</span></div>'
      +'<div class="person-selector" id="inspModalChips2"></div>';
    const el2=document.getElementById('inspModalChips2');
    el2.innerHTML=personnel3.map(p=>'<div class="person-chip" onclick="quickHandover(\''+escapeHtml(p.name)+'\')">'+escapeHtml(p.name)+'</div>').join('')||'<span style="font-size:12px;color:#aaa;">설정 > 인계자 관리에서 추가하세요</span>';
  }
}
function quickHandover(giverName){
  selectedHvGiver=giverName;
  createHandover();
  closeInspModal();
}
// ── 수기 입력 모달 ──
function openManualInspModal(){
  const modal=document.getElementById('inspModal');
  const content=document.getElementById('inspModalContent');
  content.innerHTML='<div class="insp-modal-title">수기 입력</div>'
    +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">'
    +'<div class="insp-cat-btn" style="background:#34a853;color:#fff;border-color:#34a853;" onclick="openManualForm(\'patrol\')"><span class="material-icons-round" style="font-size:20px;display:block;margin-bottom:2px;">directions_walk</span>순찰</div>'
    +'<div class="insp-cat-btn" style="background:#9334e6;color:#fff;border-color:#9334e6;" onclick="openManualForm(\'cctv\')"><span class="material-icons-round" style="font-size:20px;display:block;margin-bottom:2px;">videocam</span>CCTV</div>'
    +'<div class="insp-cat-btn" style="background:#0097a7;color:#fff;border-color:#0097a7;" onclick="openManualForm(\'handover\')"><span class="material-icons-round" style="font-size:20px;display:block;margin-bottom:2px;">swap_horiz</span>인수인계</div>'
    +'<div class="insp-cat-btn" style="background:#e65100;color:#fff;border-color:#e65100;" onclick="openManualForm(\'other\')"><span class="material-icons-round" style="font-size:20px;display:block;margin-bottom:2px;">report_problem</span>기타·특이사항</div>'
    +'</div>';
  modal.classList.add('open');
}
function openManualForm(cat){
  inspCategory=cat;inspMode='manual';
  const content=document.getElementById('inspModalContent');
  const color={patrol:'#34a853',cctv:'#9334e6',handover:'#0097a7',other:'#e65100'}[cat];
  const label={patrol:'순찰',cctv:'CCTV',handover:'인수인계',other:'기타·특이사항'}[cat];
  if(cat==='patrol'||cat==='cctv'){
    const chipsId='modalManualChips';
    const id=cat==='patrol'?'Patrol':'Cctv';
    const sid='m'+id+'StartTp';
    const eid='m'+id+'EndTp';
    content.innerHTML='<div class="insp-modal-title" style="color:'+color+'">'+label+' 수기 입력</div>'
      +'<div class="card-title">대상자</div>'
      +'<div class="person-selector" id="'+chipsId+'" style="margin-top:6px;"></div>'
      +'<div style="margin-top:10px;"><div class="card-title">시작 시각</div><div id="'+sid+'" style="margin-top:6px;"></div></div>'
      +'<div style="margin-top:10px;"><div class="card-title">종료 시각</div><div id="'+eid+'" style="margin-top:6px;"></div></div>'
      +'<textarea class="note-input" id="m'+id+'Note" rows="2" placeholder="메모 (선택)" style="margin-top:10px;margin-bottom:12px;"></textarea>'
      +'<button class="entry-add-btn" style="background:'+color+';" onclick="saveModalManual(\''+cat+'\')">저장</button>';
    const el=document.getElementById(chipsId);
    const selSet=cat==='patrol'?selectedPatrolPersons:selectedCctvPersons;
    selSet.clear();
    el.innerHTML=personnel.map(p=>'<div class="person-chip" onclick="toggleModalManualPerson(\''+cat+'\',\''+escapeHtml(p.name)+'\',this)">'+escapeHtml(p.name)+'</div>').join('');
    makeTimePicker(sid);makeTimePicker(eid);
  }else if(cat==='other'){
    // 기타·특이사항 수기
    content.innerHTML='<div class="insp-modal-title" style="color:'+color+'">기타·특이사항 수기 입력</div>'
      +'<div class="card-title">내용 <span style="font-weight:400;font-size:11px;color:#999;">(무슨 일이 발생했나요?)</span></div>'
      +'<input type="text" id="mOtherTitle" placeholder="예: 정문 잠금장치 이상, 낯선 차량 등" style="width:100%;padding:10px 14px;border:1.5px solid #e65100;border-radius:12px;font-size:14px;background:var(--bg-input,#1a1f2b);color:var(--text-primary,#e6edf3);font-family:\'Noto Sans KR\';margin-top:6px;box-sizing:border-box;">'
      +'<div style="margin-top:12px;"><div class="card-title">발생 시각</div><div id="mOtherTp" style="margin-top:6px;"></div></div>'
      +'<textarea class="note-input" id="mOtherNote" rows="3" placeholder="상세 내용 (선택)" style="margin-top:10px;margin-bottom:12px;"></textarea>'
      +'<button class="entry-add-btn" style="background:#e65100;" onclick="saveManualOther()">저장</button>';
    makeTimePicker('mOtherTp');
  }else{
    // 인수인계 수기 = 기존 풀폼
    selectedHvReceiver.clear();selectedHvGiver='';
    content.innerHTML='<div class="insp-modal-title" style="color:'+color+'">인수인계 수기 입력</div>'
      +'<div class="card-title">인수자</div><div class="person-selector" id="mHvRcv" style="margin-top:6px;"></div>'
      +'<div class="card-title" style="margin-top:10px;">인계자</div><div class="person-selector" id="mHvGvr" style="margin-top:6px;"></div>'
      +'<div style="margin-top:10px;"><div class="card-title">처리 시각</div><div id="mHvTp" style="margin-top:6px;"></div></div>'
      +'<textarea class="note-input" id="mHvNote" rows="2" placeholder="특이사항 (선택)" style="margin-top:10px;margin-bottom:12px;"></textarea>'
      +'<button class="entry-add-btn" style="background:'+color+';" onclick="saveModalHandover()">저장</button>';
    renderModalManualHvChips();
    makeTimePicker('mHvTp');
  }
}
function toggleModalManualPerson(cat,name,chipEl){
  const s=cat==='patrol'?selectedPatrolPersons:selectedCctvPersons;
  if(s.has(name)){s.delete(name);chipEl.classList.remove('selected');}
  else{s.add(name);chipEl.classList.add('selected');}
}
async function saveModalManual(cat){
  if(cat==='patrol')await saveManualPatrol();
  else await saveManualCCTV();
  closeInspModal();
}
function renderModalManualHvChips(){
  const rcv=document.getElementById('mHvRcv');
  const gvr=document.getElementById('mHvGvr');
  if(rcv){
    const all=[...new Set([...personnel,...personnel2].map(p=>p.name))];
    rcv.innerHTML=all.map(n=>'<div class="person-chip'+(selectedHvReceiver.has(n)?' selected':'')+'" onclick="toggleModalManualHvR(\''+escapeHtml(n)+'\')">'+escapeHtml(n)+'</div>').join('');
  }
  if(gvr){
    gvr.innerHTML=personnel3.map(p=>'<div class="person-chip'+(selectedHvGiver===p.name?' selected':'')+'" onclick="toggleModalManualHvG(\''+escapeHtml(p.name)+'\')">'+escapeHtml(p.name)+'</div>').join('');
  }
}
function toggleModalManualHvR(n){if(selectedHvReceiver.has(n))selectedHvReceiver.delete(n);else selectedHvReceiver.add(n);renderModalManualHvChips();}
function toggleModalManualHvG(n){selectedHvGiver=selectedHvGiver===n?'':n;renderModalManualHvChips();}
async function saveModalHandover(){
  const receiver=[...selectedHvReceiver].join(', ');
  if(!receiver){toast('인수자를 선택하세요');return;}
  const giver=selectedHvGiver;
  const timeV=getTimePicker('mHvTp');
  const noteEl=document.getElementById('mHvNote');
  const note=noteEl?noteEl.value.trim():'';
  const ev={time:timeV,type:'handover',action:'complete',subject:receiver,handover:giver,note};
  events.push(ev);
  if(await saveEvents()){toast((giver?giver+' → ':'')+receiver+' 인수인계 기록');renderTimeline();renderInspectionBoard();}
  else{events.pop();toast('저장 실패.');}
  selectedHvReceiver.clear();selectedHvGiver='';
  closeInspModal();
}
// ── 점검탭 인수인계 선택기 ──
function renderHvReceiverChips(){
  const el=document.getElementById('hvReceiverChips');if(!el)return;
  const all=[...new Set([...personnel,...personnel2].map(p=>p.name))];
  el.innerHTML=all.map(n=>'<div class="person-chip'+(selectedHvReceiver.has(n)?' selected':'')+'" onclick="toggleHvReceiver(\''+escapeHtml(n)+'\')">'+escapeHtml(n)+'</div>').join('')||'<span style="font-size:12px;color:#aaa;">설정에서 대상자를 추가하세요</span>';
}
function renderHvGiverChips(){
  const el=document.getElementById('hvGiverChips');if(!el)return;
  el.innerHTML=personnel3.map(p=>'<div class="person-chip'+(selectedHvGiver===p.name?' selected':'')+'" onclick="toggleHvGiver(\''+escapeHtml(p.name)+'\')">'+escapeHtml(p.name)+'</div>').join('')||'<span style="font-size:12px;color:#aaa;">설정 > 인계자 관리에서 추가하세요</span>';
}
function toggleHvReceiver(name){if(selectedHvReceiver.has(name))selectedHvReceiver.delete(name);else selectedHvReceiver.add(name);renderHvReceiverChips();renderInspForm();}
function toggleHvGiver(name){selectedHvGiver=selectedHvGiver===name?'':name;renderHvGiverChips();if(selectedHvGiver)createHandover();}
async function createHandover(){
  const receiver=[...selectedHvReceiver].join(', ');
  if(!receiver){toast('인수자를 선택하세요');return;}
  const giver=selectedHvGiver;
  const timeV=nowTime();
  const noteEl=document.getElementById('hvNote');
  const note=noteEl?noteEl.value.trim():'';
  const ev={time:timeV,type:'handover',action:'complete',subject:receiver,handover:giver,note};
  events.push(ev);
  if(await saveEvents()){
    toast((giver?giver+' → ':'')+receiver+' 인수인계 기록');
    renderTimeline();renderInspectionBoard();
  }else{events.pop();toast('저장 실패.');}
  selectedHvReceiver.clear();selectedHvGiver='';
  inspCategory=null;renderInspForm();
}
// ── 수기 입력 저장 함수 ──
async function saveManualPatrol(){
  const person=[...selectedPatrolPersons].join(', ');
  if(!person){toast('대상자를 선택하세요');return;}
  const start=getTimePicker('mPatrolStartTp');
  const end=getTimePicker('mPatrolEndTp');
  const note=document.getElementById('mPatrolNote').value.trim();
  const diff=Math.max(0,parseClockToMinutes(end)-parseClockToMinutes(start));
  const duration=start?formatHourMinute(diff):'';
  const ev={time:end,type:'patrol',action:'stop',subject:person,start_time:start,end_time:end,duration,note,manual:true};
  events.push(ev);
  if(await saveEvents()){toast(person+' 순찰 수기 등록');renderTimeline();renderInspectionBoard();inspCategory=null;selectedPatrolPersons.clear();renderInspForm();}
  else{events.pop();toast('저장 실패.');}
}
async function saveManualCCTV(){
  const person=[...selectedCctvPersons].join(', ');
  if(!person){toast('대상자를 선택하세요');return;}
  const start=getTimePicker('mCctvStartTp');
  const end=getTimePicker('mCctvEndTp');
  const note=document.getElementById('mCctvNote').value.trim();
  const diff=Math.max(0,parseClockToMinutes(end)-parseClockToMinutes(start));
  const duration=start?formatHourMinute(diff):'';
  const ev={time:end,type:'cctv',action:'stop',subject:person,start_time:start,end_time:end,duration,note,manual:true};
  events.push(ev);
  if(await saveEvents()){toast(person+' CCTV 수기 등록');renderTimeline();renderInspectionBoard();inspCategory=null;selectedCctvPersons.clear();renderInspForm();}
  else{events.pop();toast('저장 실패.');};
}
async function saveManualOther(){
  const title=document.getElementById('mOtherTitle').value.trim();
  if(!title){toast('내용을 입력하세요');return;}
  const timeV=getTimePicker('mOtherTp');
  const note=document.getElementById('mOtherNote').value.trim();
  const ev={time:timeV,type:'other',action:'note',subject:title,note,manual:true};
  events.push(ev);
  if(await saveEvents()){toast('특이사항 기록 완료');renderTimeline();closeInspModal();}
  else{events.pop();toast('저장 실패.');}
}
async function saveManualEntry(){
  const person=document.getElementById('mEntryPerson').value.trim();
  if(!person){toast('대상자를 입력하세요');return;}
  const loc=document.getElementById('mEntryLoc').value.trim();
  const action=document.getElementById('mEntryAction').value;
  const timeV=getTimePicker('mEntryTimeTp');
  const note=document.getElementById('mEntryNote').value.trim();
  const ev={time:timeV,type:'entry',action,subject:person,location:loc,note,manual:true};
  events.push(ev);
  if(await saveEvents()){toast(person+' 출입 수기 등록');renderTimeline();}
  else{events.pop();toast('저장 실패.');}
  ['mEntryPerson','mEntryLoc','mEntryNote'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
async function saveManualKey(){
  const person=document.getElementById('mKeyPerson').value.trim();
  if(!person){toast('대상자를 입력하세요');return;}
  const action=document.getElementById('mKeyAction').value;
  const keyName=document.getElementById('mKeyName').value.trim();
  const timeV=getTimePicker('mKeyTimeTp');
  const note=document.getElementById('mKeyNote').value.trim();
  const ev={time:timeV,type:'key',action,subject:person,location:keyName,key_name:keyName,note,manual:true};
  events.push(ev);
  if(await saveEvents()){toast(person+' 열쇠 수기 등록');renderTimeline();renderKeyBoard();}
  else{events.pop();toast('저장 실패.');}
  ['mKeyPerson','mKeyName','mKeyNote'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
// ── 열쇠탭 인계자 선택기 ──
function renderHandoverChips(){
  const el=document.getElementById('handoverChips');if(!el)return;
  el.innerHTML=personnel3.map(p=>{
    const sel=selectedHandoverPerson===p.name;
    return '<div class="person-chip'+(sel?' selected':'')+'" onclick="toggleHandoverPerson(\''+escapeHtml(p.name)+'\')">'+escapeHtml(p.name)+'</div>';
  }).join('')||'<span style="font-size:12px;color:#aaa;">설정 > 열쇠 설정 > 인계자 관리에서 추가하세요</span>';
}
function toggleHandoverPerson(name){
  selectedHandoverPerson=selectedHandoverPerson===name?'':name;
  renderHandoverChips();
}

// ── 세부키 편집기 ──
function renderKeyCatalogEditor(){
  const el=document.getElementById('keyCatalogEditor');if(!el)return;
  ensureKeyCatalog();
  if(!keyCatalog.length){el.innerHTML='<div style="font-size:12px;color:#aaa;">열쇠 프리셋을 먼저 추가하세요</div>';return;}
  el.innerHTML=keyCatalog.map((g,gi)=>{
    const keys=g.keys||[];
    const keyRows=keys.map(k=>'<div style="display:flex;align-items:center;gap:6px;margin:4px 0;">'
      +'<span style="flex:1;font-size:13px;">'+escapeHtml(k.name)+' '+escapeHtml(k.number)+'</span>'
      +'<button onclick="removeCatalogKey(\''+escapeHtml(g.group)+'\',\''+k.id+'\')" style="background:#ea4335;color:#fff;border:none;border-radius:8px;padding:2px 8px;font-size:12px;cursor:pointer;">삭제</button>'
      +'</div>').join('');
    return '<div style="margin-bottom:14px;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
        +'<span style="font-weight:700;color:#f9ab00;font-size:13px;">'+escapeHtml(g.group)+' <span style="font-weight:400;color:#999;font-size:11px;">('+keys.length+'개)</span></span>'
        +(keys.length?'<button onclick="clearCatalogGroup(\''+escapeHtml(g.group)+'\')" style="background:none;border:1px solid #ea4335;color:#ea4335;border-radius:8px;padding:2px 10px;font-size:11px;font-weight:600;cursor:pointer;">전체삭제</button>':'')
      +'</div>'
      +keyRows
      +'<div style="display:flex;gap:6px;margin-top:8px;align-items:center;">'
      +'<input id="ckn_'+gi+'" placeholder="이름" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:6px 8px;font-size:13px;">'
      +'<div style="display:flex;align-items:center;gap:2px;">'
        +'<button onclick="adjCatalogQty('+gi+',-1)" style="background:#e0e0e0;border:none;border-radius:6px;width:28px;height:28px;font-size:16px;font-weight:700;cursor:pointer;">−</button>'
        +'<span id="ckqty_'+gi+'" style="min-width:28px;text-align:center;font-size:14px;font-weight:700;">1</span>'
        +'<button onclick="adjCatalogQty('+gi+',1)" style="background:#e0e0e0;border:none;border-radius:6px;width:28px;height:28px;font-size:16px;font-weight:700;cursor:pointer;">+</button>'
      +'</div>'
      +'<button onclick="addCatalogKey(\''+escapeHtml(g.group)+'\','+gi+')" style="background:#f9ab00;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;">추가</button>'
      +'</div>'
      +(gi<keyCatalog.length-1?'<hr style="border:none;border-top:1px solid #eee;margin:10px 0;">':'')
      +'</div>';
  }).join('');
}
const _catalogQty={};
function adjCatalogQty(gi,delta){
  if(!_catalogQty[gi])_catalogQty[gi]=1;
  _catalogQty[gi]=Math.max(1,Math.min(20,_catalogQty[gi]+delta));
  const el=document.getElementById('ckqty_'+gi);
  if(el)el.textContent=_catalogQty[gi];
}
async function addCatalogKey(group, gi){
  const nameEl=document.getElementById('ckn_'+gi);
  const name=(nameEl&&nameEl.value.trim())||group;
  const qty=_catalogQty[gi]||1;
  ensureKeyCatalog();
  const g=keyCatalog.find(x=>x.group===group);if(!g)return;
  const newKeys=[];
  for(let i=1;i<=qty;i++){
    const num=i+'번';
    newKeys.push({id:'u_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),name,number:num+' 상'});
    newKeys.push({id:'u_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)+'b',name,number:num+' 하'});
  }
  g.keys.push(...newKeys);
  if(await savePersonnel()){if(nameEl)nameEl.value='';_catalogQty[gi]=1;renderKeyCatalogEditor();renderKeyPresets();renderKeyDetailSelector();toast(name+' '+qty+'번 (상/하 '+newKeys.length+'개) 추가');}
  else{g.keys.splice(g.keys.length-newKeys.length,newKeys.length);toast('저장 실패.');}
}
let _clearConfirmGroup=null,_clearConfirmTimer=null;
async function clearCatalogGroup(group){
  ensureKeyCatalog();
  const g=keyCatalog.find(x=>x.group===group);if(!g||!g.keys.length)return;
  if(_clearConfirmGroup!==group){
    _clearConfirmGroup=group;
    clearTimeout(_clearConfirmTimer);
    _clearConfirmTimer=setTimeout(()=>{_clearConfirmGroup=null;},3000);
    toast(group+' '+g.keys.length+'개 삭제 — 한번 더 누르면 확정');
    return;
  }
  _clearConfirmGroup=null;clearTimeout(_clearConfirmTimer);
  const bk=[...g.keys];g.keys=[];
  if(await savePersonnel()){renderKeyCatalogEditor();renderKeyDetailSelector();toast(group+' 세부키 전체 삭제');}
  else{g.keys=bk;toast('저장 실패.');}
}
let _removeConfirmId=null,_removeConfirmTimer=null;
async function removeCatalogKey(group, keyId){
  if(_removeConfirmId!==keyId){
    _removeConfirmId=keyId;
    clearTimeout(_removeConfirmTimer);
    _removeConfirmTimer=setTimeout(()=>{_removeConfirmId=null;},3000);
    toast('한번 더 누르면 삭제');return;
  }
  _removeConfirmId=null;clearTimeout(_removeConfirmTimer);
  ensureKeyCatalog();
  const g=keyCatalog.find(x=>x.group===group);if(!g)return;
  const idx=g.keys.findIndex(k=>k.id===keyId);if(idx<0)return;
  const bk=[...g.keys];g.keys.splice(idx,1);
  if(await savePersonnel()){renderKeyCatalogEditor();renderKeyDetailSelector();toast('삭제');}
  else{g.keys=bk;toast('저장 실패.');}
}

function renderPersonButtons(){
  renderHandoverChips();
  renderKeyPersonSelector();
  renderHeldKeySelector();
  updateKeyBtns();
}
// ── 세부 키 선택기 (수령용) ──
function renderKeyDetailSelector(){
  const el=document.getElementById('keyDetails');if(!el)return;
  if(!selectedKeyGroup){el.innerHTML='<span style="font-size:12px;color:#aaa;">열쇠 그룹을 선택하세요</span>';updateKeyBtns();return;}
  const keys=getGroupKeys(selectedKeyGroup);
  if(!keys.length){el.innerHTML='<span style="font-size:12px;color:#aaa;">세부 키가 없습니다. 설정에서 추가하세요</span>';updateKeyBtns();return;}
  el.innerHTML=keys.map(k=>{
    const sel=selectedIssueKeyIds.has(k.id);
    return '<div class="person-chip'+(sel?' selected':'')+'" onclick="toggleIssueKey(\''+k.id+'\')" style="font-size:13px;">'+escapeHtml(makeKeyLabel(selectedKeyGroup,k))+'</div>';
  }).join('');
  updateKeyBtns();
}
function toggleIssueKey(keyId){
  if(selectedIssueKeyIds.has(keyId))selectedIssueKeyIds.delete(keyId);
  else selectedIssueKeyIds.add(keyId);
  renderKeyDetailSelector();updateKeyBtns();
}

// ── 보유 중 키 선택기 (반납용) ──
function renderHeldKeySelector(){
  const el=document.getElementById('keyHeldDetails');if(!el)return;
  const holder=getSelectedKeyHolder();
  if(!holder){el.innerHTML='<span style="font-size:12px;color:#aaa;">인수자를 선택하세요</span>';updateKeyBtns();return;}
  const held=getHolderHeldKeys(holder);
  if(!held.length){el.innerHTML='<span style="font-size:12px;color:#aaa;">보유 중인 키 없음</span>';updateKeyBtns();return;}
  el.innerHTML=held.map(k=>{
    const sel=selectedReturnKeyIds.has(k.sig);
    return '<div class="person-chip'+(sel?' selected':'')+'" onclick="toggleReturnKey(\''+escapeHtml(k.sig)+'\')" style="font-size:13px;">'+escapeHtml([k.group,k.key_name,k.key_number].filter(Boolean).join(' / '))+'</div>';
  }).join('');
  updateKeyBtns();
}
function toggleReturnKey(sig){
  if(selectedReturnKeyIds.has(sig))selectedReturnKeyIds.delete(sig);
  else selectedReturnKeyIds.add(sig);
  renderHeldKeySelector();updateKeyBtns();
}

function renderKeyPresets(){
  ensureKeyCatalog();
  const el=document.getElementById('keyPresets');if(!el)return;
  el.innerHTML=keyPresets.map(k=>'<div class="preset-btn'+(selectedKeyGroup===k?' selected':'')+'" onclick="selectKey(\''+k+'\')" id="kp-'+k+'">'+k+'</div>').join('');
}
function renderSettingList(elId, arr, labelFn, deleteFn, tag){
  const el=document.getElementById(elId);if(!el)return;
  el.innerHTML=arr.map((item,i)=>
    '<div class="setting-item" data-idx="'+i+'" data-tag="'+tag+'">'
    +'<span class="drag-handle">&#9776;</span>'
    +'<span>'+labelFn(item)+'</span>'
    +'<span class="setting-del" onclick="'+deleteFn+'('+i+')">삭제</span>'
    +'</div>').join('');
  setupSettingDrag(el, arr, tag);
}
function openSettingsPage(){
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-settings').classList.add('active');
  renderSettings();renderKeyCatalogEditor();
}
function renderSettings(){
  renderSettingList('personnelList',personnel,p=>p.name,'removePerson','p1');
  renderSettingList('keyPresetList',keyPresets,k=>k,'removeKeyPreset','kp');
  renderSettingList('entryTypeList',entryTypes,t=>t,'removeEntryType','et');
  renderSettingList('personnel2List',personnel2,p=>p.name,'removePerson2','p2');
  renderSettingList('personnel3List',personnel3,p=>p.name,'removePerson3','p3');
}
function setupSettingDrag(container, arr, tag){
  let dragIdx=null, overIdx=null;
  function applyReorder(){
    if(dragIdx===null||overIdx===null||dragIdx===overIdx)return;
    const moved=arr.splice(dragIdx,1)[0];arr.splice(overIdx,0,moved);
    savePersonnel();renderSettings();
    if(tag==='p1'||tag==='p2'||tag==='p3')_refreshPersonViews();
    if(tag==='et')renderEntryForm();
    if(tag==='kp'){renderKeyPresets();renderPersonButtons();}
    dragIdx=overIdx=null;
  }
  // ── 마우스 드래그 ──
  container.querySelectorAll('.setting-item').forEach((row,i)=>{
    const handle=row.querySelector('.drag-handle');
    handle.addEventListener('mousedown',e=>{
      e.preventDefault();
      dragIdx=i;row.classList.add('dragging');
      function onMove(ev){
        container.querySelectorAll('.setting-item').forEach((r,j)=>{
          const rect=r.getBoundingClientRect();
          if(ev.clientY>=rect.top&&ev.clientY<rect.bottom){overIdx=j;r.classList.add('drag-over');}
          else r.classList.remove('drag-over');
        });
      }
      function onUp(){
        container.querySelectorAll('.setting-item').forEach(r=>{r.classList.remove('drag-over','dragging');});
        document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
        applyReorder();
      }
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
    // ── 터치 드래그 ──
    handle.addEventListener('touchstart',e=>{
      e.preventDefault();dragIdx=i;row.classList.add('dragging');
    },{passive:false});
    handle.addEventListener('touchmove',e=>{
      e.preventDefault();
      const t=e.touches[0];
      container.querySelectorAll('.setting-item').forEach((r,j)=>{
        const rect=r.getBoundingClientRect();
        if(t.clientY>=rect.top&&t.clientY<rect.bottom){overIdx=j;r.classList.add('drag-over');}
        else r.classList.remove('drag-over');
      });
    },{passive:false});
    handle.addEventListener('touchend',e=>{
      container.querySelectorAll('.setting-item').forEach(r=>{r.classList.remove('drag-over','dragging');});
      applyReorder();
    });
  });
}

function selectKey(name){
  const prev=selectedKeyGroup;
  selectedKeyGroup=selectedKeyGroup===name?null:name;
  selectedIssueKeyIds.clear();
  // 그룹 새로 선택 시 전체 키 자동 선택
  if(selectedKeyGroup&&selectedKeyGroup!==prev){
    getGroupKeys(selectedKeyGroup).forEach(k=>selectedIssueKeyIds.add(k.id));
  }
  renderKeyPresets();renderKeyDetailSelector();updateKeyBtns();
}

// ── 열쇠 ──
async function addKey(action){
  const holder=getSelectedKeyHolder();
  if(!holder){toast('대상자를 선택하세요');return;}
  const created=[];
  if(action==='issue'){
    if(!selectedKeyGroup||!selectedIssueKeyIds.size){toast('수령할 세부 키를 선택하세요');return;}
    const keys=getGroupKeys(selectedKeyGroup).filter(k=>selectedIssueKeyIds.has(k.id));
    const heldSigs=new Set(getCurrentHeldKeyEntries().map(k=>k.sig));
    for(const key of keys){
      const ev={time:nowTime(),type:'key',action:'issue',subject:holder,handover:selectedHandoverPerson,location:selectedKeyGroup,key_id:key.id,key_name:key.name,key_number:key.number};
      if(heldSigs.has(keySigFromEvent(ev))){toast(makeKeyLabel(selectedKeyGroup,key)+' 는 이미 보유 중입니다');continue;}
      events.push(ev);created.push(ev);
    }
  }else{
    const held=getHolderHeldKeys(holder).filter(k=>selectedReturnKeyIds.has(k.sig));
    if(!held.length){toast('반납할 키를 선택하세요');return;}
    held.forEach(k=>{const ev={time:nowTime(),type:'key',action:'return',subject:holder,location:k.group,key_id:k.key_id,key_name:k.key_name,key_number:k.key_number};events.push(ev);created.push(ev);});
  }
  if(!created.length)return;
  const recent=JSON.parse(localStorage.getItem('keyRecentUse')||'{}');recent[holder]=Date.now();localStorage.setItem('keyRecentUse',JSON.stringify(recent));
  if(await saveEvents()){toast('열쇠 '+(action==='issue'?'수령':'반납')+' '+holder);renderTimeline();renderKeyBoard();}
  else{created.forEach(()=>events.pop());toast('저장 실패. 다시 시도해주세요.');}
  selectedIssueKeyIds.clear();selectedReturnKeyIds.clear();renderKeyDetailSelector();renderHeldKeySelector();renderPersonButtons();
}
function renderKeyBoard(){
  const board=document.getElementById('keyBoard');if(!board)return;
  const keyEvents=events.filter(e=>e.type==='key');
  if(!keyEvents.length){board.innerHTML='<div class="empty-state"><span class="material-icons-round">key_off</span><p>기록이 없어요</p></div>';return;}
  const issued=[];
  keyEvents.forEach((ev,i)=>{if(ev.action==='issue') issued.push({...ev,idx:i,matched:false,sig:keySigFromEvent(ev)});});
  keyEvents.forEach(ev=>{if(ev.action==='return'){const sig=keySigFromEvent(ev);const match=issued.find(is=>!is.matched&&is.subject===ev.subject&&is.sig===sig);if(match){match.matched=true;match.returnTime=ev.time;}}});
  const sorted=[...issued].sort((a,b)=>(a.matched?1:0)-(b.matched?1:0)||b.time.localeCompare(a.time));
  board.innerHTML=sorted.map(is=>{
    const label=escapeHtml(is.subject||'');
    const keyLabel=escapeHtml([is.location,is.key_name,is.key_number].filter(Boolean).join(' / '));
    const delBtn='<button class="btn-icon-sm btn-del" style="margin-left:6px;" onclick="deleteKeyEvent('+is.idx+')"><span class="material-icons-round">delete</span></button>';
    if(is.matched){
      return '<div class="entry-row done"><span class="entry-type" style="background:#4285f4;">반납</span><div class="entry-persons">'+label+'<div class="entry-meta">'+keyLabel+'</div></div><span style="font-size:12px;color:#999;margin-left:auto;">'+escapeHtml(is.time)+' ~ '+escapeHtml(is.returnTime)+'</span>'+delBtn+'</div>';
    }
    return '<div class="entry-row"><span class="entry-type" style="background:#f9ab00;">수령</span><div class="entry-persons">'+label+'<div class="entry-meta">'+keyLabel+'</div></div><span style="font-size:12px;color:#1a73e8;margin-left:auto;">'+escapeHtml(is.time)+'</span><button style="background:#4285f4;color:#fff;border:none;padding:6px 14px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;margin-left:8px;" onclick="returnKey(\''+String(is.subject||'').replace(/'/g,'&#39;')+'\',\''+String(is.location||'').replace(/'/g,'&#39;')+'\',\''+String(is.key_id||'').replace(/'/g,'&#39;')+'\')">반납</button>'+delBtn+'</div>';
  }).join('');
}
async function deleteKeyEvent(idx){
  if(idx<0||idx>=events.length)return;
  if(!confirm('삭제할까요?'))return;
  const bk=[...events];events.splice(idx,1);
  if(await saveEvents()){toast('삭제');renderTimeline();renderKeyBoard();}
  else{events=bk;toast('저장 실패.');renderKeyBoard();}
}
async function returnKey(subject,location,keyId){
  const held=getHolderHeldKeys(subject).find(k=>k.group===location&&(!keyId||k.key_id===keyId));
  if(!held){toast('반납할 키를 찾지 못했습니다');return;}
  events.push({time:nowTime(),type:'key',action:'return',subject,location,key_id:held.key_id,key_name:held.key_name,key_number:held.key_number});
  if(await saveEvents()){toast(subject+' '+location+' 반납');renderTimeline();renderKeyBoard();renderHeldKeySelector();}else events.pop();
}
function renderOTSummary(){
  const total=document.getElementById('otTodayTotal');
  const active=document.getElementById('otActiveCount');
  if(total) total.textContent='당일 누적 '+formatHourMinute(getOtTodayTotalMs()/60000);
  if(active) active.textContent='진행 중 '+otSessions.filter(s=>!s.end_time).length+'건';
}
function renderOTBoard(){
  const board=document.getElementById('otBoard');if(!board)return;
  if(!otSessions.length){board.innerHTML='<div class="empty-state"><span class="material-icons-round">check_circle</span><p>기록이 없어요</p></div>';return;}
  const active=otSessions.filter(s=>!s.end_time).sort((a,b)=>(b.start_time||'').localeCompare(a.start_time||''));
  const done=otSessions.filter(s=>s.end_time).sort((a,b)=>(b.end_time||'').localeCompare(a.end_time||''));
  const sectionHdr=(label,count)=>'<div class="section-hdr">'+label+' '+count+'</div>';
  const rows=[];
  if(active.length){
    rows.push(sectionHdr('진행 중',active.length));
    rows.push(active.map(s=>'<div class="entry-row"><span class="entry-type" style="background:#ea4335;">초과근무</span><div class="entry-persons">'+escapeHtml(s.subject)+'<div class="entry-meta">'+escapeHtml(s.start_time)+' ~ 현재</div></div><span class="entry-timer running">'+formatHourMinute(getOtElapsedMs(s)/60000)+'</span><div class="entry-actions"><button class="btn-stop-entry" onclick="stopOT(\''+s.id+'\')"><span class="material-icons-round">stop</span></button><button class="btn-icon btn-del" onclick="deleteOT(\''+s.id+'\')"><span class="material-icons-round">delete</span></button></div></div>').join(''));
  }
  if(done.length){
    rows.push(sectionHdr('완료',done.length));
    rows.push(done.map(s=>'<div class="entry-row done"><span class="entry-type" style="background:#ea4335;">초과근무</span><div class="entry-persons">'+escapeHtml(s.subject)+'<div class="entry-meta">'+escapeHtml(s.start_time)+' ~ '+escapeHtml(s.end_time)+'</div></div><span class="entry-timer">'+formatHourMinute(getOtElapsedMs(s)/60000)+'</span><button class="btn-icon btn-del" onclick="deleteOT(\''+s.id+'\')"><span class="material-icons-round">delete</span></button></div>').join(''));
  }
  board.innerHTML=rows.join('');
}
async function stopOT(id){
  const s=otSessions.find(x=>x.id===id);if(!s)return;
  s.end_time=nowTime();
  if(await saveOtSessions()){toast(s.subject+' 초과근무 종료');renderOTBoard();renderOTSummary();renderActiveBlock();}
}
async function deleteOT(id){
  if(!confirm('삭제할까요?'))return;
  const idx=otSessions.findIndex(x=>x.id===id);if(idx<0)return;
  const bk=[...otSessions];otSessions.splice(idx,1);
  if(await saveOtSessions()){toast('삭제');renderOTBoard();renderOTSummary();renderActiveBlock();}else{otSessions=bk;toast('저장 실패.');}
}

// ── 데이터 초기화 ──
async function clearTodayData(){
  if(!confirm('오늘('+viewDate+') 실시사항·초과근무 기록을 모두 삭제할까요?\n이 작업은 되돌릴 수 없습니다.'))return;
  events=[];await saveEvents();
  otSessions=[];await saveOtSessions();
  // 진행 중 타이머도 정리
  boardTimers={};timerIdCounter=0;saveBoardState();
  toast('오늘 기록 삭제 완료');
  renderTimeline();renderEntryBoard();renderInspectionBoard();renderKeyBoard();renderOTBoard();renderOTSummary();renderActiveBlock();
}
async function clearAllData(){
  if(!confirm('모든 날짜의 실시사항·초과근무 기록을 삭제할까요?\n인원/설정 정보는 유지됩니다. 이 작업은 되돌릴 수 없습니다.'))return;
  // event_dates 목록 돌면서 각 날짜 삭제
  const dates=[...datesWithData];
  dates.forEach(d=>{localStorage.removeItem('events_'+d);localStorage.removeItem('overtime_'+d);});
  localStorage.removeItem('event_dates');
  localStorage.removeItem('boardTimers');
  datesWithData=new Set();
  events=[];otSessions=[];
  boardTimers={};timerIdCounter=0;
  toast('전체 기록 삭제 완료');
  renderTimeline();renderEntryBoard();renderInspectionBoard();renderKeyBoard();renderOTBoard();renderOTSummary();renderActiveBlock();
}

// ── 타임라인 필터 ──
function setTlFilter(type){
  tlFilter=type;
  document.querySelectorAll('.tl-filter-chip').forEach(b=>{
    b.classList.toggle('active', b.dataset.type===type);
  });
  renderTimeline();
}

// ── 타임라인 상세 토글 ──
function tlToggle(detailId, btnId){
  const el=document.getElementById(detailId);
  if(!el)return;
  const open=el.style.display==='block';
  el.style.display=open?'none':'block';
  const btn=document.getElementById(btnId);
  if(btn){
    const icon=btn.querySelector('.material-icons-round');
    if(icon)icon.style.transform=open?'':'rotate(180deg)';
    btn.querySelector('span:last-child').textContent=open?'상세':'닫기';
  }
}

// ── 체크 멀티삭제 ──
function toggleCheck(idx,cb){
  if(cb.checked)checkedEvents.add(idx);else checkedEvents.delete(idx);
  const bar=document.getElementById('multiDelBar');
  const cnt=checkedEvents.size;
  document.getElementById('multiDelCount').textContent=cnt;
  bar.classList.toggle('show',cnt>0);
  cb.closest('.timeline-item').classList.toggle('checked',cb.checked);
}
async function deleteChecked(){
  if(!checkedEvents.size)return;
  if(!confirm(checkedEvents.size+'건 삭제할까요?'))return;
  const bk=[...events];
  const idxs=[...checkedEvents].sort((a,b)=>b-a);
  idxs.forEach(i=>events.splice(i,1));
  if(await saveEvents()){
    checkedEvents.clear();
    document.getElementById('multiDelBar').classList.remove('show');
    toast(idxs.length+'건 삭제');
    renderTimeline();renderEntryBoard();renderKeyBoard();renderAllBoards();
  }else{
    events=bk;toast('저장 실패.');renderTimeline();
  }
}
// ── 삭제/추가 ──
async function deleteEvent(idx){if(!confirm('삭제할까요?'))return;const bk=[...events];events.splice(idx,1);if(await saveEvents()){checkedEvents.delete(idx);toast('삭제');renderTimeline();renderEntryBoard();renderKeyBoard();renderAllBoards();}else{events=bk;toast('저장 실패. 다시 시도해주세요.');renderTimeline();}}
function _refreshPersonViews(){renderPersonButtons();renderSettings();renderEntryForm();renderPersonChips('patrol');renderPersonChips('cctv');renderPersonChips('ot');renderHvReceiverChips();renderHvGiverChips();}
async function addPerson(){const n=document.getElementById('newPersonName').value.trim();if(!n)return;personnel.push({name:n});document.getElementById('newPersonName').value='';if(await savePersonnel()){toast(n+' 추가');_refreshPersonViews();}else{personnel.pop();document.getElementById('newPersonName').value=n;toast('저장 실패.');}}
async function removePerson(i){if(!confirm(personnel[i].name+' 삭제?'))return;const bk=[...personnel];personnel.splice(i,1);if(await savePersonnel()){_refreshPersonViews();}else{personnel=bk;toast('저장 실패.');renderSettings();}}
async function addPerson2(){const n=document.getElementById('newPerson2Name').value.trim();if(!n)return;personnel2.push({name:n});document.getElementById('newPerson2Name').value='';if(await savePersonnel()){toast(n+' 추가(2)');_refreshPersonViews();}else{personnel2.pop();document.getElementById('newPerson2Name').value=n;toast('저장 실패.');}}
async function removePerson2(i){if(!confirm(personnel2[i].name+' 삭제?'))return;const bk=[...personnel2];personnel2.splice(i,1);if(await savePersonnel()){_refreshPersonViews();}else{personnel2=bk;toast('저장 실패.');renderSettings();}}
async function addPerson3(){const n=document.getElementById('newPerson3Name').value.trim();if(!n)return;personnel3.push({name:n});document.getElementById('newPerson3Name').value='';if(await savePersonnel()){toast(n+' 추가(3)');_refreshPersonViews();}else{personnel3.pop();document.getElementById('newPerson3Name').value=n;toast('저장 실패.');}}
async function removePerson3(i){if(!confirm(personnel3[i].name+' 삭제?'))return;const bk=[...personnel3];personnel3.splice(i,1);if(await savePersonnel()){_refreshPersonViews();}else{personnel3=bk;toast('저장 실패.');renderSettings();}}
async function addKeyPreset(){const n=document.getElementById('newKeyPreset').value.trim();if(!n)return;keyPresets.push(n);ensureKeyCatalog();document.getElementById('newKeyPreset').value='';if(await savePersonnel()){renderKeyPresets();renderSettings();renderKeyDetailSelector();}else{keyPresets.pop();document.getElementById('newKeyPreset').value=n;toast('저장 실패.');}}
async function removeKeyPreset(i){if(!confirm(keyPresets[i]+' 삭제?'))return;const bk=[...keyPresets];keyPresets.splice(i,1);ensureKeyCatalog();if(await savePersonnel()){renderKeyPresets();renderSettings();renderKeyDetailSelector();}else{keyPresets=bk;toast('저장 실패.');renderSettings();}}
async function addEntryType(){const n=document.getElementById('newEntryType').value.trim();if(!n)return;entryTypes.push(n);document.getElementById('newEntryType').value='';if(await savePersonnel()){renderSettings();renderEntryForm();}else{entryTypes.pop();document.getElementById('newEntryType').value=n;toast('저장 실패.');}}
async function removeEntryType(i){if(!confirm(entryTypes[i]+' 삭제?'))return;const bk=[...entryTypes];entryTypes.splice(i,1);if(await savePersonnel()){renderSettings();renderEntryForm();}else{entryTypes=bk;toast('저장 실패.');renderSettings();}}

// ── 설정 섹션 토글 ──
function toggleSetting(id){
  const body=document.getElementById(id+'-body');
  const icon=document.getElementById(id+'-icon');
  if(!body)return;
  const open=body.style.display!=='none';
  body.style.display=open?'none':'block';
  if(icon)icon.textContent=open?'expand_more':'expand_less';
}

// ── 토글 접기/펼치기 ──
function toggleAddForm(ctx){
  const bodyMap={
    entry:'entryAddBody',ot:'otAddBody',key:'keyAddBody',
    'manual-entry':'manualEntryBody','manual-key':'manualKeyBody'
  };
  const iconMap={
    entry:'entryToggleIcon',ot:'otToggleIcon',key:'keyToggleIcon',
    'manual-entry':'manualEntryIcon','manual-key':'manualKeyIcon'
  };
  const body=document.getElementById(bodyMap[ctx]),icon=document.getElementById(iconMap[ctx]);
  if(!body)return;
  const open=body.style.display!=='none';
  body.style.display=open?'none':'block';
  if(icon)icon.textContent=open?'expand_more':'expand_less';
  if(!open&&ctx==='key'){renderHandoverChips();renderKeyPersonSelector();renderKeyDetailSelector();renderHeldKeySelector();updateKeyBtns();}
  if(!open&&ctx==='ot'){makeTimePicker('otBaseTp');makeTimePicker('otEndTp');}
  if(!open&&ctx==='manual-entry'){makeTimePicker('mEntryTimeTp');}
  if(!open&&ctx==='manual-key'){makeTimePicker('mKeyTimeTp');}
}

// ── 항목 수정 ──
function editBoard(id){
  const t=boardTimers[id];if(!t)return;
  const newType=prompt('유형 수정:',t.type);
  if(newType!==null&&newType.trim())t.type=newType.trim();
  const newPersons=prompt('대상자 수정 (쉼표 구분):',t.persons);
  if(newPersons!==null&&newPersons.trim())t.persons=newPersons.trim();
  const newNote=prompt('메모 수정:',t.note||'');
  if(newNote!==null)t.note=newNote;
  saveBoardState();renderAllBoards();
  toast('수정 완료');
}
function deleteBoardTimer(id){
  if(!confirm('삭제할까요?'))return;
  const t=boardTimers[id];if(!t)return;
  delete boardTimers[id];
  saveBoardState();renderAllBoards();
  toast('삭제');
}

function syncToMaru(){
  const json=JSON.stringify({date:viewDate,events,overtime_sessions:otSessions},null,2);
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(json).then(()=>toast('복사 완료! 텔레그램에 붙여넣기 하세요')).catch(()=>fallbackCopy(json));
  }else{fallbackCopy(json);}
}
function fallbackCopy(text){
  const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.focus();ta.select();
  try{document.execCommand('copy');toast('복사 완료! 텔레그램에 붙여넣기 하세요');}
  catch(e){toast('복사 실패. 직접 선택해주세요.');}
  document.body.removeChild(ta);
}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2000);}

// ── 월간 캘린더 ──
let calViewYear=new Date().getFullYear();
let calViewMonth=new Date().getMonth();

function renderCalendar(){
  const area=document.getElementById('calendarArea');
  if(!area) return;

  const year=calViewYear;
  const month=calViewMonth;
  const firstDay=new Date(year,month,1).getDay();
  const lastDate=new Date(year,month+1,0).getDate();

  function getWeekOfMonth(date){
    const first=new Date(date.getFullYear(),date.getMonth(),1);
    return Math.ceil((date.getDate()+first.getDay())/7);
  }

  function getCctvSchedule(day){
    const d=new Date(year,month,day);
    if(d.getDay()!==5) return null; // 금요일만
    const week=getWeekOfMonth(d);
    if(week===1||week===3||week===5) return {who:'대대장',label:'CCTV점검'};
    if(week===2||week===4) return {who:'군수과장',label:'CCTV점검'};
    return null;
  }

  function getOtForDate(day){
    const dateStr=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    const otEvents=events.filter(e=>e.date===dateStr&&e.category==='overtime');
    return otEvents.length;
  }

  function hasEvents(day){
    const dateStr=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    return events.some(e=>e.date===dateStr);
  }

  const monthNames=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const dayNames=['일','월','화','수','목','금','토'];

  let html='<div class="cal-header">';
  html+='<button class="cal-nav-btn" onclick="changeCalMonth(-1)"><span class="material-icons-round">chevron_left</span></button>';
  html+='<span class="cal-month-label">'+year+'년 '+monthNames[month]+'</span>';
  html+='<button class="cal-nav-btn" onclick="changeCalMonth(1)"><span class="material-icons-round">chevron_right</span></button>';
  html+='</div>';

  html+='<div class="cal-grid">';
  dayNames.forEach((d,i)=>{
    const cls=i===0?'cal-day-name sun':i===6?'cal-day-name sat':'cal-day-name';
    html+='<div class="'+cls+'">'+d+'</div>';
  });

  for(let i=0;i<firstDay;i++) html+='<div class="cal-cell empty"></div>';

  const today=new Date();
  const isCurrentMonth=(today.getFullYear()===year&&today.getMonth()===month);

  for(let d=1;d<=lastDate;d++){
    const isToday=isCurrentMonth&&today.getDate()===d;
    const cctv=getCctvSchedule(d);
    const otCount=getOtForDate(d);
    const hasEvt=hasEvents(d);
    const dateObj=new Date(year,month,d);
    const dow=dateObj.getDay();

    let cellCls='cal-cell';
    if(isToday) cellCls+=' today';
    if(dow===0) cellCls+=' sun';
    if(dow===6) cellCls+=' sat';

    const dateStr=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');

    html+='<div class="'+cellCls+'" onclick="calDateClick(\''+dateStr+'\')">';
    html+='<span class="cal-date-num">'+d+'</span>';

    if(cctv){
      html+='<div class="cal-event cctv">'+cctv.who+'</div>';
    }
    if(otCount>0){
      html+='<div class="cal-event ot">초과'+otCount+'</div>';
    }
    if(hasEvt&&!otCount){
      html+='<div class="cal-dot"></div>';
    }

    html+='</div>';
  }
  html+='</div>';

  // 이번 달 초과근무 요약
  html+='<div class="cal-ot-summary">';
  html+='<div class="card-title"><span class="material-icons-round" style="font-size:16px;vertical-align:middle;">more_time</span> 이번 달 초과근무 요약</div>';
  const monthStr=year+'-'+String(month+1).padStart(2,'0');
  const monthOt=events.filter(e=>e.date&&e.date.startsWith(monthStr)&&e.category==='overtime');
  if(monthOt.length){
    html+='<div class="cal-ot-list">';
    monthOt.forEach(e=>{
      html+='<div class="cal-ot-row"><span class="cal-ot-date">'+e.date.slice(5)+'</span><span class="cal-ot-desc">'+e.desc+'</span></div>';
    });
    html+='</div>';
  } else {
    html+='<div class="empty-state" style="padding:16px;"><span class="material-icons-round">event_available</span><p>이번 달 초과근무 기록 없음</p></div>';
  }
  html+='</div>';

  area.innerHTML=html;
}

function changeCalMonth(delta){
  calViewMonth+=delta;
  if(calViewMonth>11){calViewMonth=0;calViewYear++;}
  if(calViewMonth<0){calViewMonth=11;calViewYear--;}
  renderCalendar();
}

function calDateClick(dateStr){
  viewDate=dateStr;
  updateDateLabel();
  loadEvents();
  document.querySelectorAll('.nav-item').forEach(n=>{
    if(n.dataset.page==='timeline') n.click();
  });
}

// ── 데이터 내보내기/가져오기 ──
function exportData(){
  const data={
    events: JSON.parse(localStorage.getItem('events')||'[]'),
    personnel: JSON.parse(localStorage.getItem('personnel')||'[]'),
    personnel2: JSON.parse(localStorage.getItem('personnel2')||'[]'),
    personnel3: JSON.parse(localStorage.getItem('personnel3')||'[]'),
    keyPresets: JSON.parse(localStorage.getItem('keyPresets')||'[]'),
    keyCatalog: JSON.parse(localStorage.getItem('keyCatalog')||'[]'),
    entryTypes: JSON.parse(localStorage.getItem('entryTypes')||'[]'),
    boardTimers: JSON.parse(localStorage.getItem('boardTimers')||'{}'),
    otSessions: JSON.parse(localStorage.getItem('otSessions')||'[]'),
    event_dates: JSON.parse(localStorage.getItem('event_dates')||'[]'),
    exportDate: new Date().toISOString()
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='maru_backup_'+todayLocal()+'.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('데이터 내보내기 완료');
}

function importData(event){
  const file=event.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const data=JSON.parse(e.target.result);
      if(data.events) localStorage.setItem('events',JSON.stringify(data.events));
      if(data.personnel) localStorage.setItem('personnel',JSON.stringify(data.personnel));
      if(data.personnel2) localStorage.setItem('personnel2',JSON.stringify(data.personnel2));
      if(data.personnel3) localStorage.setItem('personnel3',JSON.stringify(data.personnel3));
      if(data.keyPresets) localStorage.setItem('keyPresets',JSON.stringify(data.keyPresets));
      if(data.keyCatalog) localStorage.setItem('keyCatalog',JSON.stringify(data.keyCatalog));
      if(data.entryTypes) localStorage.setItem('entryTypes',JSON.stringify(data.entryTypes));
      if(data.boardTimers) localStorage.setItem('boardTimers',JSON.stringify(data.boardTimers));
      if(data.otSessions) localStorage.setItem('otSessions',JSON.stringify(data.otSessions));
      if(data.event_dates) localStorage.setItem('event_dates',JSON.stringify(data.event_dates));
      toast('데이터 가져오기 완료 — 새로고침합니다');
      setTimeout(()=>location.reload(),1000);
    }catch(err){
      toast('파일 형식 오류: '+err.message);
    }
  };
  reader.readAsText(file);
}

init();

// 날짜 자동 갱신 - 화면 켜거나 탭 포커스 시 체크
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    const today=todayLocal();
    if(viewDate!==today){viewDate=today;updateDateLabel();loadEvents();renderAllBoards();}
  }
});