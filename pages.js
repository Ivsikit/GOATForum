// ════════════════════════════════════════════
//  PAGES — openPost, setPage, профіль, роутер
// ════════════════════════════════════════════
import { isAdmin, getCurrentUser } from "./auth.js";
export async function openPost(rawId) {
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

export function setPage(name) {
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

  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  const targetPage =
    document.getElementById("page-" + name) ||
    document.getElementById("page-home");
  if (targetPage) targetPage.classList.add("active");

  window.scrollTo(0, 0);
}

// ════════════════════════════════════════════
//  ПРОФІЛЬ КОРИСТУВАЧА
// ════════════════════════════════════════════
let profileTab = "overview";
let currentViewedUser = null;
export function openUserProfile(userId) {
  // Просто надійно перекидаємо на Головну сторінку з правильним хешем
  window.location.href = "index.html#profile-" + userId;
}

export function goProfile() {
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

export async function renderProfile(tab) {
  if (tab) profileTab = tab;

  const user = currentViewedUser || getCurrentUser();
  if (!user) return;

  const ini = user.name.slice(0, 2).toUpperCase();
  const uColor = getUserColor(user.name);
  const handle = "u/" + user.name.toLowerCase().replace(/\s+/g, "_");
  const isMe =
    !currentViewedUser || currentViewedUser.id === getCurrentUser()?.id;

  // 1. Списки вкладок (Додаємо "Збережене" ТІЛЬКИ власнику)
  const tabs = [
    { id: "overview", label: "Огляд" },
    { id: "posts", label: "Пости" },
    { id: "comments", label: "Коментарі" },
  ];
  if (isMe) {
    tabs.push({ id: "saved", label: "Збережене" });
  }

  const userPosts = posts.filter((p) => p.authorId === user.id);
  const userComments = await fetchUserCommentsDb(user.id);

  // 2. Формуємо контент вкладки
  let tabContent = "";
  if (profileTab === "posts") {
    tabContent =
      userPosts.length > 0
        ? userPosts.map((p) => postCard(p)).join("")
        : `<div class="profile-empty"><h3>Постів ще немає</h3><p>${isMe ? "Ви ще не опублікували" : "Користувач ще не опублікував"} жодного поста.</p></div>`;
  } else if (profileTab === "comments") {
    tabContent =
      userComments.length > 0
        ? `<div style="padding:8px 16px">${userComments
            .map((c) => {
              const p = posts.find((post) => post.id === c.post_id);
              const postHeader = p
                ? `<div style="font-size:11px; color:var(--muted); margin-bottom:8px; padding-left:38px">До поста: <a style="color:var(--blue); cursor:pointer; font-weight:600; text-decoration:underline" onclick="openPost(${p.id})">${p.title}</a></div>`
                : `<div style="font-size:11px; color:var(--muted); margin-bottom:8px; padding-left:38px">Пост видалено</div>`;
              return `<div style="border-bottom:1px solid var(--border); padding:16px 0; animation: fadeIn 0.3s ease both">${postHeader}${renderComment(c)}</div>`;
            })
            .join("")}</div>`
        : `<div class="profile-empty"><h3>Коментарів ще немає</h3><p>${isMe ? "Ви ще не залишили" : "Користувач ще не залишив"} жодного коментаря.</p></div>`;
  } else if (profileTab === "saved" && isMe) {
    // 🔒 НОВА ЛОГІКА ЗБЕРЕЖЕНОГО
    const savedIds = user.savedPosts || [];
    const savedPosts = posts.filter((p) => savedIds.includes(p.id));

    tabContent =
      savedPosts.length > 0
        ? savedPosts.map((p) => postCard(p)).join("")
        : `<div class="profile-empty"><h3>Збереженого немає</h3><p>Тут з'являться пости, які ви відмітили закладкою.</p></div>`;
  } else {
    // Вкладка "Огляд"
    tabContent =
      userPosts.length > 0
        ? `<div style="padding:10px 0; border-bottom:1px solid var(--border); margin-bottom:10px; font-weight:700; padding-left:16px">Останні пости</div>` +
          userPosts
            .slice(0, 3)
            .map((p) => postCard(p))
            .join("")
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

export async function handleRoute() {
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

      const u = adminUsersCache.find((x) => x.id === userId);
      if (u) {
        currentViewedUser = u;
        const pc = document.getElementById("profileContent");
        if (!pc) {
          window.location.href = "index.html" + hash;
          return;
        }
        renderProfile("overview");
        setPage("profile");
      } else {
        const pc = document.getElementById("profileContent");
        if (!pc) {
          window.location.href = "index.html" + hash;
          return;
        }
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
      if (!pf) {
        window.location.href = "index.html" + hash;
        return;
      }
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
    if (
      !path.includes("popular") &&
      !path.includes("categor") &&
      !path.includes("contact") &&
      !path.includes("admin")
    ) {
      setPage("home");
    }
  }
}