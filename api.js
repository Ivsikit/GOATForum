import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bxiibpkbgnenttfhkkqt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tMOMoO4rQ8ZTYv8jJAD9XA_HraLR_lK";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Функція: Отримати всі категорії
export async function fetchCategories() {
  console.log("📡 [API] Надсилаємо запит до таблиці categories...");
  const response = await supabase.from("categories").select("*");
  console.log("📡 [API] Відповідь categories отримано:", response);
  
  if (response.error) console.error("Помилка категорій:", response.error);
  return response.data || [];
}
// 3. Функція: Отримати всі пости
export async function fetchPosts() {
  console.log("📡 [API] Надсилаємо запит до таблиці posts...");
  const response = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });
  console.log("📡 [API] Відповідь posts отримано:", response);
  
  if (response.error) console.error("Помилка постів:", response.error);
  return response.data || [];
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
// Отримати всі коментарі конкретного користувача
export async function fetchUserCommentsDb(userId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Помилка завантаження коментарів користувача:", error);
    return [];
  }
  return data || [];
}
// Зберегти нове звернення
export async function submitContactDb(data) {
  const { error } = await supabase.from("contacts").insert([data]);
  return { success: !error, error };
}

export async function fetchContactsDb() {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function deleteContactDb(id) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  return { success: !error, error };
}
export async function updateContactStatusDb(id, status) {
  const { error } = await supabase
    .from("contacts")
    .update({ status })
    .eq("id", id);
  return { success: !error, error };
}
// Завантаження фото у сховище
export async function uploadPostImage(file) {
  // Створюємо унікальне ім'я файлу, щоб вони не перезаписувались
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { data, error } = await supabase.storage
    .from("post-images")
    .upload(filePath, file);

  if (error) {
    console.error("Помилка завантаження файлу:", error);
    return null;
  }

  // Отримуємо публічне посилання на файл
  const { data: urlData } = supabase.storage
    .from("post-images")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
export async function fetchSavedPostsIds(userId) {
  const { data, error } = await supabase
    .from("saved_posts")
    .select("post_id")
    .eq("user_id", userId);

  if (error) return [];
  return data.map((item) => item.post_id);
}

// Перемкнути статус збереження (додати/видалити)
export async function toggleSavePostDb(userId, postId) {
  // Перевіряємо, чи вже є такий запис
  const { data } = await supabase
    .from("saved_posts")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .single();

  if (data) {
    // Якщо є — видаляємо
    await supabase.from("saved_posts").delete().eq("id", data.id);
    return { action: "removed" };
  } else {
    // Якщо немає — створюємо
    await supabase
      .from("saved_posts")
      .insert([{ user_id: userId, post_id: postId }]);
    return { action: "added" };
  }
}
