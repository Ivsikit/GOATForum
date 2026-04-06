function getUsers(){
  try{return JSON.parse(localStorage.getItem('goat_users'))||[];}catch{return[];}
}
function saveUsers(u){localStorage.setItem('goat_users',JSON.stringify(u));}
function setCurrentUser(u){localStorage.setItem('goat_currentUser',JSON.stringify(u));}
function getCurrentUser(){
  try{return JSON.parse(localStorage.getItem('goat_currentUser'));}catch{return null;}
}
function isAuthenticated(){return Boolean(getCurrentUser());}
function isAdmin(){const u=getCurrentUser();return u&&u.isAdmin;}

function signup(name,email,password,role='user'){
  if(!name||!email||!password) return{success:false,message:'Заповніть усі поля'};
  const users=getUsers();
  if(users.find(u=>u.email===email)) return{success:false,message:'Користувач з таким email вже існує'};
  const newUser={
    id:Date.now(),name,email,password,role,
    isAdmin:role==='admin',
    karma:1,contributions:0,
    joinedAt:new Date().toLocaleDateString('uk-UA'),
    posts:[],savedPosts:[]
  };
  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);
  return{success:true,message:'Реєстрація успішна',user:newUser};
}

function signin(email,password){
  if(!email||!password) return{success:false,message:'Введіть email та пароль'};
  const user=getUsers().find(u=>u.email===email&&u.password===password);
  if(!user) return{success:false,message:'Неправильний email або пароль'};
  setCurrentUser(user);
  return{success:true,message:'Вхід успішний',user};
}

function signout(){
  localStorage.removeItem('goat_currentUser');
}

function updateStoredUser(user){
  setCurrentUser(user);
  const users=getUsers();
  const i=users.findIndex(u=>u.id===user.id);
  if(i>=0){users[i]=user;saveUsers(users);}
}

// ═══════════════════════════ POSTS DATA ═══════════════════════════

const posts=[
  {id:0,sub:'r/GlobalOffensive',subColor:'#ff4500',author:'ZywOo_fan',time:'3 год тому',flair:'CS2',flairClass:'flair-cs',
   title:'Olofmeister злякався після матчу проти ZywOo, m0NESY, donk, NiKo & YEKINDAR 1 квітня',
   emoji:'🎮',votes:4700,comments:214,body:'Легенда CS:GO потрапила у матч мрії — і виглядало це дуже кумедно. Скріншот з FACEIT розлетівся по всьому Twitter за лічені години.'},
  {id:1,sub:'r/технології',subColor:'#58a6ff',author:'dev_maks',time:'5 год тому',flair:'Технології',flairClass:'flair-tech',
   title:'React 20 офіційно вийшов — нові хуки та покращена продуктивність',
   emoji:'💻',votes:2100,comments:89,body:'Meta випустила React 20 з революційними змінами: новий компілятор, автоматична мемоїзація та значно менший bundle size.'},
  {id:2,sub:'r/навчання',subColor:'#3fb950',author:'study_olya',time:'1 день тому',flair:'Навчання',flairClass:'flair-tech',
   title:'Яку мову програмування краще вивчати у 2026 році? Моя думка після 3 років досвіду',
   emoji:'📚',votes:891,comments:143,body:'Пройшла шлях від нуля до Middle: Python для старту, потім TypeScript. Ось моя детальна розбивка по категоріях.'},
  {id:3,sub:'r/спорт',subColor:'#fb8c00',author:'footbal_ivan',time:'2 дні тому',flair:'Спорт',flairClass:'flair-news',
   title:'Фінал Ліги чемпіонів 2026 — Барселона vs ПСЖ: ваші прогнози?',
   emoji:'⚽',votes:3420,comments:512,body:'До фіналу залишилось менше тижня. Хто фаворит і чому Левандовський знову стане найкращим бомбардиром — обговорюємо!'},
  {id:4,sub:'r/фільми',subColor:'#ab47bc',author:'kino_luda',time:'4 дні тому',flair:'Фільми',flairClass:'flair-cs',
   title:'Топ-10 фільмів 2026 року — особиста підбірка з поясненнями',
   emoji:'🎬',votes:1560,comments:77,body:'Переглянула понад 80 фільмів цього року. Склала список із найкращих без спойлерів.'}
];
const voteMap={};

// ═══════════════════════════ HEADER UI ═══════════════════════════

function renderHeader(){
  const user=getCurrentUser();
  const ha=document.getElementById('headerActions');
  const cpw=document.getElementById('createPostWidget');

  if(user){
    const ini=user.name.slice(0,2).toUpperCase();
    ha.innerHTML=`
      <button style="background:var(--surface2);border:1px solid var(--border);color:var(--text);display:flex;align-items:center;gap:6px;border-radius:20px;padding:6px 14px;font-size:13px" onclick="openModal('createPostOverlay')">✏️ Створити</button>
      <button class="notif-btn"><span>🔔</span><span class="notif-dot"></span></button>
      <div class="avatar-wrap">
        <div class="user-avatar" id="avatarBtn" onclick="toggleDropdown()" title="${user.name}">${ini}</div>
        <div class="avatar-dropdown" id="avatarDropdown">
          <div class="dd-header">
            <div style="font-weight:700">${user.name}${user.isAdmin?' <span style="background:rgba(255,69,0,.15);color:var(--accent);font-size:10px;padding:1px 7px;border-radius:10px;border:1px solid rgba(255,69,0,.3)">АДМІН</span>':''}</div>
            <div style="color:var(--muted);font-size:12px">⭐ ${user.karma} карма</div>
          </div>
          <div class="dd-item" onclick="closeDropdown();goProfile()"><span>👤</span> Профіль</div>
          <div class="dd-item" onclick="closeDropdown();openModal('createPostOverlay')"><span>✏️</span> Створити пост</div>
          <div class="dd-item" onclick="closeDropdown();showToast('Незабаром 🛠️')"><span>⚙️</span> Налаштування</div>
          <div class="dd-divider"></div>
          <div class="dd-item danger" onclick="closeDropdown();doSignout()"><span>🚪</span> Вийти</div>
        </div>
      </div>`;
    // Create post widget in right sidebar
    cpw.innerHTML=`
      <div class="widget" style="margin-bottom:12px">
        <div class="widget-body" style="padding:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <div class="user-avatar" style="width:36px;height:36px;font-size:14px;flex-shrink:0">${ini}</div>
            <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:8px 14px;color:var(--muted);font-size:13px;cursor:pointer;transition:border-color .15s" onclick="openModal('createPostOverlay')" onmouseover="this.style.borderColor='var(--muted)'" onmouseout="this.style.borderColor='var(--border)'">
              Створити пост…
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="openModal('createPostOverlay')" style="flex:1;background:none;border:1px solid var(--border);color:var(--muted);border-radius:20px;padding:6px 10px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .15s" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
              🖼️ Фото
            </button>
            <button onclick="openModal('createPostOverlay')" style="flex:1;background:none;border:1px solid var(--border);color:var(--muted);border-radius:20px;padding:6px 10px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .15s" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
              🔗 Посилання
            </button>
          </div>
        </div>
      </div>`;
  } else {
    ha.innerHTML=`
      <button class="btn btn-ghost" onclick="openModal('loginOverlay')">Вхід</button>
      <button class="btn btn-accent" onclick="openModal('registerOverlay')">Реєстрація</button>`;
    cpw.innerHTML=''; // no widget for guests
  }
}

function toggleDropdown(){
  const dd=document.getElementById('avatarDropdown');
  if(dd) dd.classList.toggle('open');
}
function closeDropdown(){
  const dd=document.getElementById('avatarDropdown');
  if(dd) dd.classList.remove('open');
}
// Close dropdown on outside click
document.addEventListener('click',e=>{
  if(!e.target.closest('.avatar-wrap')) closeDropdown();
});

// ═══════════════════════════ AUTH ACTIONS ═══════════════════════════

function doSignin(){
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value;
  const result=signin(email,password);
  const err=document.getElementById('loginError');
  if(!result.success){err.textContent=result.message;err.classList.add('show');return;}
  err.classList.remove('show');
  closeModal('loginOverlay');
  renderHeader();renderFeed();
  showToast('✅ Ласкаво просимо, '+result.user.name+'!','success');
}

function doSignup(){
  const name=document.getElementById('regName').value.trim();
  const email=document.getElementById('regEmail').value.trim();
  const password=document.getElementById('regPassword').value;
  const role=document.getElementById('regRole').value;
  const result=signup(name,email,password,role);
  const err=document.getElementById('registerError');
  if(!result.success){err.textContent=result.message;err.classList.add('show');return;}
  err.classList.remove('show');
  closeModal('registerOverlay');
  renderHeader();renderFeed();
  showToast('✅ Акаунт створено! Ласкаво просимо, '+name+'!','success');
}

function doSignout(){
  signout();renderHeader();renderFeed();setPage('home');showToast('До побачення!');
}

function requireAuth(){
  if(!isAuthenticated()){openModal('loginOverlay');return false;}
  return true;
}

// ═══════════════════════════ PROFILE PAGE ═══════════════════════════

let profileTab='overview';

function goProfile(){
  if(!requireAuth())return;
  renderProfile('overview');
  setPage('profile');
}

function renderProfile(tab){
  if(tab)profileTab=tab;
  const user=getCurrentUser();
  if(!user)return;
  const ini=user.name.slice(0,2).toUpperCase();
  const handle='u/'+user.name.toLowerCase().replace(/\s+/g,'_');

  const tabsConfig=[
    {id:'overview',label:'Огляд'},
    {id:'posts',label:'Пости'},
    {id:'comments',label:'Коментарі'},
    {id:'saved',label:'Збережене'},
    {id:'upvoted',label:'Вподобані'},
    {id:'downvoted',label:'Не вподобані'},
  ];

  const emptyMap={
    overview:{icon:'🐐',title:'Постів ще немає',sub:'Щойно ви опублікуєте пост, він з\'явиться тут.'},
    posts:{icon:'📝',title:'Постів ще немає',sub:'Натисніть «Створити пост», щоб написати щось нове.'},
    comments:{icon:'💬',title:'Коментарів ще немає',sub:'Візьміть участь в обговоренні.'},
    saved:{icon:'🔖',title:'Збережених постів немає',sub:'Натисніть «Зберегти» під будь-яким постом.'},
    upvoted:{icon:'⭐',title:'Вподобаних немає',sub:'Голосуйте вгору за пости — і вони збережуться тут.'},
    downvoted:{icon:'👎',title:'Не вподобаних немає',sub:'Голосуйте вниз за пости — і вони збережуться тут.'},
  };
  const e=emptyMap[profileTab]||emptyMap.overview;

  document.getElementById('profileContent').innerHTML=`
    <div class="profile-header-card">
      <div class="profile-banner"></div>
      <div class="profile-avatar-wrap">
        <div class="profile-avatar-big">${ini}</div>
      </div>
      <div class="profile-info-row">
        <div>
          <div class="profile-name">${user.name}${user.isAdmin?'<span class="admin-badge">АДМІН</span>':''}</div>
          <div class="profile-handle">${handle}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" style="border-radius:8px;display:flex;align-items:center;gap:6px" onclick="shareProfile()">🔗 Поділитись</button>
          <button class="btn btn-accent" style="border-radius:8px" onclick="showToast('Незабаром буде доступно 🛠️')">Редагувати профіль</button>
        </div>
      </div>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden">
      <div class="profile-tabs">
        ${tabsConfig.map(t=>`<div class="profile-tab${profileTab===t.id?' active':''}" onclick="renderProfile('${t.id}')">${t.label}</div>`).join('')}
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px;color:var(--muted)">👁 Показати весь контент</span>
        <button class="btn btn-ghost" style="border-radius:8px;padding:5px 14px;font-size:12px" onclick="setPage('home');showToast('Перейдіть на головну, щоб написати')">+ Створити пост</button>
      </div>
      <div class="profile-empty">
        <div class="profile-empty-icon">${e.icon}</div>
        <h3>${e.title}</h3>
        <p style="font-size:13px;margin-bottom:16px">${e.sub}</p>
      </div>
    </div>

    <div class="profile-layout">
      <div></div><!-- left spacer, content above -->
      <div>
        <div class="widget">
          <div class="widget-header">📊 Статистика</div>
          <div class="widget-body" style="padding:8px 14px">
            <div class="profile-stat-row"><span class="profile-stat-label">Карма</span><span style="font-weight:700">⭐ ${user.karma}</span></div>
            <div class="profile-stat-row"><span class="profile-stat-label">Внески</span><span style="font-weight:700">${user.contributions||0}</span></div>
            <div class="profile-stat-row"><span class="profile-stat-label">Вік акаунту</span><span style="font-weight:700">з ${user.joinedAt||'2026'}</span></div>
            <div class="profile-stat-row"><span class="profile-stat-label">Активний у</span><span style="font-weight:700">0 спільнот</span></div>
            <div class="profile-stat-row"><span class="profile-stat-label">Золото</span><span style="font-weight:700">🥇 0</span></div>
            <div class="profile-stat-row"><span class="profile-stat-label">Роль</span><span style="font-weight:700;color:${user.isAdmin?'var(--accent)':'var(--green)'}">${user.isAdmin?'Адмін':'Користувач'}</span></div>
          </div>
        </div>
        <div class="widget">
          <div class="widget-header">🏆 Досягнення</div>
          <div class="widget-body">
            <div class="achievement-grid">
              <div class="achievement" title="Новий учасник">🌱</div>
              <div class="achievement" title="Перший крок">👋</div>
              <div class="achievement" title="Зареєстрований">✅</div>
              <div class="achievement locked" title="100 карми (заблоковано)">⭐</div>
              <div class="achievement locked" title="Популярний пост (заблоковано)">🔥</div>
              <div class="achievement locked" title="1000 карми (заблоковано)">🌟</div>
            </div>
            <div style="margin-top:10px;font-size:12px;color:var(--muted)">3 розблоковано · <a style="color:var(--blue);cursor:pointer" onclick="showToast('Незабаром 🛠️')">Переглянути всі</a></div>
          </div>
        </div>
        <div class="widget">
          <div class="widget-header">⚙️ Налаштування</div>
          <div class="widget-body" style="padding:8px 14px">
            <div class="profile-stat-row" style="cursor:pointer" onclick="showToast('Незабаром 🛠️')"><span>👤 Профіль</span><span style="color:var(--muted);font-size:12px">Змінити →</span></div>
            <div class="profile-stat-row" style="cursor:pointer" onclick="showToast('Незабаром 🛠️')"><span>🔒 Приватність</span><span style="color:var(--muted);font-size:12px">Змінити →</span></div>
            <div class="profile-stat-row" style="cursor:pointer" onclick="doSignout()"><span style="color:var(--accent)">🚪 Вийти</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function shareProfile(){
  navigator.clipboard?.writeText(location.href+'#profile');
  showToast('🔗 Посилання скопійовано!','success');
}

// ═══════════════════════════ FEED ═══════════════════════════

function renderFeed(data){
  const list=data||posts;
  document.getElementById('postFeed').innerHTML=list.map(p=>postCard(p)).join('');
}

function postCard(p){
  const v=voteMap[p.id]||0;
  const commentCount = postComments[p.id]?.length ?? p.comments;
  return`<div class="post-card" onclick="openPost(${p.id})">
    <div class="post-vote" onclick="event.stopPropagation()">
      <button class="vote-btn${v===1?' voted':''}" onclick="castVote(${p.id},1)">▲</button>
      <div class="vote-count">${fmtNum(p.votes+v)}</div>
      <button class="vote-btn${v===-1?' voted':''}" onclick="castVote(${p.id},-1)">▼</button>
    </div>
    <div class="post-body">
      <div class="post-meta">
        <div class="post-sub"><div class="sub-icon" style="background:${p.subColor}">${p.sub[2].toUpperCase()}</div>${p.sub}</div>
        <span class="post-author">Автор: <span>${p.author}</span></span>
        <span class="post-time">· ${p.time}</span>
        <span class="flair ${p.flairClass}">${p.flair}</span>
      </div>
      <div class="post-title">${p.title}</div>
      <div class="post-actions">
        <button class="action-btn">💬 ${fmtNum(commentCount)}</button>
        <button class="action-btn" onclick="event.stopPropagation();sharePost(${p.id})">🔗 Поділитись</button>
        <button class="action-btn" onclick="event.stopPropagation();savePost(${p.id})">🔖 Зберегти</button>
      </div>
    </div>
    <div class="post-thumb">${p.emoji}</div>
  </div>`;
}

// comments stored per post id
const postComments = {};

function openPost(id){
  const p = posts.find(x => x.id === id);
  if(!p) return;
  const v = voteMap[id] || 0;
  const auth = isAuthenticated();
  const comments = postComments[id] || [];

  document.getElementById('postViewContent').innerHTML = `
    <div style="margin-bottom:12px"><button class="action-btn" onclick="setPage('home')">← Назад</button></div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:12px">
      <div style="display:flex">
        <div class="post-vote" style="padding:16px 0">
          <button class="vote-btn${v===1?' voted':''}" onclick="castVote(${p.id},1);openPost(${p.id})">▲</button>
          <div class="vote-count">${fmtNum(p.votes+v)}</div>
          <button class="vote-btn${v===-1?' voted':''}" onclick="castVote(${p.id},-1);openPost(${p.id})">▼</button>
        </div>
        <div style="padding:16px;flex:1">
          <div class="post-meta" style="margin-bottom:10px">
            <div class="post-sub"><div class="sub-icon" style="background:${p.subColor}">${p.sub[2].toUpperCase()}</div>${p.sub}</div>
            <span class="post-author">Автор: <span>${p.author}</span></span>
            <span class="post-time">· ${p.time}</span>
          </div>
          <div class="post-title" style="font-size:1.3rem;margin-bottom:12px">${p.title}</div>
          <div style="font-size:40px;text-align:center;background:var(--surface2);border-radius:8px;padding:24px;margin-bottom:12px">${p.emoji}</div>
          ${p.body ? `<p style="line-height:1.7;margin-bottom:14px">${p.body}</p>` : ''}
          <div class="post-actions">
            <button class="action-btn">💬 ${comments.length}</button>
            <button class="action-btn" onclick="sharePost(${p.id})">🔗 Поділитись</button>
            <button class="action-btn" onclick="savePost(${p.id})">🔖 Зберегти</button>
          </div>
        </div>
      </div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px" id="commentsSection">
      <div style="font-weight:700;margin-bottom:12px">💬 Коментарі (${comments.length})</div>
      ${auth
        ? `<div style="display:flex;gap:10px;margin-bottom:16px">
             <div class="user-avatar" style="width:32px;height:32px;font-size:13px;flex-shrink:0">${getCurrentUser().name.slice(0,2).toUpperCase()}</div>
             <div style="flex:1">
               <textarea id="commentBox" placeholder="Напишіть коментар…" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font-body);font-size:14px;padding:10px;resize:vertical;min-height:72px;outline:none;transition:border-color .15s" onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'"></textarea>
               <div style="text-align:right;margin-top:6px"><button class="btn btn-accent" style="border-radius:8px;padding:6px 18px" onclick="postComment(${p.id})">Надіслати</button></div>
             </div>
           </div>`
        : `<div style="background:var(--surface2);border-radius:8px;padding:14px;text-align:center;color:var(--muted);margin-bottom:16px">
             <a style="color:var(--blue);cursor:pointer" onclick="openModal('loginOverlay')">Увійдіть</a>, щоб залишити коментар
           </div>`}
      <div id="commentsList">
        ${comments.length === 0
          ? `<div style="text-align:center;padding:32px 0;color:var(--muted)">
               <div style="font-size:36px;margin-bottom:8px">💬</div>
               <div style="font-size:14px">Коментарів ще немає. Будьте першим!</div>
             </div>`
          : comments.map(c => renderComment(c)).join('')}
      </div>
    </div>`;
  setPage('post');
}

function renderComment(c){
  return `<div style="display:flex;gap:10px;margin-bottom:14px">
    <div class="user-avatar" style="width:28px;height:28px;font-size:12px;flex-shrink:0">${c.author[0].toUpperCase()}</div>
    <div style="flex:1">
      <div style="font-size:12px;color:var(--blue);font-weight:600">${c.author} <span style="color:var(--muted);font-weight:400">· ${c.time}</span></div>
      <div style="font-size:14px;margin-top:4px;line-height:1.6">${c.text}</div>
      <div style="margin-top:6px;display:flex;gap:6px">
        <button class="action-btn" style="padding:2px 8px;font-size:12px" onclick="requireAuth()">▲ ${c.likes||0}</button>
        <button class="action-btn" style="padding:2px 8px;font-size:12px" onclick="requireAuth()">↩ Відповісти</button>
      </div>
    </div>
  </div>`;
}

function postComment(postId){
  const box = document.getElementById('commentBox');
  if(!box || !box.value.trim()) return;
  const user = getCurrentUser();
  const comment = {
    author: user.name,
    time: 'щойно',
    text: box.value.trim(),
    likes: 0
  };
  if(!postComments[postId]) postComments[postId] = [];
  postComments[postId].push(comment);
  // update post comment count
  const p = posts.find(x => x.id === postId);
  if(p) p.comments = postComments[postId].length;
  // bump karma
  user.karma = (user.karma||1) + 1;
  user.contributions = (user.contributions||0) + 1;
  updateStoredUser(user);
  box.value = '';
  // re-render comments section live
  const list = document.getElementById('commentsList');
  const header = document.querySelector('#commentsSection div');
  if(header) header.textContent = `💬 Коментарі (${postComments[postId].length})`;
  if(list) list.innerHTML = postComments[postId].map(c => renderComment(c)).join('');
  renderHeader();
  showToast('✅ Коментар опубліковано!', 'success');
}

function castVote(id,dir){
  if(!requireAuth())return;
  voteMap[id]=voteMap[id]===dir?0:dir;
  renderFeed();
}

function savePost(id){
  if(!requireAuth())return;
  showToast('🔖 Збережено!','success');
}

// ═══════════════════════════ SEARCH / SORT ═══════════════════════════

function handleSearch(q){
  const f=q.trim()?posts.filter(p=>p.title.toLowerCase().includes(q.toLowerCase())||p.sub.toLowerCase().includes(q.toLowerCase())):posts;
  renderFeed(f);
  if(document.getElementById('page-post').classList.contains('active'))setPage('home');
}

function setSort(btn,type){
  document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const s=[...posts];
  if(type==='hot')s.sort((a,b)=>b.comments-a.comments);
  else if(type==='new')s.sort(()=>Math.random()-.5);
  else if(type==='top')s.sort((a,b)=>b.votes-a.votes);
  else s.sort((a,b)=>(b.votes+b.comments)-(a.votes+a.comments));
  renderFeed(s);
}

// ═══════════════════════════ PAGES ═══════════════════════════

function setPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  (document.getElementById('page-'+name)||document.getElementById('page-home')).classList.add('active');
  window.scrollTo(0,0);
}

// ═══════════════════════════ HELPERS ═══════════════════════════

function fmtNum(n){return n>=1000?(n/1000).toFixed(1)+'K':n;}
function sharePost(id){navigator.clipboard?.writeText(location.href+'#post-'+id);showToast('🔗 Посилання скопійовано!','success');}
function shareProfile(){navigator.clipboard?.writeText(location.href+'#profile');showToast('🔗 Посилання скопійовано!','success');}
function toggleJoin(btn){if(!requireAuth())return;const j=btn.classList.toggle('joined');btn.textContent=j?'Вийти':'Приєднатись';showToast(j?'✅ Ви приєднались до спільноти':'Ви покинули спільноту','success');}

function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function closeIfOverlay(e,id){if(e.target.id===id)closeModal(id);}
function switchToRegister(){closeModal('loginOverlay');openModal('registerOverlay');}
function switchToLogin(){closeModal('registerOverlay');openModal('loginOverlay');}

let toastTimer;
function showToast(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast '+type;t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

document.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    if(document.getElementById('loginOverlay').classList.contains('open'))doSignin();
    if(document.getElementById('registerOverlay').classList.contains('open'))doSignup();
  }
  if(e.key==='Escape'){closeModal('loginOverlay');closeModal('registerOverlay');}
});

// ═══════════════════════════ CREATE POST ═══════════════════════════

// live title counter
document.addEventListener('input', e => {
  if(e.target.id==='postTitle'){
    const c=document.getElementById('titleCount');
    if(c) c.textContent=e.target.value.length+' / 200';
  }
});

const emojiMap={'r/ігри':'🎮','r/технології':'💻','r/навчання':'📚','r/спорт':'⚽','r/фільми':'🎬'};
const colorMap={'r/ігри':'#ff4500','r/технології':'#58a6ff','r/навчання':'#3fb950','r/спорт':'#fb8c00','r/фільми':'#ab47bc'};
const flairMap={'r/ігри':['Ігри','flair-cs'],'r/технології':['Технології','flair-tech'],'r/навчання':['Навчання','flair-tech'],'r/спорт':['Спорт','flair-news'],'r/фільми':['Фільми','flair-cs']};

function submitPost(){
  const title=document.getElementById('postTitle').value.trim();
  const body=document.getElementById('postBody').value.trim();
  const cat=document.getElementById('postCategory').value;
  if(!title){showToast('Введіть заголовок!','error');return;}
  const user=getCurrentUser();
  const newPost={
    id: Date.now(),
    sub: cat,
    subColor: colorMap[cat]||'#ff4500',
    author: user.name,
    time: 'щойно',
    flair: flairMap[cat]?.[0]||'Пост',
    flairClass: flairMap[cat]?.[1]||'flair-tech',
    title, body: body||'',
    emoji: emojiMap[cat]||'📝',
    votes: 1, comments: 0
  };
  posts.unshift(newPost);
  // bump karma & post count
  user.karma=(user.karma||1)+5;
  user.contributions=(user.contributions||0)+1;
  if(!user.posts) user.posts=[];
  user.posts.push(newPost.id);
  updateStoredUser(user);
  // reset form
  document.getElementById('postTitle').value='';
  document.getElementById('postBody').value='';
  const c=document.getElementById('titleCount');
  if(c) c.textContent='0 / 200';
  closeModal('createPostOverlay');
  renderHeader();
  renderFeed();
  showToast('✅ Пост опубліковано! +5 карми','success');
}

// ═══════════════════════════ INIT ═══════════════════════════
renderHeader();
renderFeed();