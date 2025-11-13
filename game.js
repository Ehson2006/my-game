// === Получение элементов ===
const canvas = document.getElementById('game-canvas');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const playBtn = document.getElementById('play-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('final-score');

let gameRunning = false;
let score = 0;
let animationId;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine') {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// === Игрок ===
const player = {
    x: 80,
    y: 0,
    width: 40,
    height: 40,
    velocityY: 0,
    gravity: 0.6,
    jumpPower: -14, // прыжок стал немного выше
    onGround: false,

    update() {
        this.velocityY += this.gravity;
        this.y += this.velocityY;

        const ground = canvas.height - 100;
        if (this.y >= ground - this.height) {
            this.y = ground - this.height;
            this.velocityY = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }
    },

    jump() {
        if (this.onGround) {
            this.velocityY = this.jumpPower;
            playSound(400, 0.1, 'square');
        }
    },

    draw() {
        ctx.fillStyle = '#667eea';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = 'white';
        ctx.fillRect(this.x + 10, this.y + 10, 8, 8);
        ctx.fillRect(this.x + 22, this.y + 10, 8, 8);
    }
};

// === Препятствия и монеты ===
const obstacles = [];
const coins = [];

let lastObstacleTime = 0;
let obstacleInterval = 1500;
let lastCoinTime = 0;
let coinInterval = 1200;
const MIN_OBSTACLE_GAP = 250;

// === Класс препятствия ===
class Obstacle {
    constructor() {
        this.width = 30 + Math.random() * 25;
        this.height = 40 + Math.random() * 40; // раньше было слишком большое — теперь сбалансировано
        this.x = canvas.width;
        this.y = canvas.height - 100 - this.height;
        this.speed = 4 + Math.min(score * 0.03, 6); // скорость растёт, но ограничена
    }

    update() {
        this.x -= this.speed;
    }

    draw() {
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    collidesWith(player) {
        return (
            player.x < this.x + this.width &&
            player.x + player.width > this.x &&
            player.y < this.y + this.height &&
            player.y + player.height > this.y
        );
    }
}

// === Класс монеты ===
class Coin {
    constructor() {
        this.radius = 15;
        this.x = canvas.width;
        this.y = canvas.height - 200 - Math.random() * 150;
        this.speed = 4 + Math.min(score * 0.03, 6);
        this.collected = false;
    }

    update() {
        this.x -= this.speed;
    }

    draw() {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffed4e';
        ctx.beginPath();
        ctx.arc(this.x - 3, this.y - 3, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    collidesWith(player) {
        const dx = this.x - (player.x + player.width / 2);
        const dy = this.y - (player.y + player.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.radius + 20;
    }
}

// === Фон, облака и земля ===
function drawGround() {
    ctx.fillStyle = '#90ee90';
    ctx.fillRect(0, canvas.height - 100, canvas.width, 100);

    ctx.fillStyle = '#228b22';
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.fillRect(i, canvas.height - 100, 30, 5);
    }
}

function drawClouds(offset) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const cloudPositions = [
        { x: 100 + offset * 0.3, y: 80 },
        { x: 300 + offset * 0.5, y: 120 },
        { x: 500 + offset * 0.2, y: 60 }
    ];

    cloudPositions.forEach(cloud => {
        const x = cloud.x % (canvas.width + 100);
        ctx.beginPath();
        ctx.arc(x, cloud.y, 30, 0, Math.PI * 2);
        ctx.arc(x + 25, cloud.y, 35, 0, Math.PI * 2);
        ctx.arc(x + 50, cloud.y, 30, 0, Math.PI * 2);
        ctx.fill();
    });
}

let cloudOffset = 0;

// === Главный цикл ===
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    cloudOffset++;
    drawClouds(cloudOffset);
    drawGround();

    player.update();
    player.draw();

    const now = Date.now();

    // Спавн препятствий
    if (now - lastObstacleTime > obstacleInterval) {
        const lastObstacle = obstacles[obstacles.length - 1];
        if (!lastObstacle || lastObstacle.x < canvas.width - MIN_OBSTACLE_GAP) {
            obstacles.push(new Obstacle());
            lastObstacleTime = now;
            obstacleInterval = 1300 + Math.random() * 1200;
        }
    }

    // Спавн монет
    if (now - lastCoinTime > coinInterval) {
        if (Math.random() < 0.7) {
            coins.push(new Coin());
        }
        lastCoinTime = now;
        coinInterval = 1000 + Math.random() * 1500;
    }

    // Обновление препятствий
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update();
        obs.draw();

        if (obs.collidesWith(player)) {
            gameOver();
            return;
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    // Обновление монет
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.update();
        coin.draw();

        if (!coin.collected && coin.collidesWith(player)) {
            coin.collected = true;
            score += 10;
            scoreDisplay.textContent = score;
            playSound(600, 0.15, 'sine');
            coins.splice(i, 1);
        } else if (coin.x + coin.radius < 0) {
            coins.splice(i, 1);
        }
    }

    animationId = requestAnimationFrame(gameLoop);
}

// === Управление игрой ===
function startGame() {
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    gameRunning = true;
    score = 0;
    scoreDisplay.textContent = score;
    obstacles.length = 0;
    coins.length = 0;
    player.y = canvas.height - 100 - player.height;
    player.velocityY = 0;
    cloudOffset = 0;
    lastObstacleTime = Date.now();
    lastCoinTime = Date.now();
    gameLoop();
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    playSound(200, 0.3, 'sawtooth');

    gameScreen.classList.remove('active');
    gameOverScreen.classList.add('active');
    finalScoreDisplay.textContent = score;
}

function restart() {
    gameOverScreen.classList.remove('active');
    startGame();
}

// === Управление (мышь + сенсор) ===
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning) player.jump();
});

canvas.addEventListener('click', () => {
    if (gameRunning) player.jump();
});

playBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restart);

playBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startGame();
});

restartBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    restart();
});
