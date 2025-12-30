// ==================== SUPABASE CONFIG ====================
const SUPABASE_URL = 'https://hxttbhlmshdhowmxnxvy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4dHRiaGxtc2hkaG93bXhueHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMDMzMjQsImV4cCI6MjA4MjU3OTMyNH0.CFRwCCzjPJo-tl5ZxXB6Ne1yOwQAoZmjmMqpkHyqXJ0';

// Безопасная инициализация Supabase
let supabaseClient;
let supabaseInitialized = false;

function initSupabase() {
    try {
        if (typeof window.supabase !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            supabaseInitialized = true;
            console.log('✅ Supabase инициализирован');
        } else {
            throw new Error('Supabase not loaded');
        }
    } catch (error) {
        console.warn('⚠️ Supabase не загружен, игра будет работать без таблицы лидеров:', error);
        // Создаем заглушку
        supabaseClient = {
            from: () => ({
                select: () => Promise.resolve({ data: [], error: null }),
                insert: () => Promise.resolve({ error: null }),
                update: () => Promise.resolve({ error: null }),
                eq: function() { return this; },
                order: function() { return this; },
                limit: function() { return this; },
                single: function() { return Promise.resolve({ data: null, error: null }); }
            })
        };
        supabaseInitialized = false;
    }
}

// Инициализируем Supabase с задержкой, чтобы библиотека успела загрузиться
setTimeout(initSupabase, 200);

// ==================== TELEGRAM INIT ====================
let tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    // Настраиваем цвета для Telegram WebView в авиационной палитре
    tg.setHeaderColor('#1a3a5e');
    tg.setBackgroundColor('#0a1a2e');
}

// ==================== VIBRATION ====================
function vibrate(type = 'tap') {
    let vibrated = false;
    
    // Telegram haptic feedback (приоритет в Telegram)
    if (tg?.HapticFeedback) {
        try {
            switch(type) {
                case 'tap':
                case 'jump':
                    tg.HapticFeedback.impactOccurred('light');
                    vibrated = true;
                    console.log('✅ Telegram вибрация: light');
                    break;
                case 'score':
                    tg.HapticFeedback.impactOccurred('medium');
                    vibrated = true;
                    console.log('✅ Telegram вибрация: medium');
                    break;
                case 'explosion':
                    tg.HapticFeedback.impactOccurred('heavy');
                    vibrated = true;
                    console.log('✅ Telegram вибрация: heavy');
                    break;
                case 'levelup':
                    tg.HapticFeedback.notificationOccurred('success');
                    vibrated = true;
                    console.log('✅ Telegram вибрация: success');
                    break;
            }
        } catch (error) {
            console.warn('❌ Telegram HapticFeedback error:', error);
        }
    }
    
    // Browser Vibration API (fallback или для обычных браузеров)
    if (navigator.vibrate && typeof navigator.vibrate === 'function') {
        try {
            switch(type) {
                case 'tap':
                case 'jump':
                    navigator.vibrate(50); // Увеличено с 30 до 50
                    vibrated = true;
                    console.log('✅ Browser вибрация: 50ms');
                    break;
                case 'score':
                    navigator.vibrate(80); // Увеличено с 60 до 80
                    vibrated = true;
                    console.log('✅ Browser вибрация: 80ms');
                    break;
                case 'explosion':
                    navigator.vibrate([150, 50, 150, 50, 150]); // Увеличено
                    vibrated = true;
                    console.log('✅ Browser вибрация: explosion pattern');
                    break;
                case 'levelup':
                    navigator.vibrate([80, 40, 80]); // Увеличено
                    vibrated = true;
                    console.log('✅ Browser вибрация: levelup pattern');
                    break;
            }
        } catch (error) {
            console.warn('❌ Vibration API error:', error);
        }
    }
    
    // Для отладки
    if (!vibrated) {
        console.warn('⚠️ Вибрация не доступна! tg:', !!tg, 'HapticFeedback:', !!tg?.HapticFeedback, 'navigator.vibrate:', !!navigator.vibrate);
    }
}

// Получаем данные пользователя из Telegram
function getTelegramUserName() {
    if (!tg) return null;
    
    try {
        const user = tg.initDataUnsafe?.user;
        if (user) {
            // Приоритет: полное имя (first_name + last_name) > username
            if (user.first_name) {
                let fullName = user.first_name.trim();
                if (user.last_name && user.last_name.trim()) {
                    fullName += ' ' + user.last_name.trim();
                }
                // Убираем лишние пробелы
                fullName = fullName.replace(/\s+/g, ' ');
                return fullName;
            } else if (user.username) {
                // Если есть username, возвращаем его
                return user.username.trim();
            }
        }
        
        // Пробуем получить из других источников
        if (tg.initDataUnsafe?.user?.first_name) {
            return tg.initDataUnsafe.user.first_name.trim();
        }
    } catch (error) {
        console.warn('Ошибка получения данных пользователя Telegram:', error);
    }
    
    return null;
}

// ==================== DOM ELEMENTS ====================
let canvas, ctx, startScreen, gameOverScreen, pauseScreen, startButton, restartButton, pauseButton, resumeButton;
let scoreDisplay, finalScoreDisplay, levelDisplay, bestScoreDisplay;
let playerNameInput, newHighScoreDiv, startLeaderboardList, gameOverLeaderboardList;

function initDOMElements() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas не найден!');
        return false;
    }
    ctx = canvas.getContext('2d');
    startScreen = document.getElementById('startScreen');
    gameOverScreen = document.getElementById('gameOverScreen');
    pauseScreen = document.getElementById('pauseScreen');
    startButton = document.getElementById('startButton');
    restartButton = document.getElementById('restartButton');
    pauseButton = document.getElementById('pauseButton');
    resumeButton = document.getElementById('resumeButton');
    scoreDisplay = document.getElementById('scoreDisplay');
    finalScoreDisplay = document.getElementById('finalScore');
    levelDisplay = document.getElementById('levelDisplay');
    bestScoreDisplay = document.getElementById('bestScore');
    playerNameInput = document.getElementById('playerName');
    newHighScoreDiv = document.getElementById('newHighScore');
    startLeaderboardList = document.getElementById('startLeaderboardList');
    gameOverLeaderboardList = document.getElementById('gameOverLeaderboardList');
    
    return canvas && ctx;
}

// ==================== AUDIO ====================
let audioContext;
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'jump':
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'score':
            oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'explosion':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'levelup':
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(554, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.2);
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
            break;
    }
}

// ==================== CANVAS SETUP ====================
function resizeCanvas() {
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Переинициализируем звезды и облака при изменении размера
        if (typeof initStars === 'function') initStars();
        if (typeof initClouds === 'function') initClouds();
    }
}

// ==================== GAME VARIABLES ====================
let gameState = 'start'; // 'start', 'playing', 'paused', 'exploding', 'gameover'
let score = 0;
let bestScore = localStorage.getItem('bestScore') || 0;
// Имя будет получено позже при инициализации
let playerName = localStorage.getItem('playerName') || '';
let frameCount = 0;
let level = 1;
let gameStartDelay = 60; // Задержка перед началом падения (60 кадров = ~1 секунда)
let gameStartTimer = 0;

// Difficulty settings
const difficulty = {
    baseSpeed: 3,
    speedIncrement: 0.4,
    baseGap: 200,
    gapDecrement: 8,
    minGap: 130,
    scorePerLevel: 5
};

let currentSpeed = difficulty.baseSpeed;
let currentGap = difficulty.baseGap;

// Background image
let backgroundImage = null;
let backgroundImageLoaded = false;

// Santa/Plane sprite image
let santaImage = null;
let santaImageLoaded = false;

function loadBackgroundImage() {
    if (!backgroundImage) {
        backgroundImage = new Image();
    }
    
    // Пробуем загрузить изображение (поддерживаем разные форматы)
    const imageNames = ['background.png', 'background.jpg', 'background.webp'];
    let imageIndex = 0;
    
    function tryLoadImage() {
        if (imageIndex < imageNames.length) {
            const imagePath = imageNames[imageIndex];
            // Создаем новый объект Image для каждой попытки
            const img = new Image();
            img.onload = function() {
                backgroundImage = img;
                backgroundImageLoaded = true;
                console.log('✅ Фоновое изображение загружено успешно:', imageNames[imageIndex]);
                console.log('📐 Размеры изображения:', backgroundImage.width, 'x', backgroundImage.height);
                console.log('✅ Флаг загрузки установлен:', backgroundImageLoaded);
            };
            img.onerror = function() {
                console.warn('❌ Не удалось загрузить:', imageNames[imageIndex]);
                imageIndex++;
                if (imageIndex < imageNames.length) {
                    tryLoadImage();
                } else {
                    backgroundImageLoaded = false;
                    console.warn('⚠️ Не удалось загрузить фоновое изображение, используется градиент');
                }
            };
            img.src = imagePath;
            console.log('🔄 Пытаемся загрузить фон:', imagePath);
        }
    }
    
    tryLoadImage();
}

function loadSantaImage() {
    if (!santaImage) {
        santaImage = new Image();
    }
    
    const imageNames = ['santa.png', 'santa.jpg', 'ded-moroz.png'];
    let imageIndex = 0;
    
    function tryLoadSanta() {
        if (imageIndex < imageNames.length) {
            const imagePath = imageNames[imageIndex];
            const img = new Image();
            img.onload = function() {
                santaImage = img;
                santaImageLoaded = true;
                // Автоматически подстраиваем размеры под изображение
                // Увеличиваем в 5 раз (было 0.4, теперь 2.0 = в 5 раз больше)
                // Используем canvas если доступен, иначе фиксированные размеры
                const maxWidth = canvas ? Math.min(canvas.width * 0.4, 600) : 600;
                const maxHeight = canvas ? Math.min(canvas.height * 0.5, 500) : 500;
                plane.width = Math.min(santaImage.width * 2.0, maxWidth);
                plane.height = Math.min(santaImage.height * 2.0, maxHeight);
                console.log('✅ Изображение Деда Мороза загружено:', imageNames[imageIndex]);
                console.log('📐 Размеры спрайта:', santaImage.width, 'x', santaImage.height);
                console.log('📐 Размеры в игре:', plane.width, 'x', plane.height);
            };
            img.onerror = function() {
                console.warn('❌ Не удалось загрузить:', imageNames[imageIndex]);
                imageIndex++;
                if (imageIndex < imageNames.length) {
                    tryLoadSanta();
                } else {
                    santaImageLoaded = false;
                    console.warn('⚠️ Не удалось загрузить изображение Деда Мороза, используется векторный самолет');
                }
            };
            img.src = imagePath;
            console.log('🔄 Пытаемся загрузить Дед Мороз:', imagePath);
        }
    }
    
    tryLoadSanta();
}

// Загружаем фоновое изображение после объявления переменных
loadBackgroundImage();

// Plane/Santa (теперь это Дед Мороз)
const plane = {
    x: 0,
    y: 0,
    width: 400, // Увеличиваем размер для Деда Мороза (в 5 раз больше)
    height: 300,
    velocity: 0,
    gravity: 0.45,
    jumpPower: -7.5,
    rotation: 0,
    // Анимация
    bobOffset: 0, // Для покачивания вверх-вниз
    bobSpeed: 0.08, // Скорость покачивания
    glowIntensity: 1, // Интенсивность свечения
    glowSpeed: 0.05 // Скорость пульсации свечения
};

// Загружаем изображение Деда Мороза
setTimeout(() => {
    loadSantaImage();
}, 150);

// Particles for explosion
const particles = [];
const explosionDuration = 60;
let explosionTimer = 0;

// Obstacles
const obstacles = [];
const obstacleWidth = 60;
let obstacleSpawnTimer = 0;
const obstacleSpawnInterval = 130;

// Stars
const stars = [];
function initStars() {
    stars.length = 0;
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            opacity: Math.random() * 0.5 + 0.3,
            twinkle: Math.random() * Math.PI * 2
        });
    }
}

// Clouds
const clouds = [];
function initClouds() {
    clouds.length = 0;
    for (let i = 0; i < 5; i++) {
        clouds.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height * 0.6,
            width: 80 + Math.random() * 60,
            height: 40 + Math.random() * 30,
            speed: 0.3 + Math.random() * 0.2,
            opacity: 0.1 + Math.random() * 0.1
        });
    }
}

// initStars() и initClouds() будут вызваны после инициализации canvas

// ==================== LEADERBOARD (SUPABASE) ====================
async function loadLeaderboard() {
    // Проверяем, что supabaseClient инициализирован и это не заглушка
    if (!supabaseClient || !supabaseInitialized || !supabaseClient.from || typeof supabaseClient.from !== 'function') {
        return [];
    }
    
    try {
        const result = await supabaseClient
            .from('leaderboard')
            .select('*')
            .order('score', { ascending: false })
            .limit(10);
        
        // Проверяем результат
        if (!result) {
            return [];
        }
        
        const { data, error } = result;
        
        if (error) {
            console.warn('Error loading leaderboard:', error);
            return [];
        }
        
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Error loading leaderboard (catch):', error);
        return [];
    }
}

// Получить позицию игрока в рейтинге
async function getPlayerRank(playerName) {
    if (!supabaseClient || !supabaseInitialized || !supabaseClient.from || typeof supabaseClient.from !== 'function') {
        return null;
    }
    
    try {
        // Получаем все записи, отсортированные по очкам
        const result = await supabaseClient
            .from('leaderboard')
            .select('name, score')
            .order('score', { ascending: false });
        
        if (!result || result.error) {
            return null;
        }
        
        const { data } = result;
        if (!Array.isArray(data)) {
            return null;
        }
        
        // Находим позицию игрока
        const playerIndex = data.findIndex(player => player.name === playerName);
        
        if (playerIndex === -1) {
            return null; // Игрок не найден
        }
        
        return {
            rank: playerIndex + 1,
            totalPlayers: data.length,
            score: data[playerIndex].score
        };
    } catch (error) {
        console.warn('Error getting player rank:', error);
        return null;
    }
}

// Получить общее количество игроков
async function getTotalPlayers() {
    if (!supabaseClient || !supabaseInitialized || !supabaseClient.from || typeof supabaseClient.from !== 'function') {
        return 0;
    }
    
    try {
        const result = await supabaseClient
            .from('leaderboard')
            .select('name', { count: 'exact', head: true });
        
        if (!result || result.error) {
            return 0;
        }
        
        return result.count || 0;
    } catch (error) {
        console.warn('Error getting total players:', error);
        return 0;
    }
}

async function saveScore(name, newScore) {
    // Проверяем, что supabaseClient инициализирован и это не заглушка
    if (!supabaseClient || !supabaseInitialized || !supabaseClient.from || typeof supabaseClient.from !== 'function') {
        return;
    }
    
    if (!name || !newScore || newScore <= 0) {
        return;
    }
    
    try {
        // Check if player exists
        const existingResult = await supabaseClient
            .from('leaderboard')
            .select('*')
            .eq('name', name)
            .single();
        
        if (!existingResult) {
            throw new Error('Supabase query failed for existing player check.');
        }

        const { data: existing, error: existingError } = existingResult;

        if (existingError && existingError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine
            throw existingError;
        }
        
        if (existing) {
            // Update if new score is higher
            if (newScore > existing.score) {
                const updateResult = await supabaseClient
                    .from('leaderboard')
                    .update({ score: newScore })
                    .eq('name', name);
                
                if (updateResult.error) {
                    throw updateResult.error;
                }
                console.log('Score updated for', name);
            }
        } else {
            // Add new player
            const insertResult = await supabaseClient
                .from('leaderboard')
                .insert([{ name: name, score: newScore }]);
            
            if (insertResult.error) {
                throw insertResult.error;
            }
            console.log('New player added:', name);
        }
    } catch (error) {
        console.warn('Error saving score:', error);
    }
}

// Функция для безопасного экранирования HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function renderLeaderboard(container, leaders, currentPlayerName, playerRank = null, totalPlayers = 0) {
    if (!container) return;
    
    if (leaders.length === 0) {
        container.innerHTML = '<div class="leaderboard-loading">Загрузка рейтинга...</div>';
        return;
    }
    
    // Проверяем, есть ли текущий игрок в топ-10
    const currentPlayerInTop = leaders.findIndex(leader => leader.name === currentPlayerName);
    
    let html = '';
    
    // Показываем топ игроков
    html += leaders.map((leader, index) => {
        let itemClass = 'leaderboard-item';
        if (leader.name === currentPlayerName) itemClass += ' current-player';
        if (index === 0) itemClass += ' top-1';
        else if (index === 1) itemClass += ' top-2';
        else if (index === 2) itemClass += ' top-3';
        
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const rankDisplay = index < 3 ? medal : `<span class="rank-number">${index + 1}</span>`;
        const safeName = escapeHtml(leader.name);
        const safeScore = leader.score.toLocaleString();
        
        return `
            <div class="${itemClass}">
                <span class="leaderboard-rank">${rankDisplay}</span>
                <span class="leaderboard-name" title="${safeName}">${safeName}</span>
                <span class="leaderboard-score">${safeScore} <span class="score-label">очков</span></span>
            </div>
        `;
    }).join('');
    
    // Если текущий игрок не в топ-10, показываем его позицию отдельно
    if (currentPlayerInTop === -1 && playerRank && playerRank.rank) {
        const safeCurrentName = escapeHtml(currentPlayerName);
        const safeRankScore = playerRank.score.toLocaleString();
        html += `
            <div class="leaderboard-separator"></div>
            <div class="leaderboard-item current-player player-rank-info">
                <span class="leaderboard-rank"><span class="rank-number">${playerRank.rank}</span></span>
                <span class="leaderboard-name" title="${safeCurrentName}">${safeCurrentName} <span class="you-label">(Вы)</span></span>
                <span class="leaderboard-score">${safeRankScore} <span class="score-label">очков</span></span>
            </div>
        `;
    }
    
    // Показываем общую статистику
    if (totalPlayers > 0) {
        html += `
            <div class="leaderboard-stats">
                <div class="stats-item">Всего игроков: <strong>${totalPlayers}</strong></div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

async function updateLeaderboards() {
    if (!startLeaderboardList || !gameOverLeaderboardList) {
        console.warn('Leaderboard DOM elements not found.');
        return;
    }
    
    const leaders = await loadLeaderboard();
    const playerRank = playerName ? await getPlayerRank(playerName) : null;
    const totalPlayers = await getTotalPlayers();
    
    await renderLeaderboard(startLeaderboardList, leaders, playerName, playerRank, totalPlayers);
    await renderLeaderboard(gameOverLeaderboardList, leaders, playerName, playerRank, totalPlayers);
}

// ==================== EXPLOSION ====================
function createExplosion(x, y) {
    particles.length = 0;
    const colors = ['#4A90E2', '#DC143C', '#FF6600', '#FFD700', '#ffffff'];
    
    for (let i = 0; i < 50; i++) {
        const angle = (Math.PI * 2 / 50) * i + Math.random() * 0.5;
        const speed = 2 + Math.random() * 6;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3 + Math.random() * 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 1,
            decay: 0.015 + Math.random() * 0.01
        });
    }
}

function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= p.decay;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// ==================== DRAWING FUNCTIONS ====================
function drawBackground() {
    // Проверяем, загружено ли изображение и есть ли оно
    // Проверяем и флаг загрузки, и сам объект изображения
    if (backgroundImageLoaded && backgroundImage && backgroundImage.complete && backgroundImage.naturalWidth > 0) {
        // Рисуем фоновое изображение на весь canvas (растягиваем)
        ctx.save();
        ctx.globalAlpha = 1.0; // Полная непрозрачность для фона
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // Добавляем очень легкий оверлей для лучшей видимости игровых элементов (почти прозрачный)
        const overlay = ctx.createLinearGradient(0, 0, 0, canvas.height);
        overlay.addColorStop(0, 'rgba(10, 26, 46, 0.05)');
        overlay.addColorStop(0.5, 'rgba(26, 58, 94, 0.03)');
        overlay.addColorStop(1, 'rgba(45, 90, 135, 0.05)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Fallback на градиент, если изображение не загружено
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0a1a2e');
        gradient.addColorStop(0.5, '#1a3a5e');
        gradient.addColorStop(1, '#2d5a87');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawStars() {
    ctx.fillStyle = '#ffffff';
    stars.forEach(star => {
        star.twinkle += 0.05;
        const opacity = star.opacity + Math.sin(star.twinkle) * 0.2;
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawClouds() {
    ctx.fillStyle = '#ffffff';
    clouds.forEach(cloud => {
        ctx.globalAlpha = cloud.opacity;
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cloud.x - cloud.width * 0.3, cloud.y, cloud.width * 0.4, cloud.height * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cloud.x + cloud.width * 0.3, cloud.y, cloud.width * 0.4, cloud.height * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// Дед Мороз (или самолет, если изображение не загружено)
function drawPlane() {
    ctx.save();
    
    // Применяем анимацию покачивания
    const bobY = Math.sin(plane.bobOffset) * 3; // Покачивание вверх-вниз на 3 пикселя
    ctx.translate(plane.x + plane.width / 2, plane.y + plane.height / 2 + bobY);
    ctx.rotate(plane.rotation);
    
    // Если изображение Деда Мороза загружено, рисуем его
    if (santaImageLoaded && santaImage && santaImage.complete && santaImage.naturalWidth > 0) {
        // Улучшаем четкость изображения
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Пульсирующее свечение
        const glowAlpha = 0.6 + Math.sin(plane.glowIntensity) * 0.3;
        const glowBlur = 20 + Math.sin(plane.glowIntensity) * 10;
        
        // Внешнее свечение (более мягкое)
        ctx.shadowBlur = glowBlur;
        ctx.shadowColor = `rgba(74, 144, 226, ${glowAlpha})`;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Рисуем изображение Деда Мороза с улучшенной четкостью
        ctx.drawImage(
            santaImage, 
            -plane.width / 2, 
            -plane.height / 2, 
            plane.width, 
            plane.height
        );
        
        // Дополнительное внутреннее свечение для четкости
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.2;
        ctx.drawImage(
            santaImage, 
            -plane.width / 2, 
            -plane.height / 2, 
            plane.width, 
            plane.height
        );
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        
        ctx.restore();
        return;
    }
    
    // Fallback: рисуем векторный самолет, если изображение не загружено
    const w = plane.width;
    const h = plane.height;
    
    // Glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#4A90E2';
    
    // Main fuselage (Boeing 737 shape)
    ctx.fillStyle = '#c0c8d0';
    ctx.beginPath();
    // Nose (rounded)
    ctx.moveTo(w * 0.5, 0);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.35, w * 0.35, -h * 0.35);
    // Top of fuselage
    ctx.lineTo(-w * 0.35, -h * 0.35);
    // Tail top
    ctx.lineTo(-w * 0.45, -h * 0.35);
    ctx.lineTo(-w * 0.5, -h * 0.7);
    ctx.lineTo(-w * 0.48, -h * 0.7);
    ctx.lineTo(-w * 0.42, -h * 0.35);
    // Back of fuselage
    ctx.lineTo(-w * 0.5, -h * 0.3);
    ctx.lineTo(-w * 0.5, h * 0.3);
    // Bottom of fuselage
    ctx.lineTo(-w * 0.35, h * 0.35);
    ctx.lineTo(w * 0.35, h * 0.35);
    // Back to nose
    ctx.quadraticCurveTo(w * 0.5, h * 0.35, w * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    
    // Darker belly
    ctx.fillStyle = '#a0a8b0';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.1);
    ctx.quadraticCurveTo(w * 0.5, h * 0.35, w * 0.35, h * 0.35);
    ctx.lineTo(-w * 0.35, h * 0.35);
    ctx.lineTo(-w * 0.5, h * 0.3);
    ctx.lineTo(-w * 0.5, h * 0.1);
    ctx.closePath();
    ctx.fill();
    
    // Windows line
    ctx.fillStyle = '#1a3a5e';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const wx = w * 0.35 - i * w * 0.09;
        ctx.moveTo(wx, -h * 0.2);
        ctx.arc(wx, -h * 0.2, h * 0.08, 0, Math.PI * 2);
    }
    ctx.fill();
    
    // Cockpit windows
    ctx.fillStyle = '#4A90E2';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#4A90E2';
    ctx.beginPath();
    ctx.moveTo(w * 0.42, -h * 0.15);
    ctx.lineTo(w * 0.48, -h * 0.1);
    ctx.lineTo(w * 0.48, h * 0.05);
    ctx.lineTo(w * 0.42, h * 0.1);
    ctx.lineTo(w * 0.38, h * 0.05);
    ctx.lineTo(w * 0.38, -h * 0.1);
    ctx.closePath();
    ctx.fill();
    
    // Wings
    ctx.fillStyle = '#9098a0';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#4A90E2';
    
    // Top wing
    ctx.beginPath();
    ctx.moveTo(w * 0.1, -h * 0.35);
    ctx.lineTo(-w * 0.15, -h * 1.1);
    ctx.lineTo(-w * 0.25, -h * 1.1);
    ctx.lineTo(-w * 0.15, -h * 0.35);
    ctx.closePath();
    ctx.fill();
    
    // Bottom wing
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.35);
    ctx.lineTo(-w * 0.15, h * 1.1);
    ctx.lineTo(-w * 0.25, h * 1.1);
    ctx.lineTo(-w * 0.15, h * 0.35);
    ctx.closePath();
    ctx.fill();
    
    // Engines under wings
    ctx.fillStyle = '#707880';
    // Top engine
    ctx.beginPath();
    ctx.ellipse(-w * 0.05, -h * 0.7, w * 0.08, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bottom engine
    ctx.beginPath();
    ctx.ellipse(-w * 0.05, h * 0.7, w * 0.08, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine glow
    const engineGlow = ctx.createRadialGradient(-w * 0.13, -h * 0.7, 0, -w * 0.13, -h * 0.7, w * 0.1);
    engineGlow.addColorStop(0, 'rgba(255, 150, 50, 0.9)');
    engineGlow.addColorStop(0.5, 'rgba(255, 100, 0, 0.5)');
    engineGlow.addColorStop(1, 'rgba(255, 50, 0, 0)');
    
    ctx.fillStyle = engineGlow;
    ctx.beginPath();
    ctx.ellipse(-w * 0.13, -h * 0.7, w * 0.1, h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(-w * 0.13, h * 0.7, w * 0.1, h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Tail fin
    ctx.fillStyle = '#4A90E2';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#4A90E2';
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.4);
    ctx.lineTo(-w * 0.5, -h * 0.65);
    ctx.lineTo(-w * 0.48, -h * 0.65);
    ctx.lineTo(-w * 0.43, -h * 0.4);
    ctx.closePath();
    ctx.fill();
    
    // Neon accent lines
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#4A90E2';
    
    // Stripe along fuselage
    ctx.beginPath();
    ctx.moveTo(w * 0.45, 0);
    ctx.lineTo(-w * 0.45, 0);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawObstacle(obstacle) {
    const glowGradient = ctx.createLinearGradient(
        obstacle.x, 0,
        obstacle.x + obstacleWidth, 0
    );
    glowGradient.addColorStop(0, 'rgba(74, 144, 226, 0.3)');
    glowGradient.addColorStop(0.5, 'rgba(74, 144, 226, 0.8)');
    glowGradient.addColorStop(1, 'rgba(74, 144, 226, 0.3)');
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#4A90E2';
    
    ctx.fillStyle = glowGradient;
    ctx.fillRect(obstacle.x, 0, obstacleWidth, obstacle.topHeight);
    ctx.fillRect(
        obstacle.x,
        obstacle.topHeight + currentGap,
        obstacleWidth,
        canvas.height - (obstacle.topHeight + currentGap)
    );
    
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    
    ctx.strokeRect(obstacle.x, 0, obstacleWidth, obstacle.topHeight);
    ctx.strokeRect(
        obstacle.x,
        obstacle.topHeight + currentGap,
        obstacleWidth,
        canvas.height - (obstacle.topHeight + currentGap)
    );
    
    ctx.strokeStyle = '#DC143C';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#DC143C';
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    ctx.moveTo(obstacle.x, obstacle.topHeight);
    ctx.lineTo(obstacle.x + obstacleWidth, obstacle.topHeight);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(obstacle.x, obstacle.topHeight + currentGap);
    ctx.lineTo(obstacle.x + obstacleWidth, obstacle.topHeight + currentGap);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
}

// ==================== GAME LOGIC ====================
function createObstacle() {
    const minHeight = 80;
    const maxHeight = canvas.height - currentGap - minHeight;
    const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
    
    obstacles.push({
        x: canvas.width,
        topHeight: topHeight,
        passed: false
    });
}

function updateDifficulty() {
    const newLevel = Math.floor(score / difficulty.scorePerLevel) + 1;
    
    if (newLevel > level) {
        level = newLevel;
        playSound('levelup');
        vibrate('levelup');
        levelDisplay.textContent = 'Уровень: ' + level;
        levelDisplay.classList.add('level-up');
        setTimeout(() => levelDisplay.classList.remove('level-up'), 500);
    }
    
    currentSpeed = difficulty.baseSpeed + (level - 1) * difficulty.speedIncrement;
    currentGap = Math.max(difficulty.minGap, difficulty.baseGap - (level - 1) * difficulty.gapDecrement);
}

function updatePlane() {
    // В начале игры даем самолету время на старт
    if (gameStartTimer < gameStartDelay) {
        gameStartTimer++;
        // Самолет начинает с небольшой скоростью вверх
        if (gameStartTimer < gameStartDelay / 2) {
            plane.velocity = -2; // Легкий подъем
        } else {
            plane.velocity = 0; // Нейтральная позиция
        }
    } else {
        // Обычная физика после задержки
        plane.velocity += plane.gravity;
    }
    
    plane.y += plane.velocity;
    
    // Плавное вращение в зависимости от скорости
    plane.rotation = Math.max(-0.4, Math.min(0.4, plane.velocity * 0.04));
    
    // Обновляем анимацию покачивания
    plane.bobOffset += plane.bobSpeed;
    if (plane.bobOffset > Math.PI * 2) {
        plane.bobOffset -= Math.PI * 2;
    }
    
    // Обновляем пульсацию свечения
    plane.glowIntensity += plane.glowSpeed;
    if (plane.glowIntensity > Math.PI * 2) {
        plane.glowIntensity -= Math.PI * 2;
    }
    
    if (plane.y < 0) {
        plane.y = 0;
        plane.velocity = 0;
    }
    if (plane.y + plane.height > canvas.height) {
        plane.y = canvas.height - plane.height;
        triggerGameOver();
    }
}

function updateObstacles() {
    obstacleSpawnTimer++;
    if (obstacleSpawnTimer >= obstacleSpawnInterval) {
        createObstacle();
        obstacleSpawnTimer = 0;
    }
    
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.x -= currentSpeed;
        
        if (!obstacle.passed && obstacle.x + obstacleWidth < plane.x) {
            obstacle.passed = true;
            score++;
            scoreDisplay.textContent = score;
            playSound('score');
            vibrate('score');
            updateDifficulty();
        }
        
        if (obstacle.x + obstacleWidth < 0) {
            obstacles.splice(i, 1);
            continue;
        }
        
        // Collision detection
        const planeHitbox = {
            x: plane.x + plane.width * 0.1,
            y: plane.y + plane.height * 0.2,
            width: plane.width * 0.8,
            height: plane.height * 0.6
        };
        
        if (
            planeHitbox.x < obstacle.x + obstacleWidth &&
            planeHitbox.x + planeHitbox.width > obstacle.x &&
            (planeHitbox.y < obstacle.topHeight || planeHitbox.y + planeHitbox.height > obstacle.topHeight + currentGap)
        ) {
            triggerGameOver();
        }
    }
}

function updateClouds() {
    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.width < 0) {
            cloud.x = canvas.width + cloud.width;
            cloud.y = Math.random() * canvas.height * 0.6;
        }
    });
}

function jump() {
    if (gameState === 'playing') {
        // Если игра только началась, ускоряем старт
        if (gameStartTimer < gameStartDelay) {
            gameStartTimer = gameStartDelay; // Пропускаем задержку
        }
        plane.velocity = plane.jumpPower;
        playSound('jump');
        // Вибрация уже вызвана в обработчике события
    }
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        pauseScreen.classList.remove('hidden');
        pauseButton.classList.add('hidden');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        pauseScreen.classList.add('hidden');
        pauseButton.classList.remove('hidden');
    }
}

function resumeGame() {
    if (gameState === 'paused') {
        gameState = 'playing';
        pauseScreen.classList.add('hidden');
        pauseButton.classList.remove('hidden');
    }
}

function startGame() {
    initAudio();
    
    // Get player name (из Telegram или из поля ввода)
    // Сначала проверяем, есть ли имя из Telegram
    const telegramNameFromTG = tg ? getTelegramUserName() : null;
    
    if (telegramNameFromTG) {
        // Если в Telegram, используем имя из аккаунта (приоритет)
        playerName = telegramNameFromTG;
        console.log('✅ Используем имя из Telegram:', playerName);
    } else if (playerName && playerName.trim() !== '') {
        // Если имя уже установлено (из localStorage или предыдущей игры), используем его
        console.log('✅ Используем сохраненное имя:', playerName);
    } else if (playerNameInput && playerNameInput.value.trim()) {
        // Иначе используем введенное имя, если оно есть
        playerName = playerNameInput.value.trim();
        console.log('✅ Используем введенное имя:', playerName);
    } else {
        // Если имени нет вообще, используем дефолтное
        playerName = 'Пилот';
        console.log('⚠️ Используем дефолтное имя:', playerName);
    }
    
    // Сохраняем в localStorage для использования вне Telegram
    if (playerName) {
        localStorage.setItem('playerName', playerName);
    }
    
    // Обновляем leaderboard перед началом игры
    updateLeaderboards();
    
    gameState = 'playing';
    score = 0;
    level = 1;
    frameCount = 0;
    obstacles.length = 0;
    particles.length = 0;
    obstacleSpawnTimer = 0;
    explosionTimer = 0;
    gameStartTimer = 0; // Сбрасываем таймер старта
    
    currentSpeed = difficulty.baseSpeed;
    currentGap = difficulty.baseGap;
    
    // Показываем кнопку паузы
    if (pauseButton) {
        pauseButton.classList.remove('hidden');
    }
    
    // Скрываем экран паузы если он был открыт
    if (pauseScreen) {
        pauseScreen.classList.add('hidden');
    }
    
    plane.x = canvas.width * 0.15;
    plane.y = canvas.height / 2;
    plane.velocity = 0;
    plane.rotation = 0;
    // Сбрасываем анимацию
    plane.bobOffset = 0;
    plane.glowIntensity = 0;
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden'); // Убеждаемся что экран паузы скрыт
    scoreDisplay.classList.remove('hidden');
    levelDisplay.classList.remove('hidden');
    scoreDisplay.textContent = '0';
    levelDisplay.textContent = 'Уровень: 1';
}

function triggerGameOver() {
    if (gameState === 'playing') {
        gameState = 'exploding';
        playSound('explosion');
        vibrate('explosion');
        createExplosion(plane.x + plane.width / 2, plane.y + plane.height / 2);
        explosionTimer = 0;
    }
}

async function gameOver() {
    gameState = 'gameover';
    
    const isNewRecord = score > bestScore;
    if (isNewRecord) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
        newHighScoreDiv.classList.remove('hidden');
    } else {
        newHighScoreDiv.classList.add('hidden');
    }
    
    finalScoreDisplay.textContent = score;
    bestScoreDisplay.textContent = bestScore;
    gameOverScreen.classList.remove('hidden');
    scoreDisplay.classList.add('hidden');
    levelDisplay.classList.add('hidden');
    
    // Скрываем кнопку паузы при game over
    if (pauseButton) {
        pauseButton.classList.add('hidden');
    }
    
    // Save to Supabase
    if (playerName && score > 0) {
        await saveScore(playerName, score);
        await updateLeaderboards();
    }
    
    if (tg) {
        tg.sendData(JSON.stringify({ score: score, name: playerName }));
    }
}

// ==================== GAME LOOP ====================
function gameLoop() {
    drawBackground();
    drawStars();
    drawClouds();
    updateClouds();
    
    if (gameState === 'playing') {
        updatePlane();
        updateObstacles();
        obstacles.forEach(drawObstacle);
        drawPlane();
        frameCount++;
    } else if (gameState === 'paused') {
        // Рисуем игру в замороженном состоянии
        obstacles.forEach(drawObstacle);
        drawPlane();
        // Не обновляем физику
    } else if (gameState === 'exploding') {
        obstacles.forEach(drawObstacle);
        updateAndDrawParticles();
        explosionTimer++;
        
        if (explosionTimer >= explosionDuration) {
            gameOver();
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// ==================== ИНИЦИАЛИЗАЦИЯ ИГРЫ ====================
function initGame() {
    // Инициализируем DOM элементы
    if (!initDOMElements()) {
        console.error('Не удалось инициализировать DOM элементы!');
        return;
    }
    
    // Получаем имя из Telegram или из localStorage
    const telegramUserName = tg ? getTelegramUserName() : null;
    if (telegramUserName) {
        playerName = telegramUserName;
        console.log('✅ Имя получено из Telegram:', playerName);
    } else {
        playerName = localStorage.getItem('playerName') || '';
        if (playerName) {
            console.log('✅ Имя загружено из localStorage:', playerName);
        }
    }
    
    // Инициализируем canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Привязываем обработчики событий
    if (startButton) {
        startButton.addEventListener('click', startGame);
    } else {
        console.error('startButton не найден!');
    }
    
    if (restartButton) {
        restartButton.addEventListener('click', startGame);
    } else {
        console.error('restartButton не найден!');
    }
    
    if (pauseButton) {
        pauseButton.addEventListener('click', togglePause);
    } else {
        console.error('pauseButton не найден!');
    }
    
    if (resumeButton) {
        resumeButton.addEventListener('click', resumeGame);
    } else {
        console.error('resumeButton не найден!');
    }
    
    if (canvas) {
        canvas.addEventListener('click', (e) => {
            e.preventDefault();
            vibrate('tap');
            initAudio();
            if (gameState === 'playing') {
                jump();
            }
        });
        
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            vibrate('tap');
            initAudio();
            if (gameState === 'playing') {
                jump();
            }
        });
    } else {
        console.error('Canvas не найден!');
        return;
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            vibrate('tap');
            initAudio();
            if (gameState === 'playing') {
                jump();
            }
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
            // Пауза на P или Escape
            e.preventDefault();
            if (gameState === 'playing' || gameState === 'paused') {
                togglePause();
            }
        }
    });
    
    // Настраиваем поле ввода имени
    // Получаем актуальное имя из Telegram (если доступно)
    const currentTelegramName = tg ? getTelegramUserName() : null;
    
    if (currentTelegramName) {
        // Если в Telegram, используем актуальное имя из аккаунта
        playerName = currentTelegramName;
        console.log('✅ Имя из Telegram установлено:', playerName);
        
        // Скрываем поле ввода и показываем имя пользователя
        const nameInputContainer = document.querySelector('.name-input-container');
        if (nameInputContainer) {
            const safeName = escapeHtml(currentTelegramName);
            nameInputContainer.innerHTML = `<div style="color: #4A90E2; padding: 12px; text-align: center; border: 2px solid #4A90E2; border-radius: 10px; background: rgba(74, 144, 226, 0.1);">
                <strong>Игрок:</strong> ${safeName}
            </div>`;
        }
        // Скрываем поле ввода если оно есть
        if (playerNameInput) {
            playerNameInput.style.display = 'none';
        }
    } else if (playerNameInput) {
        // Если не в Telegram, показываем поле ввода
        playerNameInput.style.display = 'block';
        if (playerName && playerName.trim() !== '') {
            playerNameInput.value = playerName;
        }
    }
    
    // Сохраняем имя в localStorage (но не перезаписываем имя из Telegram)
    if (playerName && playerName.trim() !== '') {
        localStorage.setItem('playerName', playerName);
        console.log('✅ Имя игрока установлено и сохранено:', playerName);
    }
    
    // Загружаем таблицу лидеров (с задержкой для загрузки Supabase)
    setTimeout(() => {
        try {
            if (typeof updateLeaderboards === 'function') {
                updateLeaderboards();
            }
        } catch (error) {
            console.warn('Ошибка загрузки таблицы лидеров:', error);
        }
    }, 1000);
    
    // Периодически обновляем leaderboard на стартовом экране (каждые 10 секунд)
    setInterval(() => {
        if (gameState === 'start' && typeof updateLeaderboards === 'function') {
            updateLeaderboards();
        }
    }, 10000);
    
    // Запускаем игровой цикл
    try {
        gameLoop();
        console.log('✅ Игра инициализирована успешно!');
    } catch (error) {
        console.error('❌ Ошибка запуска игры:', error);
    }
}

// Запускаем инициализацию после загрузки DOM
(function() {
    'use strict';
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof initGame === 'function') {
                initGame();
            }
        });
    } else {
        // DOM уже загружен
        if (typeof initGame === 'function') {
            initGame();
        }
    }
})();
