// ════════════════════════════════════════════
//  ІМПОРТИ З ТВОЇХ МОДУЛІВ
// ════════════════════════════════════════════
import dayjs from "dayjs";
import { supabase } from "./api.js";

// Імпортуємо функції (переконайся, що в цих файлах стоїть 'export' перед ними)
import { loadData } from "./data.js";
import { setPage, openPost, handleRoute, openUserProfile, renderProfile, goProfile } from "./pages.js";
import { renderHeader, renderFeed, renderSidebarCommunities, renderCategorySearch } from "./render.js";
import { getCurrentUser, updateStoredUser, doSignin, doSignup, doSignout, requireAuth, isAuthenticated, initAuthListener}from "./auth.js";
import { submitPost, editPost, saveEditPost, confirmDeletePost, deletePost, castVote, savePost, postComment,previewImage } from "./posts.js";
import { openAdminPanel, switchAdminTab, changeUserRole, deleteUser, saveCat, deleteCatConfirmed, startDeleteCat, startEditCat, showCatForm, hideCatForm,submitContactForm,deleteMessage, changeMessageStatus, filterAdminUsers, setAdminUsersPage, setAdminPostsPage, setAdminMessagesPage } from "./admin.js";
import { showToast, openModal, closeModal, closeIfOverlay, shareProfile, toggleDropdown, closeDropdown,sharePost, filterByCategory, setSort, handleSearch, toggleJoin, toggleJoinCategory, togglePassword} from "./ui.js";

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

window.addEventListener("hashchange", handleRoute);

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
window.renderSidebarCommunities = renderSidebarCommunities;
window.changeUserRole = changeUserRole;
window.deleteUser = deleteUser;
window.filterByCategory = filterByCategory;
window.setSort = setSort;
window.renderProfile = renderProfile;
window.goProfile = goProfile;
window.handleSearch = handleSearch;
window.toggleJoin = toggleJoin;
window.togglePassword = togglePassword;
// ════════════════════════════════════════════
//  ІНІЦІАЛІЗАЦІЯ ПРОЄКТУ
// ════════════════════════════════════════════
//
async function initApp() {
  console.log("🚀 Запуск завантаження бази даних...");
  
  try {
    // База завантажиться лише ОДИН раз
    await loadData(); 
    console.log("✅ Дані завантажено!");

    const catSearchInput = document.getElementById("catSearchInput");
    if (catSearchInput) {
      renderCategorySearch();
      catSearchInput.addEventListener("input", renderCategorySearch);
    }
    renderHeader();
  } catch (err) {
    console.error("❌ Помилка ініціалізації:", err);
  } finally {
    const loader = document.getElementById("globalLoader");
    if (loader) loader.classList.add("hidden");
  }

  // Роутинг
  if (window.location.hash) {
    await handleRoute();
  } else {
    setPage("home");
  }
}

// 🛑 ФІКС 3: Ідеальний контроль запуску!
initAuthListener(
  (user) => {
    // Ця частина малює шапку при кожній зміні юзера (вхід/вихід)
    renderHeader();
    renderSidebarCommunities();
  },
  () => {
    // Ця частина запускає сайт ТІЛЬКИ ОДИН РАЗ, коли Supabase повністю готовий!
    initApp();
    window.addEventListener("hashchange", handleRoute);
  }
);