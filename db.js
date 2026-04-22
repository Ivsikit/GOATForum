import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bxiibpkbgnenttfhkkqt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tMOMoO4rQ8ZTYv8jJAD9XA_HraLR_lK";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Функція: Отримати всі категорії
export async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("*");
  if (error) console.error("Помилка категорій:", error);
  return data || [];
}

// 3. Функція: Отримати всі пости
export async function fetchPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) console.error("Помилка постів:", error);
  return data || [];
}

// 4. Функція: Створити новий пост
export async function createPostDb(postData) {
  const { error } = await supabase.from("posts").insert([postData]);
  return { success: !error, error };
}

// 5. Функція: Оновити пост
export async function updatePostDb(id, updateData) {
  const { error } = await supabase
    .from("posts")
    .update(updateData)
    .eq("id", id);
  return { success: !error, error };
}

// 6. Функція: Видалити пост
export async function deletePostDb(id) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  return { success: !error, error };
}
// 7. Функція: Реєстрація користувача
export async function registerUserDb(name, email, password) {
  // Спочатку перевіряємо, чи немає вже такого email
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing)
    return { success: false, message: "Користувач з таким email вже існує" };

  // Додаємо нового користувача
  const { data, error } = await supabase
    .from("users")
    .insert([
      {
        name: name,
        email: email,
        password: password, // У реальних проєктах тут має бути хеш, але для прототипу залишаємо так
        role: "user",
        is_admin: false,
        karma: 1,
        contributions: 0,
      },
    ])
    .select()
    .single();

  if (error) return { success: false, message: "Помилка бази даних" };
  return { success: true, user: data };
}

// 8. Функція: Авторизація (Вхід)
export async function loginUserDb(email, password) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("password", password)
    .maybeSingle(); // Шукаємо один запис, де збігаються email та пароль

  if (error || !data)
    return { success: false, message: "Неправильний email або пароль" };
  return { success: true, user: data };
}

// 9. Функція: Отримати всіх користувачів (для Адмін-панелі)
export async function fetchUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) console.error("Помилка користувачів:", error);
  return data || [];
}
// 10. Отримати коментарі для конкретного поста
export async function fetchCommentsDb(postId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Помилка завантаження коментарів:", error);
    return [];
  }
  return data;
}

// 11. Створити новий коментар
export async function createCommentDb(commentData) {
  const { error } = await supabase.from("comments").insert([commentData]);
  return { success: !error, error };
}
