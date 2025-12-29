// Инициализация Telegram Web App
let tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// Получение элементов
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const scoreDisplay = document.getElementById('scoreDisplay');
const finalScoreDisplay = document.getElementById('finalScore');

// Установка размера canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Игровые переменные
let gameState = 'start'; // 'start', 'playing', 'gameover'
let score = 0;
let frameCount = 0;

// Самолёт
const plane = {
    x: canvas.width * 0.2,
    y: canvas.height / 2,
    width: 40,
    height: 30,
    velocity: 0,
    gravity: 0.5,
    jumpPower: -8,
    rotation: 0
};

// Препятствия
const obstacles = [];
const obstacleWidth = 60;
const gapSize = 200;
const obstacleSpeed = 3;
let obstacleSpawnTimer = 0;
const obstacleSpawnInterval = 120;

// Звёзды для фона
const stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        opacity: Math.random() * 0.5 + 0.3,
        twinkle: Math.random() * Math.PI * 2
    });
}

// Облака для фона
const clouds = [];
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

// Функция рисования градиентного фона
function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0e27');
    gradient.addColorStop(0.5, '#1a3a5e');
    gradient.addColorStop(1, '#2d5a87');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Функция рисования звёзд
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

// Функция рисования облаков
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

// Функция рисования самолёта
function drawPlane() {
    ctx.save();
    ctx.translate(plane.x + plane.width / 2, plane.y + plane.height / 2);
    ctx.rotate(plane.rotation);
    
    // Корпус самолёта (футуристичный треугольник)
    ctx.fillStyle = '#00d4ff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00d4ff';
    
    ctx.beginPath();
    ctx.moveTo(0, -plane.height / 2);
    ctx.lineTo(plane.width / 2, plane.height / 2);
    ctx.lineTo(-plane.width / 2, plane.height / 2);
    ctx.closePath();
    ctx.fill();
    
    // Крылья
    ctx.fillStyle = '#0099cc';
    ctx.beginPath();
    ctx.moveTo(-plane.width * 0.3, plane.height * 0.2);
    ctx.lineTo(-plane.width * 0.8, plane.height * 0.5);
    ctx.lineTo(-plane.width * 0.3, plane.height * 0.4);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(plane.width * 0.3, plane.height * 0.2);
    ctx.lineTo(plane.width * 0.8, plane.height * 0.5);
    ctx.lineTo(plane.width * 0.3, plane.height * 0.4);
    ctx.closePath();
    ctx.fill();
    
    // Неоновые акценты
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -plane.height / 2);
    ctx.lineTo(plane.width / 2, plane.height / 2);
    ctx.lineTo(-plane.width / 2, plane.height / 2);
    ctx.closePath();
    ctx.stroke();
    
    ctx.restore();
}

// Функция рисования препятствия
function drawObstacle(obstacle) {
    const glowGradient = ctx.createLinearGradient(
        obstacle.x, 0,
        obstacle.x + obstacleWidth, 0
    );
    glowGradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
    glowGradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.8)');
    glowGradient.addColorStop(1, 'rgba(0, 212, 255, 0.3)');
    
    // Верхнее препятствие
    ctx.fillStyle = glowGradient;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00d4ff';
    ctx.fillRect(obstacle.x, 0, obstacleWidth, obstacle.topHeight);
    
    // Нижнее препятствие
    ctx.fillRect(
        obstacle.x,
        obstacle.topHeight + gapSize,
        obstacleWidth,
        canvas.height - (obstacle.topHeight + gapSize)
    );
    
    // Неоновые границы
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00d4ff';
    
    // Верхняя граница
    ctx.strokeRect(obstacle.x, 0, obstacleWidth, obstacle.topHeight);
    
    // Нижняя граница
    ctx.strokeRect(
        obstacle.x,
        obstacle.topHeight + gapSize,
        obstacleWidth,
        canvas.height - (obstacle.topHeight + gapSize)
    );
    
    // Энергетические эффекты
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 10;
    
    // Верхний эффект
    ctx.beginPath();
    ctx.moveTo(obstacle.x, obstacle.topHeight);
    ctx.lineTo(obstacle.x + obstacleWidth, obstacle.topHeight);
    ctx.stroke();
    
    // Нижний эффект
    ctx.beginPath();
    ctx.moveTo(obstacle.x, obstacle.topHeight + gapSize);
    ctx.lineTo(obstacle.x + obstacleWidth, obstacle.topHeight + gapSize);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
}

// Функция создания нового препятствия
function createObstacle() {
    const minHeight = 100;
    const maxHeight = canvas.height - gapSize - minHeight;
    const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
    
    obstacles.push({
        x: canvas.width,
        topHeight: topHeight,
        passed: false
    });
}

// Функция обновления самолёта
function updatePlane() {
    plane.velocity += plane.gravity;
    plane.y += plane.velocity;
    
    // Ограничение вращения
    plane.rotation = Math.max(-0.5, Math.min(0.5, plane.velocity * 0.05));
    
    // Проверка границ
    if (plane.y < 0) {
        plane.y = 0;
        plane.velocity = 0;
    }
    if (plane.y + plane.height > canvas.height) {
        plane.y = canvas.height - plane.height;
        gameOver();
    }
}

// Функция обновления препятствий
function updateObstacles() {
    obstacleSpawnTimer++;
    if (obstacleSpawnTimer >= obstacleSpawnInterval) {
        createObstacle();
        obstacleSpawnTimer = 0;
    }
    
    obstacles.forEach((obstacle, index) => {
        obstacle.x -= obstacleSpeed;
        
        // Проверка прохождения препятствия
        if (!obstacle.passed && obstacle.x + obstacleWidth < plane.x) {
            obstacle.passed = true;
            score++;
            scoreDisplay.textContent = score;
        }
        
        // Удаление препятствий за экраном
        if (obstacle.x + obstacleWidth < 0) {
            obstacles.splice(index, 1);
        }
        
        // Проверка столкновения
        if (
            plane.x < obstacle.x + obstacleWidth &&
            plane.x + plane.width > obstacle.x &&
            (plane.y < obstacle.topHeight || plane.y + plane.height > obstacle.topHeight + gapSize)
        ) {
            gameOver();
        }
    });
}

// Функция обновления облаков
function updateClouds() {
    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.width < 0) {
            cloud.x = canvas.width + cloud.width;
            cloud.y = Math.random() * canvas.height * 0.6;
        }
    });
}

// Функция прыжка
function jump() {
    if (gameState === 'playing') {
        plane.velocity = plane.jumpPower;
    }
}

// Функция начала игры
function startGame() {
    gameState = 'playing';
    score = 0;
    frameCount = 0;
    obstacles.length = 0;
    obstacleSpawnTimer = 0;
    
    plane.x = canvas.width * 0.2;
    plane.y = canvas.height / 2;
    plane.velocity = 0;
    plane.rotation = 0;
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    scoreDisplay.textContent = '0';
}

// Функция окончания игры
function gameOver() {
    if (gameState === 'playing') {
        gameState = 'gameover';
        finalScoreDisplay.textContent = score;
        gameOverScreen.classList.remove('hidden');
        scoreDisplay.classList.add('hidden');
        
        // Отправка счёта в Telegram (если доступно)
        if (tg) {
            tg.sendData(JSON.stringify({ score: score }));
        }
    }
}

// Основной игровой цикл
function gameLoop() {
    if (gameState === 'playing') {
        // Очистка canvas
        drawBackground();
        drawStars();
        drawClouds();
        
        // Обновление и отрисовка
        updateClouds();
        updatePlane();
        updateObstacles();
        
        obstacles.forEach(drawObstacle);
        drawPlane();
        
        frameCount++;
    }
    
    requestAnimationFrame(gameLoop);
}

// Обработчики событий
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

// Управление
canvas.addEventListener('click', jump);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        jump();
    }
});

// Запуск игрового цикла
gameLoop();

