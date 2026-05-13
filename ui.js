// ════════════════════════════════════════════
//  UI — dropdown, пошук, сортування, модалки, toast, утиліти
// ════════════════════════════════════════════
import { getCurrentUser, updateStoredUser, requireAuth, doSignin, doSignup } from "./auth.js";


import { renderSidebarCommunities, renderHeader, renderFeed } from "./render.js";
import { setPage } from "./pages.js";
let toastTimer;
export function toggleDropdown() {
  const dd = document.getElementById("avatarDropdown");
  if (dd) dd.classList.toggle("open");
}
export function closeDropdown() {
  const dd = document.getElementById("avatarDropdown");
  if (dd) dd.classList.remove("open");
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".avatar-wrap")) closeDropdown();
});













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
//
// Глобальний масив кольорів у тебе вже є, просто додай функцію під ним:
export function getUserColor(name) {
  if (!name) return avatarColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
}
// Шукає посилання в тексті і робить їх клікабельними + додає попередження
export function linkify(text) {
  if (!text) return "";

  // 1. Захист від шкідливого коду
  let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2. Пошук посилань
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // 3. Обгортаємо в тег <a> і додаємо попередження
  return safeText.replace(urlRegex, function (url) {
    // Текст вашого попередження:
    const warningMsg =
      "Увага! Це посилання переносить вас за межі GOAT Forum і може бути небезпечним.\\n\\nВи впевнені, що хочете перейти?";

    // Додаємо onclick="return confirm(...)"
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--blue); text-decoration: underline;" onclick="return confirm('${warningMsg}')">${url}</a>`;
  });
}
//
export function toggleJoinCategory(cat, btn) {
  if (!requireAuth()) return;
  const user = getCurrentUser();
  if (!user.joinedSubs) user.joinedSubs = [];

  const index = user.joinedSubs.indexOf(cat);
  if (index === -1) {
    user.joinedSubs.push(cat);
    btn.classList.remove("btn-accent");
    btn.classList.add("btn-ghost", "joined");
    btn.textContent = "Вийти";
  } else {
    user.joinedSubs.splice(index, 1);
    btn.classList.remove("btn-ghost", "joined");
    btn.classList.add("btn-accent");
    btn.textContent = "Приєднатись";
  }

  updateStoredUser(user);
  renderSidebarCommunities(); 

  // 🛑 ФІКС: Миттєво оновлюємо стрічку після підписки/відписки
setTimeout(() => {
    const activeSort = document.querySelector(".sort-btn.active");
    if (activeSort) activeSort.click();
  }, 10);
}

//

export function handleSearch(q) {
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

export function filterByCategory(cat) {
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

  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  const pageHome = document.getElementById("page-home");
  if (pageHome) pageHome.classList.add("active");

  window.scrollTo(0, 0);

  // Рендеримо тільки пости цієї категорії
  renderFeed(posts.filter((p) => p.sub === cat));
}
export function setSort(btn, type) {
  const btnContainer = btn.parentElement;
  if (btnContainer) {
    btnContainer.querySelectorAll(".sort-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }

  const path = window.location.pathname;
  const isHome = path.includes("index.html") || path === "/";
  const user = getCurrentUser();

  // 🛑 ФІКС 3: Завжди надійно витягуємо глобальні змінні
  const cat = window.currentCategory;
  const allPosts = window.posts || [];
  let basePosts = [];

  if (cat) {
    basePosts = allPosts.filter((p) => p.sub === cat);
  } else if (isHome && !path.includes("popular")) {
    const joined = user?.joinedSubs || [];
    basePosts = allPosts.filter((p) => joined.includes(p.sub));
  } else {
    basePosts = [...allPosts];
  }

  if (type === "best") {
    basePosts.sort((a, b) => (b.votes + b.comments * 2) - (a.votes + a.comments * 2));
  } else if (type === "new") {
    basePosts.sort((a, b) => new Date(b.time) - new Date(a.time));
  } else if (type === "top") {
    basePosts.sort((a, b) => b.votes - a.votes);
  } else if (type === "hot") {
    basePosts.sort((a, b) => b.comments - a.comments);
  }

  renderFeed(basePosts);
}

export function fmtNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "K" : n;
}
export function sharePost(id) {
  // Формуємо чисте посилання: базовий домен + шлях + потрібний хеш
  const cleanUrl =
    window.location.origin + window.location.pathname + "#post-" + id;

  // Копіюємо в буфер обміну
  navigator.clipboard
    ?.writeText(cleanUrl)
    .then(() => showToast("🔗 Посилання скопійовано!", "success"))
    .catch(() => showToast("❌ Не вдалося скопіювати", "error"));
}

export function shareProfile() {
  const cleanUrl =
    window.location.origin + window.location.pathname + "#profile";

  navigator.clipboard
    ?.writeText(cleanUrl)
    .then(() => showToast("🔗 Посилання скопійовано!", "success"))
    .catch(() => showToast("❌ Не вдалося скопіювати", "error"));
}
export function toggleJoin(btn) {
  if (!requireAuth()) return;
  const user = getCurrentUser();
  // Отримуємо назву спільноти з сусіднього елемента
  const communityName = btn
    .closest(".community-row")
    .querySelector(".community-name").textContent;

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
  setTimeout(() => {
    const activeSort = document.querySelector(".sort-btn.active");
    if (activeSort) activeSort.click();
  }, 10);
}
export function openModal(id) {
  document.getElementById(id).classList.add("open");
}
export function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
export function closeIfOverlay(e, id) {
  if (e.target.id === id) closeModal(id);
}
export function switchToRegister() {
  closeModal("loginOverlay");
  openModal("registerOverlay");
}
export function switchToLogin() {
  closeModal("registerOverlay");
  openModal("loginOverlay");
}

export function showToast(msg, type = "") {
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