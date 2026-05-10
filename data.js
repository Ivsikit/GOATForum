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

// ════════════════════════════════════════════
//  ПОСТИ (CREATE / EDIT / DELETE)
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  ПОСТИ (CREATE / EDIT / DELETE)
// ════════════════════════════════════════════