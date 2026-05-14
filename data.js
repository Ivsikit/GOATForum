import dayjs from "dayjs";
import {
  supabase, fetchCategories, fetchPosts, createPostDb, updatePostDb,
  deletePostDb, uploadPostImage, fetchSavedPostsIds, toggleSavePostDb,
} from "./api.js";

// ════════════════════════════════════════════
//  DATA — завантаження даних, категорії, автор
// ════════════════════════════════════════════

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

//
export async function loadData() {
  console.log("🛠️ [DATA] loadData() стартувала!");

  console.log("🛠️ [DATA] Чекаємо на fetchCategories...");
  const catData = await fetchCategories();
  console.log("🛠️ [DATA] Категорії успішно завантажено. Кількість:", catData.length);

  window.categoryConfig = {};
  catData.forEach((c) => {
    window.categoryConfig[c.name] = {
      emoji: c.emoji,
      color: c.color,
      desc: c.description,
      flair: [c.flair_label, c.flair_class],
    };
  });

  console.log("🛠️ [DATA] Чекаємо на fetchPosts...");
  const postData = await fetchPosts();
  console.log("🛠️ [DATA] Пости успішно завантажено. Кількість:", postData.length);

  window.posts = postData.map((p) => {
    const cat = window.categoryConfig[p.sub] || {
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
      timestamp: new Date(p.created_at).getTime(),
    };
  });
  
  console.log("🛠️ [DATA] loadData() повністю завершила роботу!");
}