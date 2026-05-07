import dayjs from "dayjs";
import {
  supabase,
  fetchCategories,
  fetchPosts,
  createPostDb,
  updatePostDb,
  deletePostDb,
  registerUserDb,
  loginUserDb,
  fetchUsers,
  fetchCommentsDb,
  createCommentDb,
  fetchUserCommentsDb,
  submitContactDb,
  fetchContactsDb,
  deleteContactDb,
  updateContactStatusDb,
  uploadPostImage,
  fetchSavedPostsIds, 
  toggleSavePostDb
} from "./db.js";

// ════════════════════════════════════════════
//  ГЛОБАЛЬНІ ЗМІННІ
// ════════════════════════════════════════════
let posts = [];
let categoryConfig = {};
let voteMap = {};
let postComments = {};
let currentPostId = null;
let currentCategory = null;
let _pendingDeleteId = null;
let _pendingDeleteCatKey = null;
let adminUsersCache = [];

// ════════════════════════════════════════════
//  КОРИСТУВАЧІ ТА АВТОРИЗАЦІЯ (Локально)
// ════════════════════════════════════════════
function setCurrentUser(u) {
  localStorage.setItem("goat_currentUser", JSON.stringify(u));
}
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("goat_currentUser"));
  } catch {
    return null;
  }
}
function isAuthenticated() {
  return Boolean(getCurrentUser());
}
function isAdmin() {
  const u = getCurrentUser();
  return (
    u && (u.is_admin === true || u.isAdmin === true || u.role === "superadmin")
  );
}

function signout() {
  localStorage.removeItem("goat_currentUser");
}
function updateStoredUser(user) {
  setCurrentUser(user);
}
function getAuthorName(post) {
  return post.authorName || "Невідомий";
}
function saveCategories(obj) {
  localStorage.setItem("goat_categories", JSON.stringify(obj));
}

// ════════════════════════════════════════════
//  SUPABASE СИНХРОНІЗАЦІЯ
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  SUPABASE СИНХРОНІЗАЦІЯ
// ════════════════════════════════════════════
async function loadData() {
  const catData = await fetchCategories();
  categoryConfig = {};
  catData.forEach(c => {
    categoryConfig[c.name] = {
      emoji: c.emoji, color: c.color, desc: c.description, flair: [c.flair_label, c.flair_class]
    };
  });

  const postData = await fetchPosts();
  posts = postData.map(p => {
    const cat = categoryConfig[p.sub] || { emoji: "📝", color: "#ff4500", flair: ["Пост", "flair-tech"] };
    return {
      id: p.id, authorId: p.author_id, authorName: p.author_name,
      sub: p.sub, subColor: cat.color, title: p.title, body: p.body,
      emoji: cat.emoji, flair: cat.flair[0], flairClass: cat.flair[1],
      votes: p.votes || 0, comments: p.comments_count || 0,
      time: new Date(p.created_at).toLocaleString("uk-UA"),
      edited: p.is_edited,
      image_url: p.image_url || null,
      timestamp: new Date(p.created_at).getTime() // <-- Наш маркер для точного сортування
    };
  });
}

// ════════════════════════════════════════════
//  ПОСТИ (CREATE / EDIT / DELETE)
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  ПОСТИ (CREATE / EDIT / DELETE)
// ════════════════════════════════════════════
async function submitPost() {
  const title = document.getElementById("postTitle").value.trim();
  const body = document.getElementById("postBody").value.trim();
  const cat = document.getElementById("postCategory").value;

  if (!title) {
    showToast("Введіть заголовок!", "error");
    return;
  }
  const user = getCurrentUser();
  if (!user) {
    showToast("Увійдіть у систему!", "error");
    return;
  }

  // Завантаження зображення
  let imageUrl = null;
  const imageInput = document.getElementById("postImage");
  if (imageInput && imageInput.files && imageInput.files[0]) {
    showToast("Завантаження зображення…");
    imageUrl = await uploadPostImage(imageInput.files[0]);
    if (!imageUrl) {
      showToast("Помилка завантаження зображення!", "error");
      return;
    }
  }

  const result = await createPostDb({
    author_id: user.id,
    author_name: user.name,
    sub: cat,
    title: title,
    body: body || "",
    image_url: imageUrl,
    votes: 1,
    comments_count: 0,
  });

  if (!result.success) {
    showToast("Помилка збереження!", "error");
    return;
  }

  user.karma = (user.karma || 1) + 5;
  user.contributions = (user.contributions || 0) + 1;
  updateStoredUser(user);

  await loadData();
  
  // Очищаємо форму
  document.getElementById("postTitle").value = "";
  document.getElementById("postBody").value = "";
  if (imageInput) imageInput.value = "";
  
  const imgPreview = document.getElementById("imagePreview");
  if (imgPreview) {
    imgPreview.style.display = "none";
    imgPreview.src = "";
  }
  
  closeModal("createPostOverlay");
  renderHeader();

  // 🛑 РОЗУМНЕ ОНОВЛЕННЯ СТРІЧКИ (ОСЬ НАШЕ ВИПРАВЛЕННЯ!)
  if (currentCategory) {
    // Якщо ми в категорії, малюємо ТІЛЬКИ її пости
    renderFeed(posts.filter(p => p.sub === currentCategory));
  } else if (window.location.pathname.toLowerCase().includes("popular.html")) {
    // Якщо в популярному — зберігаємо сортування
    const sortedPosts = [...posts].sort((a, b) => b.votes - a.votes);
    renderFeed(sortedPosts);
  } else {
    // Звичайна головна стрічка
    renderFeed();
  }

  showToast("✅ Пост опубліковано! +5 карми", "success");
}

function editPost(id) {
  const p = posts.find((x) => x.id === id);
  if (!p) return;
  const pv = document.getElementById("postViewContent");
  if (!pv) {
    openPost(id);
    setTimeout(() => editPost(id), 50);
    return;
  }
  setPage("post");
  const opts = Object.entries(categoryConfig)
    .map(
      ([k, v]) =>
        `<option value="${k}" ${p.sub === k ? "selected" : ""}>${v.emoji} ${k}</option>`,
    )
    .join("");
  pv.innerHTML = `
    <div style="margin-bottom:12px"><button class="action-btn" onclick="openPost(${id})">← Скасувати</button></div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px">
      <h2 style="font-family:var(--font-head);font-size:1.2rem;margin-bottom:20px">✏️ Редагування поста</h2>
      <div class="form-field"><label>Категорія</label>
        <select id="editCategory" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px">${opts}</select></div>
      <div class="form-field" style="margin-top:14px"><label>Заголовок</label>
        <input id="editTitle" type="text" value="${p.title.replace(/"/g, "&quot;")}" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px"/></div>
      <div class="form-field" style="margin-top:14px"><label>Текст</label>
        <textarea id="editBody" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;min-height:140px">${p.body || ""}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" style="border-radius:8px" onclick="openPost(${id})">Скасувати</button>
        <button class="btn btn-accent" style="border-radius:8px;padding:8px 24px" onclick="saveEditPost(${id})">Зберегти зміни</button>
      </div>
    </div>`;
}

async function saveEditPost(id) {
  const title = document.getElementById("editTitle")?.value.trim();
  const body = document.getElementById("editBody")?.value.trim();
  const cat = document.getElementById("editCategory")?.value;
  if (!title) {
    showToast("Заголовок порожній!", "error");
    return;
  }

  const result = await updatePostDb(id, {
    title,
    body: body || "",
    sub: cat,
    is_edited: true,
  });

  if (result.success) {
    await loadData();
    renderFeed();
    openPost(id);
    showToast("✅ Пост оновлено!", "success");
  } else {
    showToast("Помилка оновлення!", "error");
  }
}

function confirmDeletePost(id) {
  _pendingDeleteId = id;
  openModal("deleteConfirmOverlay");
}

async function deletePost() {
  const id = _pendingDeleteId;
  if (id == null) return;

  // Тимчасово показуємо статус
  showToast("Видалення...", "info");

  const result = await deletePostDb(id);
  closeModal("deleteConfirmOverlay");
  _pendingDeleteId = null;

  if (result.success) {
    await loadData();
    
    const pagePost = document.getElementById("page-post");
    if (pagePost && pagePost.classList.contains("active")) {
      setPage("home");
    } else {
      // Відновлюємо правильне сортування для сторінки Популярне
      if (window.location.pathname.toLowerCase().includes("popular.html")) {
        const sortedPosts = [...posts].sort((a, b) => b.votes - a.votes);
        renderFeed(sortedPosts);
      } else {
        renderFeed();
      }
    }
    showToast("✅ Пост видалено", "success");
  } else {
    showToast("❌ Помилка видалення! (Можливо, є коментарі)", "error");
  }
}

// ════════════════════════════════════════════
//  ВІЗУАЛ (РЕНДЕР)
// ════════════════════════════════════════════
function renderSidebarCommunities() {
  const sc = document.getElementById("sidebarCommunities");
  if (!sc) return; // 🛡️ Щит для лівого меню

  const cats = Object.entries(categoryConfig);
  const user = getCurrentUser();
  const joinedSubs = user?.joinedSubs || [];

  const colors = ["blue", "green", "purple", "", "blue"];
  sc.innerHTML = cats.map(([k, v], i) =>
        `<div class="nav-item" onclick="filterByCategory('${k}')" style="cursor:pointer"><div class="community-avatar ${colors[i % colors.length]}" style="background:${v.color}20;color:${v.color};border:1px solid ${v.color}40">${v.emoji}</div>${k}</div>`
  ).join("");

  const rsc = document.getElementById("rightSidebarCommunities");
  if(rsc) {
    const myCats = cats.filter(([k, v]) => joinedSubs.includes(k));

    if (myCats.length === 0) {
      rsc.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">Ви ще не підписані на жодну спільноту</div>`;
      return;
    }

    rsc.innerHTML = myCats.map(([k, v], i) => {
      const count = posts.filter((p) => p.sub === k).length;
      return `<div class="community-row" onclick="filterByCategory('${k}')" style="cursor:pointer">
      <div class="community-num">${i + 1}</div>
      <div style="width:24px;height:24px;border-radius:50%;background:${v.color}20;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${v.emoji}</div>
      <div class="community-info"><div class="community-name">${k}</div><div class="community-members">${count} постів</div></div>
      <button class="join-btn joined" onclick="event.stopPropagation();toggleJoin(this)">Вийти</button>
    </div>`;
    }).join("");
  }
}
function renderHeader() {
  const user = getCurrentUser();
  const ha = document.getElementById("headerActions");
  const cpw = document.getElementById("createPostWidget");

  const catSel = document.getElementById("postCategory");
  if (catSel)
    catSel.innerHTML = Object.entries(categoryConfig)
      .map(([k, v]) => `<option value="${k}">${v.emoji} ${k}</option>`)
      .join("");

  if (user) {
    const ini = user.name.slice(0, 2).toUpperCase();
    const uColor = getUserColor(user.name); // ГЕНЕРУЄМО КОЛІР КОРИСТУВАЧА

    ha.innerHTML = `
      <button style="background:var(--surface2);border:1px solid var(--border);color:var(--text);display:flex;align-items:center;gap:6px;border-radius:20px;padding:6px 14px;font-size:13px" onclick="openModal('createPostOverlay')">✏️ Створити</button>
      <button class="notif-btn"><span>🔔</span><span class="notif-dot"></span></button>
      <div class="avatar-wrap">
        <div class="user-avatar" id="avatarBtn" style="background:${uColor}" onclick="toggleDropdown()">${ini}</div>
        <div class="avatar-dropdown" id="avatarDropdown">
          <div class="dd-header"><div style="font-weight:700">${user.name}
              ${user.role === "superadmin" ? ' <span style="background:rgba(220,38,38,.15);color:#dc2626;font-size:10px;padding:1px 7px;border-radius:10px">СУПЕР АДМІН</span>' : isAdmin() ? ' <span style="background:rgba(255,69,0,.15);color:var(--accent);font-size:10px;padding:1px 7px;border-radius:10px">АДМІН</span>' : ""}
          </div></div>
          <div class="dd-item" onclick="closeDropdown();goProfile()"><span>👤</span> Профіль</div>
          <div class="dd-item" onclick="closeDropdown();openModal('createPostOverlay')"><span>✏️</span> Створити пост</div>
          ${isAdmin() ? `<div class="dd-item admin-link" onclick="closeDropdown();openAdminPanel()"><span>⚙️</span> Адмін панель</div>` : ""}
          <div class="dd-divider"></div>
          <div class="dd-item danger" onclick="closeDropdown();doSignout()"><span>🚪</span> Вийти</div>
        </div>
      </div>`;

    if (cpw)
      cpw.innerHTML = `
      <div class="widget" style="margin-bottom:12px"><div class="widget-body" style="padding:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="user-avatar" style="width:36px;height:36px;background:${uColor}">${ini}</div>
          <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:8px 14px;color:var(--muted);cursor:pointer" onclick="openModal('createPostOverlay')">Створити пост…</div>
        </div>
      </div></div>`;
  } else {
    ha.innerHTML = `<button class="btn btn-ghost" onclick="openModal('loginOverlay')">Вхід</button><button class="btn btn-accent" onclick="openModal('registerOverlay')">Реєстрація</button>`;
    if (cpw) cpw.innerHTML = "";
  }
}

function renderFeed(data) {
  const feedContainer = document.getElementById("postFeed");
  // 🛡️ МАГІЧНИЙ ЩИТ: якщо блоку немає, просто виходимо без помилок
  if (!feedContainer) return; 

  const list = data || posts;
  let html = "";

  if (currentCategory && categoryConfig[currentCategory]) {
    const cat = categoryConfig[currentCategory];
    const user = getCurrentUser();
    const isJoined = user?.joinedSubs?.includes(currentCategory);
    
    html += `
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:16px; display:flex; gap:16px; align-items:center; animation: fadeIn 0.3s ease both;">
      <div style="width:64px; height:64px; border-radius:50%; background:${cat.color}20; display:flex; align-items:center; justify-content:center; font-size:32px; flex-shrink:0">
        ${cat.emoji}
      </div>
      <div style="flex:1">
        <h1 style="font-family:var(--font-head); font-size:1.5rem; margin-bottom:4px; margin-top:0">${currentCategory}</h1>
        <div style="color:var(--muted); font-size:13px">${cat.desc || "Спільнота за інтересами"} • ${list.length} постів</div>
      </div>
      <div>
        <button class="btn ${isJoined ? 'btn-ghost joined' : 'btn-accent'}" style="border-radius:20px; padding:8px 20px" onclick="toggleJoinCategory('${currentCategory}', this)">
          ${isJoined ? 'Вийти' : 'Приєднатись'}
        </button>
      </div>
    </div>`;
  }

  html += list.map((p) => postCard(p)).join("");
  feedContainer.innerHTML = html || `<div style="text-align:center; padding:40px; color:var(--muted)">Постів ще немає</div>`;
  
  renderFeatured(list);
  renderSidebarCommunities();
}

function renderFeatured(data) {
  const container = document.getElementById("featuredRow");
  if (!container) return;
  const top = [...(data || posts)]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 4);
  container.innerHTML = top
    .map(
      (p) => `
    <div class="featured-card" onclick="openPost(${p.id})">
      <div class="featured-img" style="background:${p.subColor}20;font-size:32px">${p.emoji}</div>
      <div class="featured-card-body">
        <div class="featured-card-title" title="${p.title.replace(/"/g, "&quot;")}">${p.title}</div>
        <div class="featured-card-sub"><div class="sub-dot" style="background:${p.subColor}"></div>${p.sub}</div>
      </div>
    </div>`,
    )
    .join("");
}

function postCard(p) {
  const v = voteMap[p.id] || 0;
  const commentCount = postComments[p.id]?.length ?? p.comments;
  const user = getCurrentUser();
  const authorName = getAuthorName(p);
  const canManage = user && (user.id === p.authorId || isAdmin());
  const manageBtns = canManage
    ? `<button class="action-btn" style="color:var(--blue)" onclick="event.stopPropagation();editPost(${p.id})">✏️ Редагувати</button><button class="action-btn" style="color:#ff7043" onclick="event.stopPropagation();confirmDeletePost(${p.id})">🗑️ Видалити</button>`
    : "";

  // 🛑 ПЕРЕВІРЯЄМО СТАТУС ЗБЕРЕЖЕННЯ
  const isSaved = user?.savedPosts?.includes(p.id);
  const saveBtnText = isSaved ? "🔖 Збережено" : "🔖 Зберегти";
  const saveBtnStyle = isSaved ? "color: var(--green);" : "";

  return `<div class="post-card" onclick="openPost(${p.id})">
    <div class="post-vote" onclick="event.stopPropagation()">
      <button class="vote-btn${v === 1 ? " voted" : ""}" onclick="castVote(${p.id},1)">▲</button>
      <div class="vote-count">${fmtNum(p.votes + v)}</div>
      <button class="vote-btn${v === -1 ? " voted" : ""}" onclick="castVote(${p.id},-1)">▼</button>
    </div>
    <div class="post-body">
      <div class="post-meta">
        <div class="post-sub" onclick="event.stopPropagation(); filterByCategory('${p.sub}')" style="cursor:pointer">
          <div class="sub-icon" style="background:${p.subColor}">${p.sub[2].toUpperCase()}</div>
          ${p.sub}
        </div>
        <span class="post-author">Автор: <span>${authorName}</span></span>
        <span class="post-time">· ${p.time}</span>
        <span class="flair ${p.flairClass}">${p.flair}</span>
      </div>
      <div class="post-title">${p.title}</div>
      
     ${p.image_url ? `<img src="${p.image_url}" alt="Post image" style="width:100%; max-height:500px; object-fit:contain; background:transparent; border-radius:8px; margin-top:10px; margin-bottom:12px;"/>` : ""}

      <div class="post-actions">
        <button class="action-btn">💬 ${fmtNum(commentCount)}</button>
        <button class="action-btn" onclick="event.stopPropagation();sharePost(${p.id})">🔗 Поділитись</button>
        <button class="action-btn" style="${saveBtnStyle}" onclick="event.stopPropagation();savePost(${p.id}, this)">${saveBtnText}</button>
        ${manageBtns}
      </div>
    </div>
    <div class="post-thumb">${p.emoji}</div>
  </div>`;
}
function renderComment(c) {
  const time = c.created_at
    ? new Date(c.created_at).toLocaleString("uk-UA", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "щойно";
  const name = c.author_name || "Гість";
  const uColor = getUserColor(name); // ГЕНЕРУЄМО КОЛІР

  return `
    <div style="display:flex;gap:10px;margin-bottom:14px">
      <div class="user-avatar" style="width:28px;height:28px;font-size:12px;flex-shrink:0;background:${uColor}">${name[0].toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-size:12px;color:var(--blue);font-weight:600">${name} <span style="color:var(--muted);font-weight:400">· ${time}</span></div>
        <div style="font-size:14px;margin-top:4px;line-height:1.6">${linkify(c.text)}</div>
      </div>
    </div>`;
}
// ════════════════════════════════════════════
//  ВЗАЄМОДІЯ ТА АВТОРИЗАЦІЯ
// ════════════════════════════════════════════
function toggleDropdown() {
  const dd = document.getElementById("avatarDropdown");
  if (dd) dd.classList.toggle("open");
}
function closeDropdown() {
  const dd = document.getElementById("avatarDropdown");
  if (dd) dd.classList.remove("open");
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".avatar-wrap")) closeDropdown();
});

async function doSignin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const err = document.getElementById("loginError");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    err.textContent = "❌ Введіть коректний email";
    err.classList.add("show");
    return;
  }
  if (!password) {
    err.textContent = "❌ Введіть пароль";
    err.classList.add("show");
    return;
  }

  const result = await loginUserDb(email, password);

  if (!result.success) {
    err.textContent = result.message;
    err.classList.add("show");
    return;
  }

  err.classList.remove("show");
  setCurrentUser(result.user);
  const savedIds = await fetchSavedPostsIds(result.user.id);
result.user.savedPosts = savedIds;
setCurrentUser(result.user);
  closeModal("loginOverlay");

  renderHeader();

  // ПЕРЕВІРКА: якщо ми зараз дивимось пост, оновлюємо його вміст
  if (currentPostId !== null) {
    await openPost(currentPostId);
  } else {
    renderFeed();
  }

  showToast("✅ Ласкаво просимо, " + result.user.name + "!", "success");
}

async function doSignup() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const err = document.getElementById("registerError");

  if (!name || name.length < 2) {
    err.textContent = "❌ Введіть ім'я";
    err.classList.add("show");
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    err.textContent = "❌ Введіть коректний email";
    err.classList.add("show");
    return;
  }
  if (password.length < 8) {
    err.textContent = "❌ Пароль мінімум 8 символів";
    err.classList.add("show");
    return;
  }

  const result = await registerUserDb(name, email, password);

  if (!result.success) {
    err.textContent = result.message;
    err.classList.add("show");
    return;
  }

  err.classList.remove("show");
  setCurrentUser(result.user);
  const savedIds = await fetchSavedPostsIds(result.user.id);
result.user.savedPosts = savedIds;
setCurrentUser(result.user);
  closeModal("registerOverlay");

  renderHeader();

  // ПЕРЕВІРКА: якщо ми реєструємось, знаходячись у пості, оновлюємо його
  if (currentPostId !== null) {
    await openPost(currentPostId);
  } else {
    renderFeed();
  }

  showToast("✅ Акаунт створено!", "success");
}

function doSignout() {
  signout();
  renderHeader();
  renderFeed();
  setPage("home");
  showToast("До побачення!");
}
function requireAuth() {
  if (!isAuthenticated()) {
    openModal("loginOverlay");
    return false;
  }
  return true;
}

async function postComment(postId) {
  const box = document.getElementById("commentBox");
  const text = box?.value.trim();
  if (!text) return;

  const user = getCurrentUser();
  if (!user) {
    showToast("Увійдіть, щоб коментувати", "error");
    return;
  }

  // 1. Відправляємо в Supabase
  const result = await createCommentDb({
    post_id: postId,
    author_id: user.id,
    author_name: user.name,
    text: text,
  });

  if (result.success) {
    // 2. Оновлюємо лічильник коментарів у самому пості (необов'язково, але корисно)
    const p = posts.find((x) => x.id === postId);
    if (p) {
      p.comments = (p.comments || 0) + 1;
      await updatePostDb(postId, { comments_count: p.comments });
    }

    // 3. Додаємо карму користувачу
    user.karma = (user.karma || 0) + 1;
    updateStoredUser(user);

    // 4. Оновлюємо сторінку
    await openPost(postId);
    showToast("✅ Коментар додано!", "success");
  } else {
    showToast("Помилка при додаванні", "error");
  }
}

function castVote(id, dir) {
  if (!requireAuth()) return;
  voteMap[id] = voteMap[id] === dir ? 0 : dir;
  renderFeed();
}
async function savePost(id, btn) {
  if (!requireAuth()) return;
  const user = getCurrentUser();
  
  const result = await toggleSavePostDb(user.id, id);
  
  if (!user.savedPosts) user.savedPosts = [];
  
  if (result.action === 'added') {
    user.savedPosts.push(id);
    showToast("🔖 Збережено!", "success");
    // 🎨 Миттєво фарбуємо кнопку в синій колір
    if (btn) {
      btn.innerHTML = "🔖 Збережено";
      btn.style.color = "var(--green)";
    }
  } else {
    user.savedPosts = user.savedPosts.filter(postId => postId !== id);
    showToast("🔖 Видалено зі збереженого", "info");
    // 🎨 Повертаємо кнопці стандартний вигляд
    if (btn) {
      btn.innerHTML = "🔖 Зберегти";
      btn.style.color = "";
    }
  }

  updateStoredUser(user);
  
  // Якщо ми в профілі на вкладці збереженого — перемальовуємо список
  if (document.getElementById("page-profile")?.classList.contains("active") && profileTab === "saved") {
    renderProfile("saved");
  }
}

// ════════════════════════════════════════════
//  ДОПОМІЖНІ ФУНКЦІЇ ТА НАВІГАЦІЯ
// ════════════════════════════════════════════
// Палітра яскравих кольорів для аватарок
const avatarColors = [
  "#ff4500",
  "#1565c0",
  "#000000",
  "#ab47bc",
  "#f57c00",
  "#00838f",
  "#c2185b",
  "#558b2f",
  "#4527a0",
  "#0277bd",
];
// Шукає посилання в тексті і робить їх клікабельними + додає попередження
function linkify(text) {
  if (!text) return "";
  
  // 1. Захист від шкідливого коду
  let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  // 2. Пошук посилань
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // 3. Обгортаємо в тег <a> і додаємо попередження
  return safeText.replace(urlRegex, function(url) {
    // Текст вашого попередження:
    const warningMsg = "Увага! Це посилання переносить вас за межі GOAT Forum і може бути небезпечним.\\n\\nВи впевнені, що хочете перейти?";
    
    // Додаємо onclick="return confirm(...)"
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--blue); text-decoration: underline;" onclick="return confirm('${warningMsg}')">${url}</a>`;
  });
}
function toggleJoinCategory(cat, btn) {
  if (!requireAuth()) return;
  const user = getCurrentUser();
  if (!user.joinedSubs) user.joinedSubs = [];
  
  const index = user.joinedSubs.indexOf(cat);
  if (index === -1) {
    user.joinedSubs.push(cat);
    btn.classList.remove('btn-accent');
    btn.classList.add('btn-ghost', 'joined');
    btn.textContent = "Вийти";
  } else {
    user.joinedSubs.splice(index, 1);
    btn.classList.remove('btn-ghost', 'joined');
    btn.classList.add('btn-accent');
    btn.textContent = "Приєднатись";
  }
  
  updateStoredUser(user);
  renderSidebarCommunities(); // Оновлює ваш список справа
}
// Функція, яка бере ім'я і завжди повертає для нього один і той самий колір
function getUserColor(name) {
  if (!name) return avatarColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
}
function handleSearch(q) {
  const f = q.trim()
    ? posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q.toLowerCase()) ||
          p.sub.toLowerCase().includes(q.toLowerCase()),
      )
    : posts;
  renderFeed(f);
  if (document.getElementById("page-post").classList.contains("active"))
    setPage("home");
}

function filterByCategory(cat) {
  // 1. Перенаправлення: якщо ми не на головній сторінці, йдемо туди
  const path = window.location.pathname.toLowerCase();
  if (!path.includes("index.html") && path !== "/" && path !== "") {
    window.location.href = "index.html#category-" + encodeURIComponent(cat);
    return;
  }

  // 2. Стандартна логіка для головної сторінки
  window.location.hash = "category-" + encodeURIComponent(cat);
  currentCategory = cat; 
  
  // 🛡️ МАГІЧНІ ЩИТИ (щоб не ламався код, якщо елемента немає)
  const adminPanel = document.getElementById("adminPanel");
  if (adminPanel) adminPanel.style.display = "none";
  
  const mainLayout = document.getElementById("mainLayout");
  if (mainLayout) mainLayout.style.display = "";
  
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const pageHome = document.getElementById("page-home");
  if (pageHome) pageHome.classList.add("active");
  
  window.scrollTo(0, 0);
  
  // Рендеримо тільки пости цієї категорії
  renderFeed(posts.filter(p => p.sub === cat));
}
function setSort(btn, type) {
  document.querySelectorAll(".sort-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  
  // Якщо відкрита категорія — сортуємо тільки її пости, інакше сортуємо всі
  const basePosts = currentCategory ? posts.filter(p => p.sub === currentCategory) : [...posts];
  
  if (type === "hot") {
    basePosts.sort((a, b) => b.comments - a.comments);
  } else if (type === "new") {
    basePosts.sort((a, b) => b.timestamp - a.timestamp); 
  } else if (type === "top") {
    basePosts.sort((a, b) => b.votes - a.votes);
  } else if (type === "best" || !type) {
    basePosts.sort((a, b) => (b.votes + b.comments) - (a.votes + a.comments));
  }
  
  renderFeed(basePosts);
}



function fmtNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "K" : n;
}
function sharePost(id) {
  // Формуємо чисте посилання: базовий домен + шлях + потрібний хеш
  const cleanUrl = window.location.origin + window.location.pathname + "#post-" + id;
  
  // Копіюємо в буфер обміну
  navigator.clipboard?.writeText(cleanUrl)
    .then(() => showToast("🔗 Посилання скопійовано!", "success"))
    .catch(() => showToast("❌ Не вдалося скопіювати", "error"));
}

function shareProfile() {
  const cleanUrl = window.location.origin + window.location.pathname + "#profile";
  
  navigator.clipboard?.writeText(cleanUrl)
    .then(() => showToast("🔗 Посилання скопійовано!", "success"))
    .catch(() => showToast("❌ Не вдалося скопіювати", "error"));
}
function toggleJoin(btn) {
  if (!requireAuth()) return;
  const user = getCurrentUser();
  // Отримуємо назву спільноти з сусіднього елемента
  const communityName = btn.closest('.community-row').querySelector('.community-name').textContent;
  
  if (!user.joinedSubs) user.joinedSubs = [];

  const index = user.joinedSubs.indexOf(communityName);
  if (index === -1) {
    user.joinedSubs.push(communityName);
    btn.classList.add("joined");
    btn.textContent = "Вийти";
  } else {
    user.joinedSubs.splice(index, 1);
    btn.classList.remove("joined");
    btn.textContent = "Приєднатись";
  }

  updateStoredUser(user);
  renderSidebarCommunities(); // Перемальовуємо, щоб оновити список
}
function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
function closeIfOverlay(e, id) {
  if (e.target.id === id) closeModal(id);
}
function switchToRegister() {
  closeModal("loginOverlay");
  openModal("registerOverlay");
}
function switchToLogin() {
  closeModal("registerOverlay");
  openModal("loginOverlay");
}

let toastTimer;
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + type;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (document.getElementById("loginOverlay").classList.contains("open"))
      doSignin();
    if (document.getElementById("registerOverlay").classList.contains("open"))
      doSignup();
  }
  if (e.key === "Escape") {
    closeModal("loginOverlay");
    closeModal("registerOverlay");
    closeModal("deleteConfirmOverlay");
    closeModal("createPostOverlay");
  }
});

const yearElement = document.getElementById("currentYear");
if (yearElement) yearElement.textContent = new Date().getFullYear();

// ════════════════════════════════════════════
//  ІНІЦІАЛІЗАЦІЯ ТА МАРШРУТИЗАЦІЯ (ROUTING)
// ════════════════════════════════════════════
// Функція, яка перевіряє поточну адресу і відкриває потрібне вікно

// Дозволяє працювати кнопкам "Назад" / "Вперед" у браузері
window.addEventListener("hashchange", handleRoute);


// ════════════════════════════════════════════
//  IMAGE PREVIEW
// ════════════════════════════════════════════
function previewImage(input) {
  const preview = document.getElementById("imagePreview");
  if (!preview) return;
  
  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast("Файл занадто великий! Максимум 5 МБ", "error");
      input.value = "";
      preview.style.display = "none";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = "none";
  }
}
window.previewImage = previewImage;

// ════════════════════════════════════════════
//  НАВІГАЦІЯ ТА РОУТИНГ (ІДЕАЛЬНИЙ БЛОК)
// ════════════════════════════════════════════
async function openPost(rawId) {
  // 🛡️ МАГІЧНИЙ ЩИТ
  const pv = document.getElementById("postViewContent");
  if (!pv) {
    window.location.href = "index.html#post-" + rawId;
    return;
  }

  // Суворо перетворюємо на число (Number видасть помилку NaN, якщо там є літери)
  const id = Number(rawId);
  const p = posts.find((x) => x.id === id);

  // 🛑 ЯКЩО ПОСТ НЕ ЗНАЙДЕНО
  if (!p) {
    pv.innerHTML = `
      <div style="margin-bottom:12px"><button class="action-btn" onclick="setPage('home')">← Назад</button></div>
      <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:60px 20px; text-align:center;">
        <div style="font-size:48px; margin-bottom:16px;"></div>
        <h2 style="font-family:var(--font-head); font-size:1.5rem; margin-bottom:8px;">Пост не знайдено</h2>
        <p style="color:var(--muted); font-size:14px; margin-bottom:24px;">Схоже, цей пост був видалений, або посилання пошкоджене.</p>
        <button class="btn btn-accent" style="border-radius:8px; padding:8px 24px;" onclick="setPage('home')">Повернутись у стрічку</button>
      </div>`;
    setPage("post");
    return; // Зупиняємось ТУТ, не "виправляючи" адресний рядок!
  }

  // ✅ ТІЛЬКИ ЯКЩО ПОСТ ЗНАЙДЕНО — фіксуємо правильний URL
  window.location.hash = "post-" + p.id;
  currentPostId = p.id;

  const comments = await fetchCommentsDb(p.id);
  const v = voteMap[p.id] || 0;
  const auth = isAuthenticated();
  const user = getCurrentUser();
  const authorName = getAuthorName(p);
  const canManage = user && (user.id === p.authorId || isAdmin());
  const isSaved = user?.savedPosts?.includes(p.id);
  const saveBtnText = isSaved ? "🔖 Збережено" : "🔖 Зберегти";
  const saveBtnStyle = isSaved ? "color: var(--green);" : "";

  pv.innerHTML = `
    <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <button class="action-btn" onclick="setPage('home')">← Назад</button>
      ${canManage ? `<button class="action-btn" style="color:var(--blue);margin-left:auto" onclick="editPost(${p.id})">✏️ Редагувати</button><button class="action-btn" style="color:#ff7043" onclick="confirmDeletePost(${p.id})">🗑️ Видалити</button>` : ""}
    </div>
    
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:12px">
      <div style="display:flex">
        <div class="post-vote" style="padding:16px 0">
          <button class="vote-btn${v === 1 ? " voted" : ""}" onclick="castVote(${p.id},1);openPost(${p.id})">▲</button>
          <div class="vote-count">${fmtNum(p.votes + v)}</div>
          <button class="vote-btn${v === -1 ? " voted" : ""}" onclick="castVote(${p.id},-1);openPost(${p.id})">▼</button>
        </div>
        <div style="padding:16px;flex:1">
          <div class="post-meta" style="margin-bottom:10px">
            <div class="post-sub" onclick="filterByCategory('${p.sub}')" style="cursor:pointer">
              <div class="sub-icon" style="background:${p.subColor}">${p.sub[2].toUpperCase()}</div>
              ${p.sub}
            </div>
            <span class="post-author">Автор: <span>${authorName}</span></span>
            <span class="post-time">· ${p.time}</span>
            <span class="flair ${p.flairClass}">${p.flair}</span>
            ${p.edited ? `<span style="font-size:11px;color:var(--muted)">• редаговано</span>` : ""}
          </div>
         <div class="post-title" style="font-size:1.3rem;margin-bottom:12px;line-height:1.5;padding-bottom:4px">${p.title}</div>
          ${p.image_url ? `<img src="${p.image_url}" alt="Post image" style="width:100%; max-height:600px; object-fit:contain; background:transparent; border-radius:8px; margin-bottom:12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"/>` : ""}
          ${p.body ? `<p style="line-height:1.7;margin-bottom:14px">${linkify(p.body)}</p>` : ""}
          <div class="post-actions">
            <button class="action-btn">💬 ${comments.length}</button>
            <button class="action-btn" onclick="sharePost(${p.id})">🔗 Поділитись</button>
            <button class="action-btn" onclick="savePost(${p.id})">🔖 Зберегти</button>
          </div>
        </div>
      </div>
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px" id="commentsSection">
      <div style="font-weight:700;margin-bottom:12px" id="commentsHeader">💬 Коментарі (${comments.length})</div>
      ${
        auth
          ? `
        <div style="display:flex;gap:10px;margin-bottom:16px">
          <div class="user-avatar" style="width:32px;height:32px;flex-shrink:0">${user.name.slice(0, 2).toUpperCase()}</div>
          <div style="flex:1">
            <textarea id="commentBox" placeholder="Напишіть коментар…" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:10px;min-height:72px"></textarea>
            <div style="text-align:right;margin-top:6px"><button class="btn btn-accent" style="border-radius:8px;padding:6px 18px" onclick="postComment(${p.id})">Надіслати</button></div>
          </div>
        </div>`
          : `
        <div style="background:var(--surface2);border-radius:8px;padding:14px;text-align:center;color:var(--muted);margin-bottom:16px">
          <a style="color:var(--blue);cursor:pointer" onclick="openModal('loginOverlay')">Увійдіть</a>, щоб залишити коментар
        </div>`
      }
      <div id="commentsList">
        ${comments.length === 0 ? `<div style="text-align:center;padding:32px 0;color:var(--muted)">Коментарів ще немає. Будьте першим!</div>` : comments.map((c) => renderComment(c)).join("")}
      </div>
    </div>`;
  setPage("post");
}

function setPage(name) {
  const adminPanel = document.getElementById("adminPanel");
  if (adminPanel) adminPanel.style.display = "none";
  
  const mainLayout = document.getElementById("mainLayout");
  if (mainLayout) mainLayout.style.display = "";

  if (name === "home") {
    window.history.replaceState(null, null, window.location.pathname);
    currentPostId = null;
    currentCategory = null; 
    
    if (window.location.pathname.toLowerCase().includes("popular.html")) {
      const sortedPosts = [...posts].sort((a, b) => b.votes - a.votes);
      renderFeed(sortedPosts);
    } else {
      renderFeed(); 
    }
  }
  
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const targetPage = document.getElementById("page-" + name) || document.getElementById("page-home");
  if (targetPage) targetPage.classList.add("active");
  
  window.scrollTo(0, 0);
}

// ════════════════════════════════════════════
//  ПРОФІЛЬ КОРИСТУВАЧА
// ════════════════════════════════════════════
let profileTab = "overview"; 
let currentViewedUser = null;
function openUserProfile(userId) {
  // Просто надійно перекидаємо на Головну сторінку з правильним хешем
  window.location.href = "index.html#profile-" + userId;
}

function goProfile() {
  if (!requireAuth()) return;
  currentViewedUser = null; // Скидаємо, щоб показати СВІЙ профіль
  const pc = document.getElementById("profileContent");
  if (!pc) {
    window.location.href = "index.html#profile";
    return;
  }
  window.location.hash = "profile";
  renderProfile("overview");
  setPage("profile");
}

async function renderProfile(tab) {
  if (tab) profileTab = tab;
  
  const user = currentViewedUser || getCurrentUser();
  if (!user) return;

  const ini = user.name.slice(0, 2).toUpperCase();
  const uColor = getUserColor(user.name);
  const handle = "u/" + user.name.toLowerCase().replace(/\s+/g, "_");
  const isMe = !currentViewedUser || currentViewedUser.id === getCurrentUser()?.id;

  // 1. Списки вкладок (Додаємо "Збережене" ТІЛЬКИ власнику)
  const tabs = [
    { id: "overview", label: "Огляд" },
    { id: "posts", label: "Пости" },
    { id: "comments", label: "Коментарі" },
  ];
  if (isMe) {
    tabs.push({ id: "saved", label: "Збережене" });
  }

  const userPosts = posts.filter(p => p.authorId === user.id);
  const userComments = await fetchUserCommentsDb(user.id);

  // 2. Формуємо контент вкладки
  let tabContent = "";
  if (profileTab === "posts") {
    tabContent = userPosts.length > 0 
      ? userPosts.map(p => postCard(p)).join("") 
      : `<div class="profile-empty"><h3>Постів ще немає</h3><p>${isMe ? 'Ви ще не опублікували' : 'Користувач ще не опублікував'} жодного поста.</p></div>`;
      
  } else if (profileTab === "comments") {
    tabContent = userComments.length > 0 
      ? `<div style="padding:8px 16px">${userComments.map(c => {
          const p = posts.find(post => post.id === c.post_id);
          const postHeader = p 
            ? `<div style="font-size:11px; color:var(--muted); margin-bottom:8px; padding-left:38px">До поста: <a style="color:var(--blue); cursor:pointer; font-weight:600; text-decoration:underline" onclick="openPost(${p.id})">${p.title}</a></div>` 
            : `<div style="font-size:11px; color:var(--muted); margin-bottom:8px; padding-left:38px">Пост видалено</div>`;
          return `<div style="border-bottom:1px solid var(--border); padding:16px 0; animation: fadeIn 0.3s ease both">${postHeader}${renderComment(c)}</div>`;
        }).join("")}</div>` 
      : `<div class="profile-empty"><h3>Коментарів ще немає</h3><p>${isMe ? 'Ви ще не залишили' : 'Користувач ще не залишив'} жодного коментаря.</p></div>`;
      
  } else if (profileTab === "saved" && isMe) {
    // 🔒 НОВА ЛОГІКА ЗБЕРЕЖЕНОГО
    const savedIds = user.savedPosts || [];
    const savedPosts = posts.filter(p => savedIds.includes(p.id));
    
    tabContent = savedPosts.length > 0 
      ? savedPosts.map(p => postCard(p)).join("") 
      : `<div class="profile-empty"><h3>Збереженого немає</h3><p>Тут з'являться пости, які ви відмітили закладкою.</p></div>`;

  } else {
    // Вкладка "Огляд"
    tabContent = userPosts.length > 0 
      ? `<div style="padding:10px 0; border-bottom:1px solid var(--border); margin-bottom:10px; font-weight:700; padding-left:16px">Останні пости</div>` + userPosts.slice(0, 3).map(p => postCard(p)).join("")
      : `<div class="profile-empty"><h3>Активності немає</h3><p>Тут з'являться останні дії.</p></div>`;
  }

  // 3. Рендеримо профіль
  document.getElementById("profileContent").innerHTML = `
    <div class="profile-header-card">
      <div class="profile-banner"></div>
      <div class="profile-avatar-wrap">
        <div class="profile-avatar-big" style="background:${uColor}">${ini}</div>
      </div>
      <div class="profile-info-row">
        <div>
          <div class="profile-name">${user.name}${user.role === "superadmin" ? '<span class="admin-badge" style="background:#c0392b">СУПЕР АДМІН</span>' : user.is_admin ? '<span class="admin-badge">АДМІН</span>' : ""}</div>
          <div class="profile-handle">${handle}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" style="border-radius:8px" onclick="shareProfile()">🔗 Поділитись</button>
          ${isAdmin() && isMe ? `<button class="btn btn-admin" style="border-radius:8px" onclick="openAdminPanel()">⚙️ Адмін панель</button>` : ""}
        </div>
      </div>
    </div>
    
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden">
      <div class="profile-tabs">${tabs.map((t) => `<div class="profile-tab${profileTab === t.id ? " active" : ""}" onclick="renderProfile('${t.id}')">${t.label}</div>`).join("")}</div>
      <div id="profileTabBody">${tabContent}</div>
    </div>

    <div class="profile-layout">
      <div></div>
      <div>
        <div class="widget">
          <div class="widget-header">📊 Статистика</div>
          <div class="widget-body" style="padding:8px 14px">
            <div class="profile-stat-row"><span class="profile-stat-label">Карма</span><span style="font-weight:700">⭐ ${user.karma || 0}</span></div>
            <div class="profile-stat-row"><span class="profile-stat-label">Внески</span><span style="font-weight:700">${user.contributions || 0}</span></div>
            <div class="profile-stat-row"><span class="profile-stat-label">Зареєстрований</span><span style="font-weight:700">з ${user.created_at ? new Date(user.created_at).toLocaleDateString("uk-UA") : new Date().getFullYear()}</span></div>
            <div class="profile-stat-row"><span class="profile-stat-label">Роль</span><span style="font-weight:700;color:${user.role === "superadmin" ? "var(--red)" : user.is_admin ? "var(--yellow)" : "var(--green)"}">${user.role === "superadmin" ? "Супер Адмін" : user.is_admin ? "Адмін" : "Користувач"}</span></div>
          </div>
        </div>
      </div>
    </div>`;
}

function openAdminPanel() {
  if (!isAdmin()) {
    showToast("Доступ заборонено!", "error");
    return;
  }
  // Просто перенаправляємо на нову сторінку!
  window.location.href = "admin.html#admin-dashboard";
}
async function handleRoute() {
  const hash = window.location.hash;
  const path = window.location.pathname.toLowerCase();
  
 if (hash.startsWith("#post-")) {
    // 🛡️ Передаємо хеш як є, без parseInt, щоб не губити літери!
    const rawId = hash.replace("#post-", "");
    await openPost(rawId);
    
 } else if (hash.startsWith("#profile")) {
    if (hash === "#profile") {
      currentViewedUser = null;
      goProfile();
    } else {
      const userId = parseInt(hash.replace("#profile-", ""));
      
      // 🛑 МАГІЧНИЙ ФІКС: Якщо ми перейшли з іншої сторінки і список юзерів порожній,
      // ми швидко просимо базу даних дати нам цей список!
      if (adminUsersCache.length === 0) {
        adminUsersCache = await fetchUsers();
      }

      const u = adminUsersCache.find(x => x.id === userId);
      if (u) {
        currentViewedUser = u;
        const pc = document.getElementById("profileContent");
        if (!pc) { window.location.href = "index.html" + hash; return; }
        renderProfile("overview");
        setPage("profile");
      } else {
         const pc = document.getElementById("profileContent");
         if (!pc) { window.location.href = "index.html" + hash; return; }
         pc.innerHTML = `
           <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:60px 20px; text-align:center; margin-top:20px;">
             <div style="font-size:48px; margin-bottom:16px;">👤</div>
             <h2 style="font-family:var(--font-head); font-size:1.5rem; margin-bottom:8px;">Профіль не знайдено</h2>
             <p style="color:var(--muted); font-size:14px; margin-bottom:24px;">Такого користувача не існує або він прихований.</p>
             <button class="btn btn-accent" style="border-radius:8px; padding:8px 24px;" onclick="setPage('home')">На головну</button>
           </div>`;
         setPage("profile");
      }
    }
  } else if (hash.startsWith("#category-")) {
    const cat = decodeURIComponent(hash.replace("#category-", ""));
    // Якщо такої категорії не існує
    if (!categoryConfig[cat]) {
      const pf = document.getElementById("postFeed");
      if (!pf) { window.location.href = "index.html" + hash; return; }
      pf.innerHTML = `
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:60px 20px; text-align:center; margin-top:20px;">
          <div style="font-size:48px; margin-bottom:16px;">🗂️</div>
          <h2 style="font-family:var(--font-head); font-size:1.5rem; margin-bottom:8px;">Категорію не знайдено</h2>
          <p style="color:var(--muted); font-size:14px; margin-bottom:24px;">Спільноти <b>${cat}</b> не існує.</p>
          <button class="btn btn-accent" style="border-radius:8px; padding:8px 24px;" onclick="setPage('home')">Повернутись у стрічку</button>
        </div>`;
      setPage("home");
    } else {
      filterByCategory(cat);
    }

  } else if (hash.startsWith("#admin")) { 
    const tab = hash.replace("#admin-", "") || "dashboard";
    if (isAdmin()) {
      if (!path.includes("admin.html")) {
        window.location.href = "admin.html" + hash;
        return;
      }
      const adminPanel = document.getElementById("adminPanel");
      if (adminPanel) {
        adminPanel.style.display = "block";
        switchAdminTab(tab);
      }
    } else {
      window.location.href = "index.html";
    }
  } else {
    if (!path.includes("popular") && !path.includes("categor") && !path.includes("contact") && !path.includes("admin")) {
      setPage("home");
    }
  }
}

// ════════════════════════════════════════════
//  НАЛАШТУВАННЯ ПАГІНАЦІЇ (ЛОГІКА)
// ════════════════════════════════════════════
const ITEMS_PER_PAGE = 15;

let adminPostsPage = 1;

let adminMessagesPage = 1;
let adminMessagesCache = [];

let adminUsersPage = 1;
let filteredUsersCache = []; // Кеш для пошуку користувачів

// Генератор HTML для кнопок сторінок
function getPaginationHTML(totalItems, currentPage, funcName) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return ""; 
  
  let html = `<div style="display:flex; gap:6px; justify-content:center; margin-top:16px; padding:10px;">`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="btn ${i === currentPage ? 'btn-accent' : 'btn-ghost'}" style="padding:6px 14px; border-radius:8px; font-weight:bold;" onclick="${funcName}(${i})">${i}</button>`;
  }
  html += `</div>`;
  return html;
}

// ════════════════════════════════════════════
//  ГОЛОВНИЙ ПЕРЕМИКАЧ АДМІНКИ
// ════════════════════════════════════════════
function switchAdminTab(tab) {
  window.location.hash = "admin-" + tab;
  document.querySelectorAll(".admin-page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".admin-nav-item").forEach((n) => n.classList.remove("active"));
  
  const page = document.getElementById("admin-" + tab);
  const navItem = document.getElementById("atab-" + tab);
  if(page) page.classList.add("active");
  if(navItem) navItem.classList.add("active");
  
  if (tab === "dashboard") renderAdminDashboard();
  else if (tab === "categories") renderAdminCategories();
  else if (tab === "users") { adminUsersPage = 1; renderAdminUsers(); }
  else if (tab === "posts") { adminPostsPage = 1; renderAdminPosts(); }
  else if (tab === "messages") { adminMessagesPage = 1; loadAdminMessages(); }
}

function renderAdminDashboard() {
  const rp = document.getElementById("adminRecentPosts");
  if(!rp) return;
  rp.innerHTML = `<table class="admin-table"><thead><tr><th>Заголовок</th><th>Категорія</th><th>Автор</th></tr></thead><tbody>${posts.slice(0, 5).map((p) => `<tr><td>${p.title}</td><td>${p.sub}</td><td>${p.authorName}</td></tr>`).join("")}</tbody></table>`;
}

function renderAdminCategories() {
  const cats = Object.entries(categoryConfig);
  const grid = document.getElementById("adminCatGrid");
  if(!grid) return;
  grid.innerHTML = cats.map(([key, v]) => {
    const count = posts.filter((p) => p.sub === key).length;
    return `<div class="cat-card">
      <div class="cat-card-top" style="background:${v.color}20">${v.emoji}</div>
      <div class="cat-card-body">
        <div class="cat-card-name">${key}</div>
        <div class="cat-card-footer">
          <div class="cat-post-count">📝 ${count} постів</div>
          <div class="cat-card-actions">
            <button class="tbl-btn primary" onclick="startEditCat('${key}')">✏️</button>
            <button class="tbl-btn danger" onclick="startDeleteCat('${key}',${count})">🗑️</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join("");
}

function showCatForm() {
  document.getElementById("catFormWrap").style.display = "block";
  document.getElementById("catFormTitle").textContent = "➕ Нова категорія";
  document.getElementById("catEditKey").value = "";
  document.getElementById("catName").value = "";
  document.getElementById("catEmoji").value = "";
  document.getElementById("catDesc").value = "";
  document.getElementById("catColor").value = "";
}

function hideCatForm() { document.getElementById("catFormWrap").style.display = "none"; }

function startEditCat(key) {
  const v = categoryConfig[key];
  if (!v) return;
  document.getElementById("catFormWrap").style.display = "block";
  document.getElementById("catFormTitle").textContent = "✏️ Редагувати категорію";
  document.getElementById("catEditKey").value = key;
  document.getElementById("catName").value = key;
  document.getElementById("catEmoji").value = v.emoji;
  document.getElementById("catDesc").value = v.desc || "";
  document.getElementById("catColor").value = v.color;
  const flairEl = document.getElementById("catFlair");
  if (flairEl) flairEl.value = v.flair[1] || "flair-tech";
  document.getElementById("catFormWrap").scrollIntoView({ behavior: "smooth" });
}

async function saveCat() {
  const editKey = document.getElementById("catEditKey").value;
  const name = document.getElementById("catName").value.trim();
  const emoji = document.getElementById("catEmoji").value.trim() || "📁";
  const desc = document.getElementById("catDesc").value.trim();
  const color = document.getElementById("catColor").value.trim() || "#ff4500";
  const flairClass = document.getElementById("catFlair")?.value || "flair-tech";
  const flairLabel = flairClass === "flair-cs" ? "Пост" : flairClass === "flair-news" ? "Новини" : "Тема";

  if (!name || !name.startsWith("r/")) { showToast("Назва має починатись з r/ та не бути порожньою!", "error"); return; }

  if (editKey && editKey !== name) {
    const hasPosts = posts.some((p) => p.sub === editKey);
    if (hasPosts) { showToast("Не можна змінити назву, є пости!", "error"); return; }
    await supabase.from("categories").delete().eq("name", editKey);
  }

  const { error } = await supabase.from("categories").upsert([{ name: name, emoji: emoji, color: color, description: desc, flair_label: flairLabel, flair_class: flairClass }]);
  if (error) { showToast("Помилка збереження в базу!", "error"); return; }

  hideCatForm();
  await loadData();
  renderAdminCategories();
  renderSidebarCommunities();
  renderHeader();
  showToast("✅ Категорію збережено!", "success");
}

function startDeleteCat(key, count) {
  _pendingDeleteCatKey = key;
  const msg = document.getElementById("deleteCatMsg");
  const btn = document.getElementById("deleteCatConfirmBtn");
  if (count > 0) {
    msg.innerHTML = `⚠️ У категорії <b>${key}</b> є <b>${count} постів</b>. Спочатку видаліть їх.`;
    btn.style.display = "none";
  } else {
    msg.textContent = `Видалити "${key}"?`;
    btn.style.display = "";
  }
  openModal("deleteCatOverlay");
}

async function deleteCatConfirmed() {
  const key = _pendingDeleteCatKey;
  if (!key) return;
  const { error } = await supabase.from("categories").delete().eq("name", key);
  closeModal("deleteCatOverlay");
  if (!error) {
    _pendingDeleteCatKey = null;
    await loadData();
    renderAdminCategories();
    renderSidebarCommunities();
    renderFeed();
    showToast("🗑️ Категорію видалено", "success");
  } else {
    showToast("Помилка видалення!", "error");
  }
}

async function submitContactForm() {
  const name = document.getElementById("contactName").value.trim();
  const email = document.getElementById("contactEmail").value.trim();
  const message = document.getElementById("contactMessage").value.trim();

  if (!name || !email || !message) { showToast("Будь ласка, заповніть всі поля", "error"); return; }

  const result = await submitContactDb({ name, email, message });
  if (result.success) {
    showToast("✅ Повідомлення надіслано!", "success");
    document.getElementById("contactName").value = "";
    document.getElementById("contactEmail").value = "";
    document.getElementById("contactMessage").value = "";
  } else { showToast("Помилка при надсиланні", "error"); }
}

// ════════════════════════════════════════════
//  АДМІН: ЗВЕРНЕННЯ (ПАКЕТНЕ ЗАВАНТАЖЕННЯ)
// ════════════════════════════════════════════
async function loadAdminMessages() {
  adminMessagesCache = await fetchContactsDb();
  drawMessagesTable();
}

function setAdminMessagesPage(page) {
  adminMessagesPage = page;
  drawMessagesTable();
}

function drawMessagesTable() {
  const countEl = document.getElementById("messagesCount");
  if (countEl) countEl.textContent = `Всього: ${adminMessagesCache.length} звернень`;

  const statusColors = {
    'new': { label: 'Нове', color: 'var(--blue)' },
    'process': { label: 'В роботі', color: 'var(--yellow)' },
    'closed': { label: 'Закрито', color: 'var(--green)' }
  };

  const tb = document.getElementById("messagesTableBody");
  if(!tb) return;

  // ✂️ ПАГІНАЦІЯ
  const start = (adminMessagesPage - 1) * ITEMS_PER_PAGE;
  const paginated = adminMessagesCache.slice(start, start + ITEMS_PER_PAGE);

  tb.innerHTML = paginated.map(m => {
    const date = m.created_at ? new Date(m.created_at).toLocaleString('uk-UA') : "—";
    const currentStatus = m.status || 'new';
    const s = statusColors[currentStatus];

    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:12px;color:var(--muted);font-size:12px;white-space:nowrap">${date}</td>
        <td style="padding:12px;font-weight:600">${m.name}</td>
        <td style="padding:12px;color:var(--blue)">${m.email}</td>
        <td style="padding:12px;max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${m.message.replace(/"/g, '&quot;')}">${m.message}</td>
        <td style="padding:12px">
          <select onchange="changeMessageStatus(${m.id}, this.value)" style="background:${s.color}20; color:${s.color}; border:1px solid ${s.color}40; border-radius:12px; padding:4px 8px; font-size:12px; font-weight:700; cursor:pointer; outline:none">
            <option value="new" style="color:var(--text); background:var(--bg);" ${currentStatus === 'new' ? 'selected' : ''}>Нове</option>
            <option value="process" style="color:var(--text); background:var(--bg);" ${currentStatus === 'process' ? 'selected' : ''}>В роботі</option>
            <option value="closed" style="color:var(--text); background:var(--bg);" ${currentStatus === 'closed' ? 'selected' : ''}>Закрито</option>
          </select>
        </td>
        <td style="padding:12px"><button class="tbl-btn danger" onclick="deleteMessage(${m.id})" title="Видалити">🗑️</button></td>
      </tr>
    `;
  }).join("");

  // 🔘 Рендер кнопок пагінації
  let pagContainer = document.getElementById("adminMessagesPagination");
  if (!pagContainer) {
    pagContainer = document.createElement("div");
    pagContainer.id = "adminMessagesPagination";
    tb.closest('.admin-table-wrap').after(pagContainer);
  }
  pagContainer.innerHTML = getPaginationHTML(adminMessagesCache.length, adminMessagesPage, 'setAdminMessagesPage');
}

async function changeMessageStatus(id, newStatus) {
  const result = await updateContactStatusDb(id, newStatus);
  if (result && result.success) {
    await loadAdminMessages();
    showToast("✅ Статус оновлено!", "success");
  } else { showToast("Помилка зміни статусу", "error"); }
}

async function deleteMessage(id) {
  if (confirm("Видалити це звернення?")) {
    const result = await deleteContactDb(id);
    if (result.success) {
      await loadAdminMessages();
      showToast("🗑️ Звернення видалено", "success");
    } else { showToast("Помилка видалення", "error"); }
  }
}

// ════════════════════════════════════════════
//  АДМІН: КОРИСТУВАЧІ ТА ПОШУК
// ════════════════════════════════════════════
async function renderAdminUsers() {
  adminUsersCache = await fetchUsers();
  filteredUsersCache = [...adminUsersCache];
  drawUsersTable();
}

function filterAdminUsers(query) {
  const q = query.toLowerCase().trim();
  filteredUsersCache = adminUsersCache.filter(u => 
    u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );
  adminUsersPage = 1; // Скидаємо на 1 сторінку при пошуку
  drawUsersTable();
}

function setAdminUsersPage(page) {
  adminUsersPage = page;
  drawUsersTable();
}

function drawUsersTable() {
  const currentU = getCurrentUser();
  const userCountEl = document.getElementById("userCount");
  if (userCountEl) userCountEl.textContent = `Знайдено: ${filteredUsersCache.length}`;

  const tb = document.getElementById("usersTableBody");
  if(!tb) return;

  if (filteredUsersCache.length === 0) {
    tb.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted)">Користувачів не знайдено 🕵️‍♂️</td></tr>`;
    const pag = document.getElementById("adminUsersPagination");
    if (pag) pag.innerHTML = "";
    return;
  }

  const start = (adminUsersPage - 1) * ITEMS_PER_PAGE;
  const paginated = filteredUsersCache.slice(start, start + ITEMS_PER_PAGE);

  tb.innerHTML = paginated.map((u) => {
    const regDate = u.created_at ? new Date(u.created_at).toLocaleDateString("uk-UA") : "—";
    return `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:12px">
        <div style="display:flex;align-items:center;gap:8px; cursor:pointer;" onclick="openUserProfile(${u.id})" title="Перейти в профіль">
          <div class="user-avatar" style="width:28px;height:28px;font-size:11px;flex-shrink:0;${u.role === "superadmin" ? "background:#c0392b;color:#fff" : u.is_admin ? "background:var(--yellow)" : ""}">
            ${u.name.slice(0, 2).toUpperCase()}
          </div>
          <span style="font-weight:600; text-decoration:underline; color:var(--text); transition:color 0.2s" onmouseover="this.style.color='var(--blue)'" onmouseout="this.style.color='var(--text)'">
            ${u.name}${u.id === currentU?.id ? ' <span style="font-size:11px;color:var(--muted);text-decoration:none">(ви)</span>' : ""}
          </span>
        </div>
      </td>
      <td style="padding:12px;color:var(--muted)">${u.email}</td>
      <td style="padding:12px;font-weight:600">⭐ ${u.karma || 0}</td>
      <td style="padding:12px;color:var(--muted);font-size:13px">${regDate}</td>
      <td style="padding:12px">
        <span class="role-badge ${u.role === "superadmin" ? "role-admin" : u.is_admin ? "role-admin" : "role-user"}">
          ${u.role === "superadmin" ? "Супер Адмін" : u.is_admin ? "Адмін" : "Користувач"}
        </span>
      </td>
      <td style="padding:12px">
        <div class="table-actions" style="display:flex;gap:6px">
          ${u.role === "superadmin" ? '<span style="color:var(--muted);font-size:12px">Захищений</span>' : u.id === currentU?.id ? '<span style="color:var(--muted);font-size:12px">Ви</span>' : `${u.is_admin ? `<button class="tbl-btn warn" onclick="changeUserRole(${u.id},'user')" title="Зняти права адміна">👤</button>` : `<button class="tbl-btn primary" onclick="changeUserRole(${u.id},'admin')" title="Надати права адміна">⚙️</button>`}<button class="tbl-btn danger" onclick="deleteUser(${u.id})" title="Видалити користувача">🗑️</button>`}
        </div>
      </td>
    </tr>`;
  }).join("");

  let pagContainer = document.getElementById("adminUsersPagination");
  if (!pagContainer) {
    pagContainer = document.createElement("div");
    pagContainer.id = "adminUsersPagination";
    tb.closest('.admin-table-wrap').after(pagContainer);
  }
  pagContainer.innerHTML = getPaginationHTML(filteredUsersCache.length, adminUsersPage, 'setAdminUsersPage');
}

async function changeUserRole(userId, newRole) {
  const { error } = await supabase.from("users").update({ role: newRole, is_admin: newRole === "admin" }).eq("id", userId);
  if (!error) { renderAdminUsers(); showToast(`✅ Роль змінено`, "success"); } 
  else { showToast(`Помилка зміни ролі`, "error"); }
}

async function deleteUser(userId) {
  if (confirm("Видалити користувача?")) {
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (!error) { renderAdminUsers(); showToast("🗑️ Видалено", "success"); } 
    else { showToast("Помилка видалення", "error"); }
  }
}

// ════════════════════════════════════════════
//  АДМІН: ВСІ ПОСТИ
// ════════════════════════════════════════════
function setAdminPostsPage(page) {
  adminPostsPage = page;
  renderAdminPosts();
}

function renderAdminPosts() {
  const postsCountEl = document.getElementById("postsCount");
  if (postsCountEl) postsCountEl.textContent = `Всього: ${posts.length} постів`;

  const tb = document.getElementById("postsTableBody");
  if(!tb) return;

  // ✂️ ПАГІНАЦІЯ
  const start = (adminPostsPage - 1) * ITEMS_PER_PAGE;
  const paginated = posts.slice(start, start + ITEMS_PER_PAGE);

  tb.innerHTML = paginated.map((p) => `
   <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:12px;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.5;padding-bottom:14px" title="${p.title.replace(/"/g, "&quot;")}">
        <a href="#post-${p.id}" onclick="document.getElementById('adminPanel').style.display='none'; document.getElementById('mainLayout').style.display='';" style="color:var(--text); text-decoration:none; transition:color 0.2s" onmouseover="this.style.color='var(--blue)'" onmouseout="this.style.color='var(--text)'"><b>${p.title}</b></a>
      </td>
      <td style="padding:12px">
        <span onclick="document.getElementById('adminPanel').style.display='none'; document.getElementById('mainLayout').style.display=''; filterByCategory('${p.sub}')" style="background:${p.subColor}20; color:${p.subColor}; padding:4px 8px; border-radius:12px; font-size:12px; white-space:nowrap; cursor:pointer">${p.emoji} ${p.sub}</span>
      </td>
      <td style="padding:12px;color:var(--text)">${p.authorName}</td>
      <td style="padding:12px;font-weight:600;color:#ff4500">▲ ${p.votes}</td>
      <td style="padding:12px;color:var(--muted)">💬 ${p.comments}</td>
      <td style="padding:12px">
        <div class="table-actions" style="display:flex;gap:6px">
          <button class="tbl-btn primary" onclick="document.getElementById('adminPanel').style.display='none'; document.getElementById('mainLayout').style.display=''; editPost(${p.id})" title="Редагувати пост">✏️</button>
          <button class="tbl-btn danger" onclick="confirmDeletePost(${p.id})" title="Видалити пост">🗑️</button>
        </div>
      </td>
    </tr>
  `).join("");

  // 🔘 Рендер кнопок пагінації
  let pagContainer = document.getElementById("adminPostsPagination");
  if (!pagContainer) {
    pagContainer = document.createElement("div");
    pagContainer.id = "adminPostsPagination";
    tb.closest('.admin-table-wrap').after(pagContainer);
  }
  pagContainer.innerHTML = getPaginationHTML(posts.length, adminPostsPage, 'setAdminPostsPage');
}

async function initApp() {
  await loadData();
  renderHeader();
  
  // 🌍 РОБИМО ДАНІ ГЛОБАЛЬНИМИ
  window.categoryConfig = categoryConfig;
  window.posts = posts;

  const path = window.location.pathname.toLowerCase();

  // 🚀 ХОВАЄМО ЕКРАН ЗАВАНТАЖЕННЯ ПЛАВНО
  const loader = document.getElementById("globalLoader");
  if (loader) {
    loader.classList.add("hidden");
  }

  // Якщо користувач просто відкрив admin.html без хешу
  if (path.includes("admin.html") && !window.location.hash) {
      window.location.hash = "#admin-dashboard";
  }

  if (window.location.hash) {
    await handleRoute();
  } else {
    // 🧠 РОЗУМНИЙ РЕНДЕР
    if (path.includes("popular")) {
      const sortedPosts = [...posts].sort((a, b) => b.votes - a.votes);
      renderFeed(sortedPosts);
    } else if (path.includes("categor") || path.includes("contact") || path.includes("admin")) {
      // Тут нічого не ховаємо
    } else {
      setPage("home");
    }
  }
}

initApp();
// ════════════════════════════════════════════
//  ГЛОБАЛЬНИЙ ЕКСПОРТ ДЛЯ VITE
// ════════════════════════════════════════════
window.setPage = setPage;
window.handleSearch = handleSearch;
window.filterByCategory = filterByCategory;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeIfOverlay = closeIfOverlay;
window.doSignin = doSignin;
window.doSignup = doSignup;
window.doSignout = doSignout;
window.switchToRegister = switchToRegister;
window.switchToLogin = switchToLogin;
window.submitPost = submitPost;
window.deletePost = deletePost;
window.confirmDeletePost = confirmDeletePost;
window.editPost = editPost;
window.saveEditPost = saveEditPost;
window.castVote = castVote;
window.savePost = savePost;
window.sharePost = sharePost;
window.openPost = openPost;
window.setSort = setSort;
window.toggleJoin = toggleJoin;
window.toggleDropdown = toggleDropdown;
window.closeDropdown = closeDropdown;
window.goProfile = goProfile;
window.renderProfile = renderProfile;
window.shareProfile = shareProfile;
window.postComment = postComment;
window.requireAuth = requireAuth;
window.openAdminPanel = openAdminPanel;
window.switchAdminTab = switchAdminTab;
window.changeUserRole = changeUserRole;
window.deleteUser = deleteUser;
window.startDeleteCat = startDeleteCat;
window.deleteCatConfirmed = deleteCatConfirmed;
window.showCatForm = showCatForm;
window.hideCatForm = hideCatForm;
window.startEditCat = startEditCat;
window.saveCat = saveCat;
window.toggleJoinCategory = toggleJoinCategory;
window.submitContactForm = submitContactForm;
window.deleteMessage = deleteMessage;
window.changeMessageStatus = changeMessageStatus;
window.filterAdminUsers = filterAdminUsers;
window.setAdminUsersPage = setAdminUsersPage;
window.setAdminPostsPage = setAdminPostsPage;
window.setAdminMessagesPage = setAdminMessagesPage;
window.openUserProfile = openUserProfile;
window.categoryConfig = categoryConfig;
window.posts = posts;
window.renderSidebarCommunities = renderSidebarCommunities;