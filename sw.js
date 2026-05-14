// Піднімаємо версію кешу, щоб браузер оновив Охоронця
const CACHE_NAME = 'goat-forum-cache-v4'; 

// 🎮 КОД НАШОЇ ОФЛАЙН-ГРИ (HTML + CSS + JS)
const OFFLINE_GAME_HTML = `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Немає інтернету - GOAT Runner</title>
  <style>
    body { margin: 0; background: #0d1117; color: #e6edf3; font-family: 'DM Sans', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden; user-select: none; }
    h1 { margin-bottom: 5px; font-family: 'Syne', sans-serif; }
    p { color: #8b949e; margin-bottom: 40px; text-align: center;}
    #gameArea { width: 600px; max-width: 90vw; height: 200px; border-bottom: 2px solid #30363d; position: relative; overflow: hidden; cursor: pointer; border-radius: 8px 8px 0 0; background: #161b22; }
    #score { position: absolute; top: 15px; right: 20px; font-size: 20px; font-weight: bold; font-family: monospace; color: #8b949e; z-index: 10; }
    #goat { 
  font-size: 45px; 
  position: absolute; 
  bottom: 0; 
  left: 40px; 
  z-index: 2; 
  transform: scaleX(-1); 
}
    #obstacle { font-size: 35px; position: absolute; bottom: 0; right: -50px; z-index: 1; }
    
    .jump { animation: jumpAnim 0.5s ease-out; }
    .move { animation: moveAnim 1.5s linear infinite; }
    
    @keyframes jumpAnim {
      0% { bottom: 0; }
      45% { bottom: 110px; }
      55% { bottom: 110px; }
      100% { bottom: 0; }
    }
    @keyframes moveAnim {
      0% { right: -50px; }
      100% { right: 100%; }
    }

    #overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(13, 17, 23, 0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 20; backdrop-filter: blur(2px); }
    button { background: #58a6ff; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: bold; margin-top: 15px; transition: 0.2s; }
    button:hover { background: #1f6feb; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <h1>Офлайн режим</h1>
  <p>З'єднання втрачено. Але поки чекаєш — допоможи козлику!<br><span style="font-size:12px; opacity:0.7">Натисни пробіл або тапни по екрану</span></p>
  
  <div id="gameArea">
    <div id="score">00000</div>
    <div id="goat">🐐</div>
    <div id="obstacle">🪨</div>
    
    <div id="overlay">
      <h2 id="msg" style="margin:0; font-family:'Syne', sans-serif; font-size: 28px;">GOAT RUNNER</h2>
      <button id="startBtn">Грати</button>
    </div>
  </div>

  <script>
    const goat = document.getElementById('goat');
    const obstacle = document.getElementById('obstacle');
    const scoreDisplay = document.getElementById('score');
    const overlay = document.getElementById('overlay');
    const startBtn = document.getElementById('startBtn');
    const msg = document.getElementById('msg');
    const gameArea = document.getElementById('gameArea');

    let isJumping = false;
    let isGameOver = true;
    let score = 0;
    let gameLoop, scoreInterval;

    function jump() {
      if (isGameOver || isJumping) return;
      isJumping = true;
      goat.classList.add('jump');
      setTimeout(() => {
        goat.classList.remove('jump');
        isJumping = false;
      }, 500);
    }

    function startGame(e) {
      if (e) e.stopPropagation();
      isGameOver = false;
      score = 0;
      scoreDisplay.innerText = '00000';
      overlay.classList.add('hidden');
      
      obstacle.classList.remove('move');
      void obstacle.offsetWidth; // Магія для перезапуску анімації
      obstacle.style.animationDuration = '1.5s';
      obstacle.classList.add('move');

      if (gameLoop) clearInterval(gameLoop);
      if (scoreInterval) clearInterval(scoreInterval);

      scoreInterval = setInterval(() => {
        score++;
        scoreDisplay.innerText = String(score).padStart(5, '0');
        
        // Кожні 100 очок гра пришвидшується! 🔥
        if (score % 100 === 0) {
            let currentDur = parseFloat(window.getComputedStyle(obstacle).animationDuration);
            if (currentDur > 0.7) {
                obstacle.style.animationDuration = (currentDur - 0.1) + 's';
            }
        }
      }, 100);

      gameLoop = setInterval(() => {
        const gRect = goat.getBoundingClientRect();
        const oRect = obstacle.getBoundingClientRect();

        // Перевірка колізії (врізався чи ні)
        if (
          oRect.left < gRect.right - 15 &&
          oRect.right > gRect.left + 15 &&
          oRect.top < gRect.bottom - 10 &&
          oRect.bottom > gRect.top + 10
        ) {
          gameOver();
        }
      }, 10);
    }

    function gameOver() {
      isGameOver = true;
      let currentRight = window.getComputedStyle(obstacle).getPropertyValue('right');
      obstacle.classList.remove('move');
      obstacle.style.right = currentRight; // Зупиняємо камінь на місці
      
      clearInterval(gameLoop);
      clearInterval(scoreInterval);
      msg.innerText = "ГРА ЗАКІНЧЕНА";
      startBtn.innerText = "Спробувати ще";
      overlay.classList.remove('hidden');
    }

    // Керування (Пробіл або Клік/Тап)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); 
        if (isGameOver && !overlay.classList.contains('hidden')) startGame();
        else jump();
      }
    });
    
    gameArea.addEventListener('mousedown', () => { if(!isGameOver) jump(); });
    gameArea.addEventListener('touchstart', (e) => { e.preventDefault(); if(!isGameOver) jump(); }, {passive: false});
    startBtn.addEventListener('click', startGame);
  </script>
</body>
</html>
`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (
    event.request.method !== 'GET' || 
    url.includes('supabase.co') || 
    url.includes('sockjs-node') ||
    url.includes('@vite') ||
    url.startsWith('chrome-extension')
  ) {
    return; 
  }

  event.respondWith(
    fetch(event.request)
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 🛑 ЯКЩО ІНТЕРНЕТУ НЕМАЄ І ЦЕ ЗАПИТ СТОРІНКИ — ВІДДАЄМО ГРУ!
        if (event.request.mode === 'navigate') {
          return new Response(OFFLINE_GAME_HTML, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }
        
        return new Response("", { status: 503 });
      })
  );
});