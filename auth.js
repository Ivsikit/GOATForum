import { supabase } from "./api.js";
import { showToast, closeModal, openModal } from "./ui.js";

let currentUser = null;

export function getCurrentUser() {
  if (currentUser) return currentUser;
  const stored = localStorage.getItem("goat_user");
  return stored ? JSON.parse(stored) : null;
}

export function isAuthenticated() {
  return getCurrentUser() !== null;
}

export function isAdmin() {
  const u = getCurrentUser();
  return u && (u.role === "admin" || u.role === "superadmin");
}

export function requireAuth() {
  if (!getCurrentUser()) {
    showToast("⚠️ Увійдіть або зареєструйтесь", "error");
    openModal("loginOverlay");
    return false;
  }
  return true;
}

// 🛑 ФІКС 1: Тільки локальне збереження. ЖОДНИХ мережевих запитів!
export function updateStoredUser(userObj) {
  currentUser = userObj;
  if (userObj) {
    localStorage.setItem("goat_user", JSON.stringify(userObj));
  } else {
    localStorage.removeItem("goat_user");
  }
}

// 🛑 НОВА ФУНКЦІЯ: Синхронізує підписки ТІЛЬКИ коли юзер натискає "Приєднатись"
export async function syncUserSubs(joinedSubs) {
  await supabase.auth.updateUser({
    data: { joinedSubs: joinedSubs }
  });
}

let isAuthInitialized = false;

// 🛑 ФІКС 2: Безпечний слухач без блокування
export function initAuthListener(onUserChange, onReady) {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log("🔐 [AUTH] Подія:", event);

    if (session?.user) {
      let userObj = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || "Користувач",
        role: session.user.user_metadata?.role || "user",
        joinedSubs: session.user.user_metadata?.joinedSubs || [],
        savedPosts: session.user.user_metadata?.savedPosts || [],
        is_admin: false,
        karma: 0
      };

      // Оновлюємо UI миттєво
      updateStoredUser(userObj);
      if (onUserChange) onUserChange(userObj);

      // Якщо це старт сайту - даємо зелене світло для loadData
      if (!isAuthInitialized) {
        isAuthInitialized = true;
        if (onReady) onReady();
      }

      // АСИНХРОННО (без await) підтягуємо права з бази, щоб не зупиняти сайт
      supabase
        .from('users')
        .select('role, is_admin, karma, contributions')
        .eq('auth_id', session.user.id)
        .maybeSingle()
        .then(({ data: dbUser }) => {
          if (dbUser) {
            userObj.role = dbUser.role;
            userObj.is_admin = dbUser.is_admin;
            userObj.karma = dbUser.karma;
            userObj.contributions = dbUser.contributions;
            updateStoredUser(userObj);
            if (onUserChange) onUserChange(userObj);
          }
        });

    } else {
      updateStoredUser(null);
      if (onUserChange) onUserChange(null);
      if (!isAuthInitialized) {
        isAuthInitialized = true;
        if (onReady) onReady();
      }
    }
  });
}

export async function doSignup() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  if (!name || !email || password.length < 8) {
    showToast("Перевірте дані (пароль мін. 8 симв.)", "error");
    return;
  }
  const { error } = await supabase.auth.signUp({
    email, password, options: { data: { name, role: 'user' } }
  });
  if (!error) {
    closeModal("registerOverlay");
    showToast("✅ Реєстрація успішна!", "success");
  }
}

export async function doSignin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showToast("❌ Невірний вхід", "error");
  } else {
    closeModal("loginOverlay");
    showToast("✅ Вітаємо!", "success");
  }
}

export async function doSignout() {
  await supabase.auth.signOut();
  showToast("👋 Бувай!");
  setTimeout(() => window.location.href = "index.html", 500);
}