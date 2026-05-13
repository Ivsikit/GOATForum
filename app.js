// ════════════════════════════════════════════
//  ІМПОРТИ З ТВОЇХ МОДУЛІВ
// ════════════════════════════════════════════
import dayjs from "dayjs";
import { supabase } from "./api.js";

// Імпортуємо функції (переконайся, що в цих файлах стоїть 'export' перед ними)
import { loadData } from "./data.js";
import { setPage, openPost, handleRoute, openUserProfile } from "./pages.js";
import { renderHeader, renderFeed, renderSidebarCommunities } from "./render.js";
import { getCurrentUser, setCurrentUser, doSignin, doSignup, doSignout, requireAuth } from "./auth.js";
import { submitPost, editPost, saveEditPost, confirmDeletePost, deletePost, castVote, savePost, postComment,previewImage } from "./posts.js";
import { openAdminPanel, switchAdminTab, changeUserRole, deleteUser, saveCat, deleteCatConfirmed, startDeleteCat, startEditCat, showCatForm, hideCatForm,submitContactForm,deleteMessage, changeMessageStatus, filterAdminUsers, setAdminUsersPage, setAdminPostsPage, setAdminMessagesPage } from "./admin.js";
import { showToast, openModal, closeModal, closeIfOverlay, shareProfile,toggleDropdown, closeDropdown,sharePost,toggleJoinCategory, filterByCategory } from "./ui.js";

// ════════════════════════════════════════════
//  ГЛОБАЛЬНИЙ СТАН (Доступний у всіх файлах)
// ════════════════════════════════════════════
window.posts = [];
window.categoryConfig = {};
window.voteMap = {};
window.postComments = {};
window.adminUsersCache = [];
window.adminMessagesCache = [];
window.currentPostId = null;
window.currentCategory = null;

// ════════════════════════════════════════════
//  ІНІЦІАЛІЗАЦІЯ ПРОЄКТУ
// ════════════════════════════════════════════
async function initApp() {
  console.log("GOAT Forum ініціалізація...");
  
  // 1. Завантажуємо категорії та пости з бази
  await loadData(); 
  
  // 2. Малюємо шапку (вхід/профіль)
  renderHeader();

  // 3. Ховаємо лоадер, якщо він є
  const loader = document.getElementById("globalLoader");
  if (loader) loader.classList.add("hidden");

  // 4. Перевіряємо адресу (роутинг)
  const path = window.location.pathname.toLowerCase();
  
  // Якщо ми в адмінці без хешу - ставимо дашборд
  if (path.includes("admin.html") && !window.location.hash) {
    window.location.hash = "#admin-dashboard";
  }

  if (window.location.hash) {
    await handleRoute();
  } else {
    // Логіка для головних сторінок
    if (path.includes("popular")) {
      const sorted = [...window.posts].sort((a, b) => b.votes - a.votes);
      renderFeed(sorted);
    } else if (!path.includes("admin") && !path.includes("categor")) {
      setPage("home");
    }
  }
}

// Запуск при завантаженні сторінки
initApp();

// Дозволяємо кнопкам "Назад/Вперед" у браузері працювати
window.addEventListener("hashchange", handleRoute);

// ════════════════════════════════════════════
//  ЕКСПОРТ ДЛЯ HTML (Window Mapping)
// ════════════════════════════════════════════
// Тепер твої onclick="setPage(...)" у HTML знову запрацюють!

window.setPage = setPage;
window.openPost = openPost;
window.renderFeed = renderFeed;
window.renderSidebarCommunities = renderSidebarCommunities;

window.doSignin = doSignin;
window.doSignup = doSignup;
window.doSignout = doSignout;
window.toggleDropdown = toggleDropdown;
window.closeDropdown = closeDropdown;

window.submitPost = submitPost;
window.editPost = editPost;
window.saveEditPost = saveEditPost;
window.confirmDeletePost = confirmDeletePost;
window.deletePost = deletePost;
window.castVote = castVote;
window.savePost = savePost;
window.sharePost = sharePost;
window.postComment = postComment;

window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeIfOverlay = closeIfOverlay;
window.previewImage = previewImage;
window.shareProfile = shareProfile;
window.openAdminPanel = openAdminPanel;
window.switchAdminTab = switchAdminTab;
window.saveCat = saveCat;
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
window.changeUserRole = changeUserRole;
window.deleteUser = deleteUser;
window.filterByCategory = filterByCategory;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Охоронець (Service Worker) успішно зареєстрований!');
      })
      .catch((error) => {
        console.log('❌ Помилка реєстрації Service Worker:', error);
      });
  });
}