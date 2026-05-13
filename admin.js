// ════════════════════════════════════════════
//  ADMIN — панель, категорії, юзери, пости, звернення
// ════════════════════════════════════════════
import { isAdmin, getCurrentUser } from "./auth.js";
import { showToast, openModal, closeModal } from "./ui.js";
import { supabase,fetchUsers, fetchContactsDb, updateContactStatusDb } from "./api.js";
export const ITEMS_PER_PAGE = 15; 
export let adminPostsPage = 1;
export let adminMessagesPage = 1;
export let adminUsersPage = 1;
export let filteredUsersCache = [];
export function getPaginationHTML(totalItems, currentPage, funcName) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return "";

  let html = `<div style="display:flex; gap:6px; justify-content:center; margin-top:16px; padding:10px;">`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="btn ${i === currentPage ? "btn-accent" : "btn-ghost"}" style="padding:6px 14px; border-radius:8px; font-weight:bold;" onclick="${funcName}(${i})">${i}</button>`;
  }
  html += `</div>`;
  return html;
}

// ════════════════════════════════════════════
//  ГОЛОВНИЙ ПЕРЕМИКАЧ АДМІНКИ
// ════════════════════════════════════════════
export function openAdminPanel() {
  if (!isAdmin()) {
    showToast("Доступ заборонено!", "error");
    return;
  }
  // Просто перенаправляємо на нову сторінку!
  window.location.href = "admin.html#admin-dashboard";
}
export function switchAdminTab(tab) {
  window.location.hash = "admin-" + tab;
  document
    .querySelectorAll(".admin-page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".admin-nav-item")
    .forEach((n) => n.classList.remove("active"));

  const page = document.getElementById("admin-" + tab);
  const navItem = document.getElementById("atab-" + tab);
  if (page) page.classList.add("active");
  if (navItem) navItem.classList.add("active");

  if (tab === "dashboard") renderAdminDashboard();
  else if (tab === "categories") renderAdminCategories();
  else if (tab === "users") {
    adminUsersPage = 1;
    renderAdminUsers();
  } else if (tab === "posts") {
    adminPostsPage = 1;
    renderAdminPosts();
  } else if (tab === "messages") {
    adminMessagesPage = 1;
    loadAdminMessages();
  }
}

export function renderAdminDashboard() {
  const rp = document.getElementById("adminRecentPosts");
  if (!rp) return;
  rp.innerHTML = `<table class="admin-table"><thead><tr><th>Заголовок</th><th>Категорія</th><th>Автор</th></tr></thead><tbody>${posts
    .slice(0, 5)
    .map(
      (p) =>
        `<tr><td>${p.title}</td><td>${p.sub}</td><td>${p.authorName}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

export function renderAdminCategories() {
  const cats = Object.entries(categoryConfig);
  const grid = document.getElementById("adminCatGrid");
  if (!grid) return;
  grid.innerHTML = cats
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

export function showCatForm() {
  document.getElementById("catFormWrap").style.display = "block";
  document.getElementById("catFormTitle").textContent = "➕ Нова категорія";
  document.getElementById("catEditKey").value = "";
  document.getElementById("catName").value = "";
  document.getElementById("catEmoji").value = "";
  document.getElementById("catDesc").value = "";
  document.getElementById("catColor").value = "";
}

export function hideCatForm() {
  document.getElementById("catFormWrap").style.display = "none";
}

export function startEditCat(key) {
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

export async function saveCat() {
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

  if (!name || !name.startsWith("r/")) {
    showToast("Назва має починатись з r/ та не бути порожньою!", "error");
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

  const { error } = await supabase
    .from("categories")
    .upsert([
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
  renderHeader();
  showToast("✅ Категорію збережено!", "success");
}

export function startDeleteCat(key, count) {
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

export async function deleteCatConfirmed() {
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

export async function submitContactForm() {
  const name = document.getElementById("contactName").value.trim();
  const email = document.getElementById("contactEmail").value.trim();
  const message = document.getElementById("contactMessage").value.trim();

  if (!name || !email || !message) {
    showToast("Будь ласка, заповніть всі поля", "error");
    return;
  }

  const result = await submitContactDb({ name, email, message });
  if (result.success) {
    showToast("✅ Повідомлення надіслано!", "success");
    document.getElementById("contactName").value = "";
    document.getElementById("contactEmail").value = "";
    document.getElementById("contactMessage").value = "";
  } else {
    showToast("Помилка при надсиланні", "error");
  }
}

// ════════════════════════════════════════════
//  АДМІН: ЗВЕРНЕННЯ (ПАКЕТНЕ ЗАВАНТАЖЕННЯ)
// ════════════════════════════════════════════
export async function loadAdminMessages() {
  adminMessagesCache = await fetchContactsDb();
  drawMessagesTable();
}

export function setAdminMessagesPage(page) {
  adminMessagesPage = page;
  drawMessagesTable();
}

export function drawMessagesTable() {
  const countEl = document.getElementById("messagesCount");
  if (countEl)
    countEl.textContent = `Всього: ${adminMessagesCache.length} звернень`;

  const statusColors = {
    new: { label: "Нове", color: "var(--blue)" },
    process: { label: "В роботі", color: "var(--yellow)" },
    closed: { label: "Закрито", color: "var(--green)" },
  };

  const tb = document.getElementById("messagesTableBody");
  if (!tb) return;

  // ✂️ ПАГІНАЦІЯ
  const start = (adminMessagesPage - 1) * ITEMS_PER_PAGE;
  const paginated = adminMessagesCache.slice(start, start + ITEMS_PER_PAGE);

  tb.innerHTML = paginated
    .map((m) => {
      const date = m.created_at
        ? new Date(m.created_at).toLocaleString("uk-UA")
        : "—";
      const currentStatus = m.status || "new";
      const s = statusColors[currentStatus];

      return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:12px;color:var(--muted);font-size:12px;white-space:nowrap">${date}</td>
        <td style="padding:12px;font-weight:600">${m.name}</td>
        <td style="padding:12px;color:var(--blue)">${m.email}</td>
        <td style="padding:12px;max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${m.message.replace(/"/g, "&quot;")}">${m.message}</td>
        <td style="padding:12px">
          <select onchange="changeMessageStatus(${m.id}, this.value)" style="background:${s.color}20; color:${s.color}; border:1px solid ${s.color}40; border-radius:12px; padding:4px 8px; font-size:12px; font-weight:700; cursor:pointer; outline:none">
            <option value="new" style="color:var(--text); background:var(--bg);" ${currentStatus === "new" ? "selected" : ""}>Нове</option>
            <option value="process" style="color:var(--text); background:var(--bg);" ${currentStatus === "process" ? "selected" : ""}>В роботі</option>
            <option value="closed" style="color:var(--text); background:var(--bg);" ${currentStatus === "closed" ? "selected" : ""}>Закрито</option>
          </select>
        </td>
        <td style="padding:12px"><button class="tbl-btn danger" onclick="deleteMessage(${m.id})" title="Видалити">🗑️</button></td>
      </tr>
    `;
    })
    .join("");

  // 🔘 Рендер кнопок пагінації
  let pagContainer = document.getElementById("adminMessagesPagination");
  if (!pagContainer) {
    pagContainer = document.createElement("div");
    pagContainer.id = "adminMessagesPagination";
    tb.closest(".admin-table-wrap").after(pagContainer);
  }
  pagContainer.innerHTML = getPaginationHTML(
    adminMessagesCache.length,
    adminMessagesPage,
    "setAdminMessagesPage",
  );
}

export async function changeMessageStatus(id, newStatus) {
  const result = await updateContactStatusDb(id, newStatus);
  if (result && result.success) {
    await loadAdminMessages();
    showToast("✅ Статус оновлено!", "success");
  } else {
    showToast("Помилка зміни статусу", "error");
  }
}

export async function deleteMessage(id) {
  if (confirm("Видалити це звернення?")) {
    const result = await deleteContactDb(id);
    if (result.success) {
      await loadAdminMessages();
      showToast("🗑️ Звернення видалено", "success");
    } else {
      showToast("Помилка видалення", "error");
    }
  }
}

// ════════════════════════════════════════════
//  АДМІН: КОРИСТУВАЧІ ТА ПОШУК
// ════════════════════════════════════════════
export async function renderAdminUsers() {
  adminUsersCache = await fetchUsers();
  filteredUsersCache = [...adminUsersCache];
  drawUsersTable();
}

export function filterAdminUsers(query) {
  const q = query.toLowerCase().trim();
  filteredUsersCache = adminUsersCache.filter(
    (u) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
  );
  adminUsersPage = 1; // Скидаємо на 1 сторінку при пошуку
  drawUsersTable();
}

export function setAdminUsersPage(page) {
  adminUsersPage = page;
  drawUsersTable();
}

export function drawUsersTable() {
  const currentU = getCurrentUser();
  const userCountEl = document.getElementById("userCount");
  if (userCountEl)
    userCountEl.textContent = `Знайдено: ${filteredUsersCache.length}`;

  const tb = document.getElementById("usersTableBody");
  if (!tb) return;

  if (filteredUsersCache.length === 0) {
    tb.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted)">Користувачів не знайдено 🕵️‍♂️</td></tr>`;
    const pag = document.getElementById("adminUsersPagination");
    if (pag) pag.innerHTML = "";
    return;
  }

  const start = (adminUsersPage - 1) * ITEMS_PER_PAGE;
  const paginated = filteredUsersCache.slice(start, start + ITEMS_PER_PAGE);

  tb.innerHTML = paginated
    .map((u) => {
      const regDate = u.created_at
        ? new Date(u.created_at).toLocaleDateString("uk-UA")
        : "—";
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
    })
    .join("");

  let pagContainer = document.getElementById("adminUsersPagination");
  if (!pagContainer) {
    pagContainer = document.createElement("div");
    pagContainer.id = "adminUsersPagination";
    tb.closest(".admin-table-wrap").after(pagContainer);
  }
  pagContainer.innerHTML = getPaginationHTML(
    filteredUsersCache.length,
    adminUsersPage,
    "setAdminUsersPage",
  );
}

export async function changeUserRole(userId, newRole) {
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

export async function deleteUser(userId) {
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

// ════════════════════════════════════════════
//  АДМІН: ВСІ ПОСТИ
// ════════════════════════════════════════════
export function setAdminPostsPage(page) {
  adminPostsPage = page;
  renderAdminPosts();
}

export function renderAdminPosts() {
  const postsCountEl = document.getElementById("postsCount");
  if (postsCountEl) postsCountEl.textContent = `Всього: ${posts.length} постів`;

  const tb = document.getElementById("postsTableBody");
  if (!tb) return;

  // ✂️ ПАГІНАЦІЯ
  const start = (adminPostsPage - 1) * ITEMS_PER_PAGE;
  const paginated = posts.slice(start, start + ITEMS_PER_PAGE);

  tb.innerHTML = paginated
    .map(
      (p) => `
 <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:12px;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.5;padding-bottom:14px" title="${p.title.replace(/"/g, "&quot;")}">
        <a href="index.html#post-${p.id}" style="color:var(--text); text-decoration:none; transition:color 0.2s" onmouseover="this.style.color='var(--blue)'" onmouseout="this.style.color='var(--text)'"><b>${p.title}</b></a>
      </td>
      <td style="padding:12px">
        <span onclick="window.location.href='index.html#category-${encodeURIComponent(p.sub)}'" style="background:${p.subColor}20; color:${p.subColor}; padding:4px 8px; border-radius:12px; font-size:12px; white-space:nowrap; cursor:pointer">${p.emoji} ${p.sub}</span>
      </td>
      <td style="padding:12px;color:var(--text)">${p.authorName}</td>
      <td style="padding:12px;font-weight:600;color:#ff4500">▲ ${p.votes}</td>
      <td style="padding:12px;color:var(--muted)">💬 ${p.comments}</td>
      <td style="padding:12px">
        <div class="table-actions" style="display:flex;gap:6px">
          <button class="tbl-btn primary" onclick="editPost(${p.id})" title="Редагувати пост">✏️</button>
          <button class="tbl-btn danger" onclick="confirmDeletePost(${p.id})" title="Видалити пост">🗑️</button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");

  // 🔘 Рендер кнопок пагінації
  let pagContainer = document.getElementById("adminPostsPagination");
  if (!pagContainer) {
    pagContainer = document.createElement("div");
    pagContainer.id = "adminPostsPagination";
    tb.closest(".admin-table-wrap").after(pagContainer);
  }
  pagContainer.innerHTML = getPaginationHTML(
    posts.length,
    adminPostsPage,
    "setAdminPostsPage",
  );
}