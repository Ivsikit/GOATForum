// ════════════════════════════════════════════
//  POSTS — CRUD, коментарі, голосування, зображення
// ════════════════════════════════════════════
import { deletePostDb, toggleSavePostDb, createPostDb, updatePostDb, createCommentDb, uploadPostImage } from "./api.js";
import { loadData } from "./data.js";
import { requireAuth, getCurrentUser, updateStoredUser} from "./auth.js";
import { openModal, closeModal, closeIfOverlay, showToast } from "./ui.js";
import { renderHeader, renderFeed } from "./render.js";
import { openPost, setPage, renderProfile } from "./pages.js";
let _pendingDeleteId = null;
export async function submitPost() {
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

  // Завантаження зображення
  let imageUrl = null;
  const imageInput = document.getElementById("postImage");
  if (imageInput && imageInput.files && imageInput.files[0]) {
    showToast("Завантаження зображення…");
    imageUrl = await uploadPostImage(imageInput.files[0]);
    if (!imageUrl) {
      showToast("Помилка завантаження зображення!", "error");
      return;
    }
  }

  const result = await createPostDb({
    author_id: user.id,
    author_name: user.name,
    sub: cat,
    title: title,
    body: body || "",
    image_url: imageUrl,
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

  // Очищаємо форму
  document.getElementById("postTitle").value = "";
  document.getElementById("postBody").value = "";
  if (imageInput) imageInput.value = "";

  const imgPreview = document.getElementById("imagePreview");
  if (imgPreview) {
    imgPreview.style.display = "none";
    imgPreview.src = "";
  }

  closeModal("createPostOverlay");
  renderHeader();

  // 🛑 РОЗУМНЕ ОНОВЛЕННЯ СТРІЧКИ (ОСЬ НАШЕ ВИПРАВЛЕННЯ!)
  if (currentCategory) {
    // Якщо ми в категорії, малюємо ТІЛЬКИ її пости
    renderFeed(posts.filter((p) => p.sub === currentCategory));
  } else if (window.location.pathname.toLowerCase().includes("popular.html")) {
    // Якщо в популярному — зберігаємо сортування
    const sortedPosts = [...posts].sort((a, b) => b.votes - a.votes);
    renderFeed(sortedPosts);
  } else {
    // Звичайна головна стрічка
    renderFeed();
  }

  showToast("✅ Пост опубліковано! +5 карми", "success");
}

export function editPost (id) {
  if (!requireAuth()) return;
  const p = posts.find((x) => x.id === id);
  if (!p) return;

  let overlay = document.getElementById("editPostOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "editPostOverlay";
    overlay.onclick = (e) => closeIfOverlay(e, "editPostOverlay");
    document.body.appendChild(overlay);
  }

  // 🖼️ Готуємо блок попереднього перегляду поточного фото
  const currentImageHtml = p.image_url
    ? `<div style="margin-bottom: 12px;">
         <label style="display:block; font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Поточне фото:</label>
         <img src="${p.image_url}" style="width:100%; max-height:180px; object-fit:cover; border-radius:8px; border:1px solid var(--border);" />
       </div>`
    : `<div style="margin-bottom: 12px; padding: 15px; background: var(--bg); border: 1px dashed var(--border); border-radius: 8px; text-align: center; color: var(--muted); font-size: 13px;">
         📷 Фото ще не додано
       </div>`;

  overlay.innerHTML = `
    <div class="modal" style="max-width: 540px" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeModal('editPostOverlay')">✕</button>
      <h2>✏️ Редагувати пост</h2>
      
      <div class="form-field">
        <label>Заголовок</label>
        <input type="text" id="editPostTitle" value="${p.title.replace(/"/g, "&quot;")}" maxlength="100" />
      </div>
      
      <div class="form-field">
        <label>Текст</label>
        <textarea id="editPostBody" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font-body);font-size:14px;padding:10px;resize:vertical;min-height:120px;outline:none">${p.body || ""}</textarea>
      </div>

      ${currentImageHtml}

      <div class="form-field">
        <label>Замінити зображення (необов'язково)</label>
        <input type="file" id="editPostImage" accept="image/*" 
          style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer" />
        <span class="field-hint" style="color:var(--muted); font-size:11px; margin-top:4px; display:block;">
          Виберіть новий файл, щоб оновити фото, або залиште порожнім.
        </span>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button class="btn btn-ghost" style="border-radius:8px" onclick="closeModal('editPostOverlay')">Скасувати</button>
        <button class="btn btn-accent" style="border-radius:8px;padding:8px 24px" onclick="saveEditPost(${p.id})">Зберегти зміни</button>
      </div>
    </div>
  `;

  setTimeout(() => overlay.classList.add("open"), 10);
};
export async function saveEditPost (id) {
  const title = document.getElementById("editPostTitle").value.trim();
  const body = document.getElementById("editPostBody").value.trim();
  const imageInput = document.getElementById("editPostImage");

  if (!title) {
    showToast("Заголовок не може бути порожнім!", "error");
    return;
  }

  showToast("⏳ Збереження змін...", "info");

  let updateData = { title: title, body: body };

  // 📸 МАГІЯ ФОТО: Перевіряємо, чи вибрав користувач новий файл
  if (imageInput.files && imageInput.files.length > 0) {
    const file = imageInput.files[0];
    showToast("⏳ Завантаження нового фото...", "info");

    // Завантажуємо фото у Supabase (функція вже є у твоєму db.js)
    const imageUrl = await uploadPostImage(file);

    if (imageUrl) {
      updateData.image_url = imageUrl; // Додаємо нове посилання до оновлення
    } else {
      showToast("❌ Помилка завантаження фото", "error");
      return;
    }
  }

  // Відправляємо оновлені дані в базу
  const result = await updatePostDb(id, updateData);

  if (result.success) {
    closeModal("editPostOverlay");
    showToast("✅ Пост успішно оновлено!", "success");

    // Перезавантажуємо сторінку, щоб всі зміни миттєво з'явилися на екрані
    setTimeout(() => window.location.reload(), 1000);
  } else {
    showToast("❌ Помилка при оновленні", "error");
  }
};
export function confirmDeletePost(id) {
  _pendingDeleteId = id;
  openModal("deleteConfirmOverlay");
}

export async function deletePost() {
  const id = _pendingDeleteId;
  if (id == null) return;

  // Тимчасово показуємо статус
  showToast("Видалення...", "info");

  const result = await deletePostDb(id);
  closeModal("deleteConfirmOverlay");
  _pendingDeleteId = null;

  if (result.success) {
    await loadData();

    const pagePost = document.getElementById("page-post");
    if (pagePost && pagePost.classList.contains("active")) {
      setPage("home");
    } else {
      // Відновлюємо правильне сортування для сторінки Популярне
      if (window.location.pathname.toLowerCase().includes("popular.html")) {
        const sortedPosts = [...posts].sort((a, b) => b.votes - a.votes);
        renderFeed(sortedPosts);
      } else {
        renderFeed();
      }
    }
    showToast("✅ Пост видалено", "success");
  } else {
    showToast("❌ Помилка видалення! (Можливо, є коментарі)", "error");
  }
}


// ── Коментарі та голосування ──────────────────────────────
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


// ── Прев'ю зображення ────────────────────────────────────
export function previewImage(input) {
  const preview = document.getElementById("imagePreview");
  if (!preview) return;

  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast("Файл занадто великий! Максимум 5 МБ", "error");
      input.value = "";
      preview.style.display = "none";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = "none";
  }
}
window.previewImage = previewImage;