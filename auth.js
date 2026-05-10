// ════════════════════════════════════════════
//  AUTH — сесія, вхід, реєстрація, вихід, профіль, хедер
// ════════════════════════════════════════════

export function setCurrentUser(u) {
  localStorage.setItem("goat_currentUser", JSON.stringify(u));
}
export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("goat_currentUser"));
  } catch {
    return null;
  }
}
export function isAuthenticated() {
  return Boolean(getCurrentUser());
}
export function isAdmin() {
  const u = getCurrentUser();
  return (
    u && (u.is_admin === true || u.isAdmin === true || u.role === "superadmin")
  );
}

export function signout() {
  localStorage.removeItem("goat_currentUser");
}
export function updateStoredUser(user) {
  setCurrentUser(user);
}
export function getAuthorName(post) {
  return post.authorName || "Невідомий";
}
export function saveCategories(obj) {
  localStorage.setItem("goat_categories", JSON.stringify(obj));
}

// ════════════════════════════════════════════
//  SUPABASE СИНХРОНІЗАЦІЯ
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  SUPABASE СИНХРОНІЗАЦІЯ
// ════════════════════════════════════════════
export async function loadData() {
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
      image_url: p.image_url || null,
      timestamp: new Date(p.created_at).getTime(), // <-- Наш маркер для точного сортування
    };
  });
}

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