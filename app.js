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
} from "./db.js";

// ════════════════════════════════════════════
//  ГЛОБАЛЬНІ ЗМІННІ
// ════════════════════════════════════════════
let posts = [];
let categoryConfig = {};
let voteMap = {};
let postComments = {};
let currentPostId = null;
let _pendingDeleteId = null;
let _pendingDeleteCatKey = null;

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
async function loadData() {
  const catData = await fetchCategories();
  categoryConfig = {};
  catData.forEach((c) => {
    categoryConfig[c.name] = {
      emoji: c.emoji,
      color: c.color,
      desc: c.description,
      flair: [c.flair_label, c.flair_class],
    };
  });

  const postData = await fetchPosts();
  posts = postData.map((p) => {
    const cat = categoryConfig[p.sub] || {
      emoji: "📝",
      color: "#ff4500",
      flair: ["Пост", "flair-tech"],
    };
    return {
      id: p.id,
      authorId: p.author_id,
      authorName: p.author_name,
      sub: p.sub,
      subColor: cat.color,
      title: p.title,
      body: p.body,
      emoji: cat.emoji,
      flair: cat.flair[0],
      flairClass: cat.flair[1],
      votes: p.votes || 0,
      comments: p.comments_count || 0,
      time: new Date(p.created_at).toLocaleString("uk-UA"),
      edited: p.is_edited,
    };
  });
}

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

  const result = await createPostDb({
    author_id: user.id,
    author_name: user.name,
    sub: cat,
    title: title,
    body: body || "",
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
  document.getElementById("postTitle").value = "";
  document.getElementById("postBody").value = "";
  closeModal("createPostOverlay");
  renderHeader();
  renderFeed();
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
  const result = await deletePostDb(id);
  if (result.success) {
    await loadData();
    closeModal("deleteConfirmOverlay");
    _pendingDeleteId = null;
    if (document.getElementById("page-post").classList.contains("active"))
      setPage("home");
    renderFeed();
    showToast("🗑️ Пост видалено", "error");
  } else {
    showToast("Помилка видалення!", "error");
  }
}

// ════════════════════════════════════════════
//  ВІЗУАЛ (РЕНДЕР)
// ════════════════════════════════════════════
function renderSidebarCommunities() {
  const cats = Object.entries(categoryConfig);
  const colors = ["blue", "green", "purple", "", "blue"];
  document.getElementById("sidebarCommunities").innerHTML = cats
    .slice(0, 5)
    .map(
      ([k, v], i) =>
        `<div class="nav-item" onclick="filterByCategory('${k}')" style="cursor:pointer"><div class="community-avatar ${colors[i % colors.length]}" style="background:${v.color}20;color:${v.color};border:1px solid ${v.color}40">${v.emoji}</div>${k}</div>`,
    )
    .join("");

  const rsc = document.getElementById("rightSidebarCommunities");
  if (rsc) {
    rsc.innerHTML = cats
      .slice(0, 5)
      .map(([k, v], i) => {
        const count = posts.filter((p) => p.sub === k).length;
        return `<div class="community-row" onclick="filterByCategory('${k}')" style="cursor:pointer">
      <div class="community-num">${i + 1}</div>
      <div style="width:24px;height:24px;border-radius:50%;background:${v.color}20;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${v.emoji}</div>
      <div class="community-info"><div class="community-name">${k}</div><div class="community-members">${count} постів</div></div>
      <button class="join-btn" onclick="event.stopPropagation();toggleJoin(this)">Приєднатись</button>
    </div>`;
      })
      .join("");
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
    ha.innerHTML = `
      <button style="background:var(--surface2);border:1px solid var(--border);color:var(--text);display:flex;align-items:center;gap:6px;border-radius:20px;padding:6px 14px;font-size:13px" onclick="openModal('createPostOverlay')">✏️ Створити</button>
      <button class="notif-btn"><span>🔔</span><span class="notif-dot"></span></button>
      <div class="avatar-wrap">
        <div class="user-avatar" id="avatarBtn" onclick="toggleDropdown()">${ini}</div>
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
        <div style="display:flex;align-items:center;gap:10px"><div class="user-avatar" style="width:36px;height:36px">${ini}</div>
        <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:8px 14px;color:var(--muted);cursor:pointer" onclick="openModal('createPostOverlay')">Створити пост…</div></div>
      </div></div>`;
  } else {
    ha.innerHTML = `<button class="btn btn-ghost" onclick="openModal('loginOverlay')">Вхід</button><button class="btn btn-accent" onclick="openModal('registerOverlay')">Реєстрація</button>`;
    if (cpw) cpw.innerHTML = "";
  }
}

function renderFeed(data) {
  const list = data || posts;
  document.getElementById("postFeed").innerHTML = list
    .map((p) => postCard(p))
    .join("");
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

  return `<div class="post-card" onclick="openPost(${p.id})">
    <div class="post-vote" onclick="event.stopPropagation()">
      <button class="vote-btn${v === 1 ? " voted" : ""}" onclick="castVote(${p.id},1)">▲</button>
      <div class="vote-count">${fmtNum(p.votes + v)}</div>
      <button class="vote-btn${v === -1 ? " voted" : ""}" onclick="castVote(${p.id},-1)">▼</button>
    </div>
    <div class="post-body">
      <div class="post-meta">
        <div class="post-sub"><div class="sub-icon" style="background:${p.subColor}">${p.sub[2].toUpperCase()}</div>${p.sub}</div>
        <span class="post-author">Автор: <span>${authorName}</span></span>
        <span class="post-time">· ${p.time}</span>
        <span class="flair ${p.flairClass}">${p.flair}</span>
      </div>
      <div class="post-title">${p.title}</div>
      <div class="post-actions">
        <button class="action-btn">💬 ${fmtNum(commentCount)}</button>
        <button class="action-btn" onclick="event.stopPropagation();sharePost(${p.id})">🔗 Поділитись</button>
        ${manageBtns}
      </div>
    </div>
    <div class="post-thumb">${p.emoji}</div>
  </div>`;
}

async function openPost(id) {
  currentPostId = id;
  const p = posts.find((x) => x.id === id);
  if (!p) return;

  // ЗАВАНТАЖУЄМО КОМЕНТАРІ З SUPABASE
  // Переконайтеся, що fetchCommentsDb додана у вашому db.js
  const comments = await fetchCommentsDb(id);

  const v = voteMap[id] || 0;
  const auth = isAuthenticated();
  const user = getCurrentUser();
  const authorName = getAuthorName(p);
  const canManage = user && (user.id === p.authorId || isAdmin());

  document.getElementById("postViewContent").innerHTML = `
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
            <div class="post-sub"><div class="sub-icon" style="background:${p.subColor}">${p.sub[2].toUpperCase()}</div>${p.sub}</div>
            <span class="post-author">Автор: <span>${authorName}</span></span>
            <span class="post-time">· ${p.time}</span>
            <span class="flair ${p.flairClass}">${p.flair}</span>
            ${p.edited ? `<span style="font-size:11px;color:var(--muted)">• редаговано</span>` : ""}
          </div>
         <div class="post-title" style="font-size:1.3rem;margin-bottom:12px;line-height:1.5;padding-bottom:4px">${p.title}</div>
          <div style="font-size:40px;text-align:center;background:var(--surface2);border-radius:8px;padding:24px;margin-bottom:12px">${p.emoji}</div>
          ${p.body ? `<p style="line-height:1.7;margin-bottom:14px">${p.body}</p>` : ""}
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

function renderComment(c) {
  // Форматуємо дату з Supabase
  const time = c.created_at
    ? new Date(c.created_at).toLocaleString("uk-UA", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "щойно";

  // Використовуємо author_name, як у таблиці бази даних
  const name = c.author_name || "Гість";

  return `
    <div style="display:flex;gap:10px;margin-bottom:14px">
      <div class="user-avatar" style="width:28px;height:28px;font-size:12px;flex-shrink:0">${name[0].toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-size:12px;color:var(--blue);font-weight:600">${name} <span style="color:var(--muted);font-weight:400">· ${time}</span></div>
        <div style="font-size:14px;margin-top:4px;line-height:1.6">${c.text}</div>
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
function savePost(id) {
  if (!requireAuth()) return;
  showToast("🔖 Збережено!", "success");
}

// ════════════════════════════════════════════
//  АДМІН-ПАНЕЛЬ
// ════════════════════════════════════════════
function openAdminPanel() {
  if (!isAdmin()) {
    showToast("Доступ заборонено!", "error");
    return;
  }
  document.getElementById("mainLayout").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";
  switchAdminTab("dashboard");
}

function switchAdminTab(tab) {
  document
    .querySelectorAll(".admin-page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".admin-nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("admin-" + tab).classList.add("active");
  document.getElementById("atab-" + tab).classList.add("active");
  if (tab === "dashboard") renderAdminDashboard();
  else if (tab === "categories") renderAdminCategories();
  else if (tab === "users") renderAdminUsers();
  else if (tab === "posts") renderAdminPosts();
}

function renderAdminDashboard() {
  document.getElementById("adminRecentPosts").innerHTML =
    `<table class="admin-table"><thead><tr><th>Заголовок</th><th>Категорія</th><th>Автор</th></tr></thead><tbody>${posts
      .slice(0, 5)
      .map(
        (p) =>
          `<tr><td>${p.title}</td><td>${p.sub}</td><td>${p.authorName}</td></tr>`,
      )
      .join("")}</tbody></table>`;
}

function renderAdminCategories() {
  const cats = Object.entries(categoryConfig);
  document.getElementById("adminCatGrid").innerHTML = cats
    .map(([key, v]) => {
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
    })
    .join("");
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

function hideCatForm() {
  document.getElementById("catFormWrap").style.display = "none";
}

function startEditCat(key) {
  const v = categoryConfig[key];
  if (!v) return;
  document.getElementById("catFormWrap").style.display = "block";
  document.getElementById("catFormTitle").textContent =
    "✏️ Редагувати категорію";
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
  const flairLabel =
    flairClass === "flair-cs"
      ? "Пост"
      : flairClass === "flair-news"
        ? "Новини"
        : "Тема";

  if (!name) {
    showToast("Введіть назву!", "error");
    return;
  }
  if (!name.startsWith("r/")) {
    showToast("Назва має починатись з r/", "error");
    return;
  }

  if (editKey && editKey !== name) {
    const hasPosts = posts.some((p) => p.sub === editKey);
    if (hasPosts) {
      showToast("Не можна змінити назву, є пости!", "error");
      return;
    }
    await supabase.from("categories").delete().eq("name", editKey);
  }

  const { error } = await supabase.from("categories").upsert([
    {
      name: name,
      emoji: emoji,
      color: color,
      description: desc,
      flair_label: flairLabel,
      flair_class: flairClass,
    },
  ]);

  if (error) {
    showToast("Помилка збереження в базу!", "error");
    return;
  }

  hideCatForm();
  await loadData();
  renderAdminCategories();
  renderSidebarCommunities();
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

async function renderAdminUsers() {
  const usersFromDb = await fetchUsers();
  const currentU = getCurrentUser();

  const userCountEl = document.getElementById("userCount");
  if (userCountEl)
    userCountEl.textContent = `Всього: ${usersFromDb.length} користувачів`;

  document.getElementById("usersTableBody").innerHTML = usersFromDb
    .map((u) => {
      const regDate = u.created_at
        ? new Date(u.created_at).toLocaleDateString("uk-UA")
        : "—";
      return `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:12px">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="user-avatar" style="width:28px;height:28px;font-size:11px;flex-shrink:0;${u.role === "superadmin" ? "background:#c0392b;color:#fff" : u.is_admin ? "background:var(--yellow)" : ""}">
            ${u.name.slice(0, 2).toUpperCase()}
          </div>
          <span>${u.name}${u.id === currentU?.id ? ' <span style="font-size:11px;color:var(--muted)">(ви)</span>' : ""}</span>
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
          ${
            u.role === "superadmin"
              ? '<span style="color:var(--muted);font-size:12px">Захищений</span>'
              : u.id === currentU?.id
                ? '<span style="color:var(--muted);font-size:12px">Ви</span>'
                : `
              ${
                u.is_admin
                  ? `<button class="tbl-btn warn" onclick="changeUserRole(${u.id},'user')" title="Зняти права адміна">👤</button>`
                  : `<button class="tbl-btn primary" onclick="changeUserRole(${u.id},'admin')" title="Надати права адміна">⚙️</button>`
              }
              <button class="tbl-btn danger" onclick="deleteUser(${u.id})" title="Видалити користувача">🗑️</button>
          `
          }
        </div>
      </td>
    </tr>`;
    })
    .join("");
}

async function changeUserRole(userId, newRole) {
  const { error } = await supabase
    .from("users")
    .update({ role: newRole, is_admin: newRole === "admin" })
    .eq("id", userId);
  if (!error) {
    renderAdminUsers();
    showToast(`✅ Роль змінено`, "success");
  } else {
    showToast(`Помилка зміни ролі`, "error");
  }
}

async function deleteUser(userId) {
  if (confirm("Видалити користувача?")) {
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (!error) {
      renderAdminUsers();
      showToast("🗑️ Видалено", "success");
    } else {
      showToast("Помилка видалення", "error");
    }
  }
}

function renderAdminPosts() {
  const postsCountEl = document.getElementById("postsCount");
  if (postsCountEl) postsCountEl.textContent = `Всього: ${posts.length} постів`;

  document.getElementById("postsTableBody").innerHTML = posts
    .map(
      (p) => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:12px;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.5;padding-bottom:14px" title="${p.title.replace(/"/g, "&quot;")}">
        <b>${p.title}</b>
      </td>
      <td style="padding:12px">
        <span style="background:${p.subColor}20;color:${p.subColor};padding:4px 8px;border-radius:12px;font-size:12px;white-space:nowrap">
          ${p.emoji} ${p.sub}
        </span>
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
  `,
    )
    .join("");
}

// ════════════════════════════════════════════
//  ДОПОМІЖНІ ФУНКЦІЇ ТА НАВІГАЦІЯ
// ════════════════════════════════════════════
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
  renderFeed(posts.filter((p) => p.sub === cat));
  setPage("home");
  showToast(`Показано: ${cat}`, "success");
}
function setSort(btn, type) {
  document
    .querySelectorAll(".sort-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const s = [...posts];
  if (type === "hot") s.sort((a, b) => b.comments - a.comments);
  else if (type === "new") s.sort(() => Math.random() - 0.5);
  else if (type === "top") s.sort((a, b) => b.votes - a.votes);
  renderFeed(s);
}
function setPage(name) {
  if (name === "home") {
    currentPostId = null;
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("mainLayout").style.display = "";
    renderFeed();
  }
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  (
    document.getElementById("page-" + name) ||
    document.getElementById("page-home")
  )?.classList.add("active");
  window.scrollTo(0, 0);
}

let profileTab = "overview";
function goProfile() {
  if (!requireAuth()) return;
  renderProfile("overview");
  setPage("profile");
}
function renderProfile(tab) {
  if (tab) profileTab = tab;
  const user = getCurrentUser();
  if (!user) return;
  const ini = user.name.slice(0, 2).toUpperCase();
  const handle = "u/" + user.name.toLowerCase().replace(/\s+/g, "_");
  const tabs = [
    { id: "overview", label: "Огляд" },
    { id: "posts", label: "Пости" },
    { id: "comments", label: "Коментарі" },
  ];

  const emptyMap = {
    overview: {
      icon: "🐐",
      title: "Постів ще немає",
      sub: "Щойно ви опублікуєте пост, він з'явиться тут.",
    },
    posts: {
      icon: "📝",
      title: "Постів ще немає",
      sub: "Натисніть «Створити пост».",
    },
    comments: {
      icon: "💬",
      title: "Коментарів ще немає",
      sub: "Візьміть участь в обговоренні.",
    },
  };
  const e = emptyMap[profileTab] || emptyMap.overview;

  document.getElementById("profileContent").innerHTML = `
    <div class="profile-header-card">
      <div class="profile-banner"></div>
      <div class="profile-avatar-wrap"><div class="profile-avatar-big">${ini}</div></div>
      <div class="profile-info-row">
        <div>
          <div class="profile-name">${user.name}${isAdmin() ? '<span class="admin-badge">АДМІН</span>' : ""}</div>
          <div class="profile-handle">${handle}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" style="border-radius:8px" onclick="shareProfile()">🔗 Поділитись</button>
          ${isAdmin() ? `<button class="btn btn-admin" style="border-radius:8px" onclick="openAdminPanel()">⚙️ Адмін панель</button>` : ""}
        </div>
      </div>
    </div>
    
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden">
      <div class="profile-tabs">${tabs.map((t) => `<div class="profile-tab${profileTab === t.id ? " active" : ""}" onclick="renderProfile('${t.id}')">${t.label}</div>`).join("")}</div>
      <div class="profile-empty">
        <div class="profile-empty-icon">${e.icon}</div>
        <h3>${e.title}</h3>
        <p style="font-size:13px">${e.sub}</p>
      </div>
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
            <div class="profile-stat-row"><span class="profile-stat-label">Роль</span><span style="font-weight:700;color:${isAdmin() ? "var(--yellow)" : "var(--green)"}">${isAdmin() ? "Адмін" : "Користувач"}</span></div>
          </div>
        </div>
      </div>
    </div>`;
}

function fmtNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "K" : n;
}
function sharePost(id) {
  navigator.clipboard?.writeText(location.href + "#post-" + id);
  showToast("🔗 Скопійовано!", "success");
}
function shareProfile() {
  navigator.clipboard?.writeText(location.href + "#profile");
  showToast("🔗 Скопійовано!", "success");
}
function toggleJoin(btn) {
  if (!requireAuth()) return;
  const j = btn.classList.toggle("joined");
  btn.textContent = j ? "Вийти" : "Приєднатись";
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
//  ІНІЦІАЛІЗАЦІЯ
// ════════════════════════════════════════════
async function initApp() {
  await loadData();
  renderHeader();
  renderFeed();
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
