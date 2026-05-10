// ════════════════════════════════════════════
//  UI — dropdown, пошук, сортування, модалки, toast, утиліти
// ════════════════════════════════════════════

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

export async function doSignin() {
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

export async function doSignup() {
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

export function doSignout() {
  signout();
  renderHeader();
  renderFeed();
  setPage("home");
  showToast("До побачення!");
}
export function requireAuth() {
  if (!isAuthenticated()) {
    openModal("loginOverlay");
    return false;
  }
  return true;
}

export async function postComment(postId) {
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

export function castVote(id, dir) {
  if (!requireAuth()) return;
  voteMap[id] = voteMap[id] === dir ? 0 : dir;
  renderFeed();
}
export async function savePost(id, btn) {
  if (!requireAuth()) return;
  const user = getCurrentUser();

  const result = await toggleSavePostDb(user.id, id);

  if (!user.savedPosts) user.savedPosts = [];

  if (result.action === "added") {
    user.savedPosts.push(id);
    showToast("🔖 Збережено!", "success");
    // 🎨 Миттєво фарбуємо кнопку в синій колір
    if (btn) {
      btn.innerHTML = "🔖 Збережено";
      btn.style.color = "var(--green)";
    }
  } else {
    user.savedPosts = user.savedPosts.filter((postId) => postId !== id);
    showToast("🔖 Видалено зі збереженого", "info");
    // 🎨 Повертаємо кнопці стандартний вигляд
    if (btn) {
      btn.innerHTML = "🔖 Зберегти";
      btn.style.color = "";
    }
  }

  updateStoredUser(user);

  // Якщо ми в профілі на вкладці збереженого — перемальовуємо список
  if (
    document.getElementById("page-profile")?.classList.contains("active") &&
    profileTab === "saved"
  ) {
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
  renderSidebarCommunities(); // Оновлює ваш список справа
}
// Функція, яка бере ім'я і завжди повертає для нього один і той самий колір
export function getUserColor(name) {
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
  document
    .querySelectorAll(".sort-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  // Якщо відкрита категорія — сортуємо тільки її пости, інакше сортуємо всі
  const basePosts = currentCategory
    ? posts.filter((p) => p.sub === currentCategory)
    : [...posts];

  if (type === "hot") {
    basePosts.sort((a, b) => b.comments - a.comments);
  } else if (type === "new") {
    basePosts.sort((a, b) => b.timestamp - a.timestamp);
  } else if (type === "top") {
    basePosts.sort((a, b) => b.votes - a.votes);
  } else if (type === "best" || !type) {
    basePosts.sort((a, b) => b.votes + b.comments - (a.votes + a.comments));
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