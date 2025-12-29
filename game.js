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
}

// Получаем данные пользователя из Telegram
function getTelegramUserName() {
    if (!tg) return null;
    
    try {
        const user = tg.initDataUnsafe?.user;
        if (user) {
            // Используем полное имя или username
            if (user.first_name) {
                let fullName = user.first_name;
                if (user.last_name) {
                    fullName += ' ' + user.last_name;
                }
                return fullName;
            } else if (user.username) {
                return user.username;
            }
        }
    } catch (error) {
        console.warn('Ошибка получения данных пользователя Telegram:', error);
    }
    
    return null;
}

// ==================== DOM ELEMENTS ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const scoreDisplay = document.getElementById('scoreDisplay');
const finalScoreDisplay = document.getElementById('finalScore');
const levelDisplay = document.getElementById('levelDisplay');
const bestScoreDisplay = document.getElementById('bestScore');
const playerNameInput = document.getElementById('playerName');
const newHighScoreDiv = document.getElementById('newHighScore');
const startLeaderboardList = document.getElementById('startLeaderboardList');
const gameOverLeaderboardList = document.getElementById('gameOverLeaderboardList');

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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ==================== GAME VARIABLES ====================
let gameState = 'start';
let score = 0;
let bestScore = localStorage.getItem('bestScore') || 0;
// Получаем имя из Telegram или из localStorage
let playerName = getTelegramUserName() || localStorage.getItem('playerName') || '';
let frameCount = 0;
let level = 1;

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

// Plane (Boeing 737)
const plane = {
    x: 0,
    y: 0,
    width: 70,
    height: 25,
    velocity: 0,
    gravity: 0.45,
    jumpPower: -7.5,
    rotation: 0
};

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

initStars();
initClouds();

// ==================== LEADERBOARD (SUPABASE) ====================
async function loadLeaderboard() {
    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .order('score', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Error loading leaderboard:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        return [];
    }
}

async function saveScore(name, newScore) {
    try {
        // Check if player exists
        const { data: existing } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('name', name)
            .single();
        
        if (existing) {
            // Update if new score is higher
            if (newScore > existing.score) {
                await supabase
                    .from('leaderboard')
                    .update({ score: newScore })
                    .eq('name', name);
            }
        } else {
            // Add new player
            await supabase
                .from('leaderboard')
                .insert([{ name: name, score: newScore }]);
        }
    } catch (error) {
        console.error('Error saving score:', error);
    }
}

function renderLeaderboard(container, leaders, currentPlayerName) {
    if (!container) return;
    
    if (leaders.length === 0) {
        container.innerHTML = '<div class="leaderboard-loading">Нет данных</div>';
        return;
    }
    
    container.innerHTML = leaders.map((leader, index) => {
        let itemClass = 'leaderboard-item';
        if (leader.name === currentPlayerName) itemClass += ' current-player';
        if (index === 0) itemClass += ' top-1';
        else if (index === 1) itemClass += ' top-2';
        else if (index === 2) itemClass += ' top-3';
        
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        
        return `
            <div class="${itemClass}">
                <span class="leaderboard-rank">${medal}</span>
                <span class="leaderboard-name">${leader.name}</span>
                <span class="leaderboard-score">${leader.score}</span>
            </div>
        `;
    }).join('');
}

async function updateLeaderboards() {
    const leaders = await loadLeaderboard();
    renderLeaderboard(startLeaderboardList, leaders, playerName);
    renderLeaderboard(gameOverLeaderboardList, leaders, playerName);
}

// ==================== EXPLOSION ====================
function createExplosion(x, y) {
    particles.length = 0;
    const colors = ['#00d4ff', '#ff00ff', '#ff6600', '#ffff00', '#ffffff'];
    
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
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0e27');
    gradient.addColorStop(0.5, '#1a3a5e');
    gradient.addColorStop(1, '#2d5a87');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

// Boeing 737 silhouette
function drawPlane() {
    ctx.save();
    ctx.translate(plane.x + plane.width / 2, plane.y + plane.height / 2);
    ctx.rotate(plane.rotation);
    
    const w = plane.width;
    const h = plane.height;
    
    // Glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00d4ff';
    
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
    ctx.fillStyle = '#00d4ff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00d4ff';
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
    ctx.shadowColor = '#00d4ff';
    
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
    ctx.fillStyle = '#00d4ff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00d4ff';
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.4);
    ctx.lineTo(-w * 0.5, -h * 0.65);
    ctx.lineTo(-w * 0.48, -h * 0.65);
    ctx.lineTo(-w * 0.43, -h * 0.4);
    ctx.closePath();
    ctx.fill();
    
    // Neon accent lines
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00d4ff';
    
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
    glowGradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
    glowGradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.8)');
    glowGradient.addColorStop(1, 'rgba(0, 212, 255, 0.3)');
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00d4ff';
    
    ctx.fillStyle = glowGradient;
    ctx.fillRect(obstacle.x, 0, obstacleWidth, obstacle.topHeight);
    ctx.fillRect(
        obstacle.x,
        obstacle.topHeight + currentGap,
        obstacleWidth,
        canvas.height - (obstacle.topHeight + currentGap)
    );
    
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    
    ctx.strokeRect(obstacle.x, 0, obstacleWidth, obstacle.topHeight);
    ctx.strokeRect(
        obstacle.x,
        obstacle.topHeight + currentGap,
        obstacleWidth,
        canvas.height - (obstacle.topHeight + currentGap)
    );
    
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff00ff';
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
        levelDisplay.textContent = 'Уровень: ' + level;
        levelDisplay.classList.add('level-up');
        setTimeout(() => levelDisplay.classList.remove('level-up'), 500);
    }
    
    currentSpeed = difficulty.baseSpeed + (level - 1) * difficulty.speedIncrement;
    currentGap = Math.max(difficulty.minGap, difficulty.baseGap - (level - 1) * difficulty.gapDecrement);
}

function updatePlane() {
    plane.velocity += plane.gravity;
    plane.y += plane.velocity;
    
    plane.rotation = Math.max(-0.4, Math.min(0.4, plane.velocity * 0.04));
    
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
        plane.velocity = plane.jumpPower;
        playSound('jump');
    }
}

function startGame() {
    initAudio();
    
    // Get player name (из Telegram или из поля ввода)
    if (tg && getTelegramUserName()) {
        // Если в Telegram, используем имя из аккаунта
        playerName = getTelegramUserName();
    } else if (playerNameInput) {
        // Иначе используем введенное имя
        playerName = playerNameInput.value.trim() || 'Пилот';
    } else {
        playerName = playerName || 'Пилот';
    }
    
    // Сохраняем в localStorage для использования вне Telegram
    if (playerName) {
        localStorage.setItem('playerName', playerName);
    }
    
    gameState = 'playing';
    score = 0;
    level = 1;
    frameCount = 0;
    obstacles.length = 0;
    particles.length = 0;
    obstacleSpawnTimer = 0;
    explosionTimer = 0;
    
    currentSpeed = difficulty.baseSpeed;
    currentGap = difficulty.baseGap;
    
    plane.x = canvas.width * 0.15;
    plane.y = canvas.height / 2;
    plane.velocity = 0;
    plane.rotation = 0;
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    levelDisplay.classList.remove('hidden');
    scoreDisplay.textContent = '0';
    levelDisplay.textContent = 'Уровень: 1';
}

function triggerGameOver() {
    if (gameState === 'playing') {
        gameState = 'exploding';
        playSound('explosion');
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

// ==================== EVENT LISTENERS ====================
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

canvas.addEventListener('click', () => {
    initAudio();
    jump();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    jump();
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        initAudio();
        jump();
    }
});

// Настраиваем поле ввода имени
if (tg && getTelegramUserName()) {
    // Если в Telegram, скрываем поле ввода и показываем имя пользователя
    const nameInputContainer = document.querySelector('.name-input-container');
    if (nameInputContainer) {
        nameInputContainer.innerHTML = `<div style="color: #00d4ff; padding: 12px; text-align: center; border: 2px solid #00d4ff; border-radius: 10px; background: rgba(0, 212, 255, 0.1);">
            <strong>Игрок:</strong> ${getTelegramUserName()}
        </div>`;
    }
} else if (playerNameInput) {
    // Если не в Telegram, показываем поле ввода
    if (playerName) {
        playerNameInput.value = playerName;
    }
}

// Initial leaderboard load
updateLeaderboards();

// Start game loop
gameLoop();
