function createCard(post) {
return`
<article class="card-item">
<img class="card-item_image" src="${post.image}" alt="${post.title}" />
<h4 class="card-item_title">${post.title}</h4>
<p class="card-item_description">${post.description}</p>
<span class="card-item_tag">${post.category}</span>
</article>
`;
}
const cardsContainer = document.querySelector(".cards");

cardsContainer.innerHTML = posts
.map((post) => createCard(post))
.join("");
async function loadPosts() {
  const response = await fetch("./data/posts.json");
  const posts = await response.json();

  const cardsContainer = document.querySelector(".cards");
  cardsContainer.innerHTML = posts.map((post) => createCard(post)).join("");
}

loadPosts();