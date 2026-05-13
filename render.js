// ════════════════════════════════════════════
//  RENDER — хедер, сайдбар, стрічка, картки постів
// ════════════════════════════════════════════
import{getCurrentUser,isAdmin, doSignout} from "./auth.js";
import { getUserColor, fmtNum, linkify,  toggleDropdown, closeDropdown, toggleJoinCategory, filterByCategory, sharePost, toggleJoin, openModal } from "./ui.js";
import { castVote, savePost, editPost, confirmDeletePost } from "./posts.js";
import { openPost, goProfile } from "./pages.js";
import { openAdminPanel } from "./admin.js";
export function renderSidebarCommunities() {
  const sc = document.getElementById("sidebarCommunities");
  if (!sc) return; // 🛡️ Щит для лівого меню

  const cats = Object.entries(categoryConfig);
  const user = getCurrentUser();
  const joinedSubs = user?.joinedSubs || [];

  const colors = ["blue", "green", "purple", "", "blue"];
  sc.innerHTML = cats
    .map(
      ([k, v], i) =>
        `<div class="nav-item" onclick="filterByCategory('${k}')" style="cursor:pointer"><div class="community-avatar ${colors[i % colors.length]}" style="background:${v.color}20;color:${v.color};border:1px solid ${v.color}40">${v.emoji}</div>${k}</div>`,
    )
    .join("");

  const rsc = document.getElementById("rightSidebarCommunities");
  if (rsc) {
    const myCats = cats.filter(([k, v]) => joinedSubs.includes(k));

    if (myCats.length === 0) {
      rsc.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">Ви ще не підписані на жодну спільноту</div>`;
      return;
    }

    rsc.innerHTML = myCats
      .map(([k, v], i) => {
        const count = posts.filter((p) => p.sub === k).length;
        return `<div class="community-row" onclick="filterByCategory('${k}')" style="cursor:pointer">
      <div class="community-num">${i + 1}</div>
      <div style="width:24px;height:24px;border-radius:50%;background:${v.color}20;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${v.emoji}</div>
      <div class="community-info"><div class="community-name">${k}</div><div class="community-members">${count} постів</div></div>
      <button class="join-btn joined" onclick="event.stopPropagation();toggleJoin(this)">Вийти</button>
    </div>`;
      })
      .join("");
  }
}
export function renderHeader() {
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

export function renderFeed(data) {
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
        <button class="btn ${isJoined ? "btn-ghost joined" : "btn-accent"}" style="border-radius:20px; padding:8px 20px" onclick="toggleJoinCategory('${currentCategory}', this)">
          ${isJoined ? "Вийти" : "Приєднатись"}
        </button>
      </div>
    </div>`;
  }

  // Збираємо всі пости до купи
  html += list.map((p) => postCard(p)).join("");

  // 🛑 ОСЬ ТОЙ САМИЙ НОВИЙ БЛОК: Розумна перевірка на порожню стрічку
  if (list.length === 0) {
    const isHome = !currentCategory && (window.location.pathname.includes("index.html") || window.location.pathname === "/");
    
    if (isHome) {
      feedContainer.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:var(--surface); border:1px solid var(--border); border-radius:12px; animation: fadeIn 0.4s ease;">
          <div style="font-size:48px; margin-bottom:16px;">🏠</div>
          <h2 style="font-family:var(--font-head); margin-bottom:8px;">Ваша стрічка поки порожня</h2>
          <p style="color:var(--muted); margin-bottom:24px; max-width:400px; margin-left:auto; margin-right:auto;">
            Підпишіться на цікаві спільноти, щоб бачити тут їхні останні новини.
          </p>
          <a href="categories.html" class="btn btn-accent" style="text-decoration:none; padding:10px 24px; border-radius:8px;">
            🔍 Переглянути категорії
          </a>
        </div>`;
    } else {
      feedContainer.innerHTML = `<div style="text-align:center; padding:40px; color:var(--muted)">Постів ще немає</div>`;
    }
  } else {
    // Якщо пости є - просто вставляємо їх
    feedContainer.innerHTML = html;
  }

  // ✅ Ці функції безпечно залишаються в самому кінці
  renderFeatured(list);
  renderSidebarCommunities();
}

export function renderFeatured(data) {
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

export function postCard(p) {
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
export function renderComment(c) {
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
// Допоміжна функція для отримання імені автора
export function getAuthorName(post) {
  return post.authorName || "Невідомий";
}
let isSidebarRendered = false;

export function renderCategorySearch() {
  if (typeof categoryConfig === "undefined" || !Object.keys(categoryConfig).length) return;

  // 1. Рендеримо сайдбар 1 раз (щоб не дублювався)
  if (!isSidebarRendered) {
    const sidebar = document.getElementById("sidebarCommunities");
    if (sidebar) sidebar.innerHTML = ""; 
    renderSidebarCommunities();
    isSidebarRendered = true;
  }

  // 2. Шукаємо поле вводу і сітку
  const grid = document.getElementById("categoryBrowseGrid");
  if (!grid) return;

  const searchInput = document.getElementById("catSearchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  let entries = Object.entries(categoryConfig);

  // 3. Фільтруємо
  if (query) {
    entries = entries.filter(
      ([key, v]) =>
        key.toLowerCase().includes(query) ||
        (v.desc && v.desc.toLowerCase().includes(query)),
    );
  }

  // 4. Малюємо результат
  if (entries.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted); background: var(--surface); border-radius: 12px; border: 1px dashed var(--border);">Спільнот за запитом "<b>${query}</b>" не знайдено 😢</div>`;
    return;
  }

  grid.innerHTML = entries
    .map(([key, v]) => {
      const count = typeof posts !== "undefined" ? posts.filter((p) => p.sub === key).length : 0;
      const url = "index.html#category-" + encodeURIComponent(key);
      
      return `<a class="cat-browse-card" href="${url}">
        <div class="cat-browse-top" style="background:${v.color}20">${v.emoji}</div>
        <div class="cat-browse-body">
          <div class="cat-browse-name">${key}</div>
          <div class="cat-browse-desc">${v.desc || "Спільнота форуму"}</div>
          <div class="cat-browse-count">📝 ${count} постів</div>
        </div>
      </a>`;
    })
    .join("");
}