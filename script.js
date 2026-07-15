const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
const canvas = document.getElementById('snake-canvas');
const scoreValue = document.getElementById('score-value');
const highScoreValue = document.getElementById('high-score-value');
const statusValue = document.getElementById('status-value');
const messageValue = document.getElementById('game-message');
const actionButtons = document.querySelectorAll('[data-action]');
const directionButtons = document.querySelectorAll('[data-direction]');
const ctx = canvas ? canvas.getContext('2d') : null;

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
}

const GRID = 20;
const BASE_SPEED = 130;
const STORAGE_KEY = 'loop-engineering-high-score';

const state = {
  snake: [],
  direction: { x: 1, y: 0 },
  nextDirection: { x: 1, y: 0 },
  food: { x: 0, y: 0 },
  score: 0,
  highScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
  status: 'idle',
  timerId: null,
  cellSize: 0,
};

function updateHud() {
  if (scoreValue) scoreValue.textContent = String(state.score);
  if (highScoreValue) highScoreValue.textContent = String(state.highScore);
  if (statusValue) {
    const labels = {
      idle: '대기',
      running: '진행 중',
      paused: '일시정지',
      gameover: '게임 오버',
    };
    statusValue.textContent = labels[state.status] || state.status;
  }
  if (messageValue) {
    const messages = {
      idle: '시작을 누르면 게임이 시작됩니다.',
      running: '방향키, WASD, 모바일 버튼으로 조작하세요.',
      paused: '일시정지 상태입니다. 다시 누르면 재개됩니다.',
      gameover: '게임 오버입니다. 재시작을 눌러 다시 시작하세요.',
    };
    messageValue.textContent = messages[state.status] || '';
  }
}

function resizeCanvas() {
  if (!canvas) return;
  const size = Math.min(canvas.clientWidth, 560);
  canvas.width = size;
  canvas.height = size;
  state.cellSize = canvas.width / GRID;
  draw();
}

function randomFood() {
  let food;
  do {
    food = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (state.snake.some((segment) => segment.x === food.x && segment.y === food.y));
  return food;
}

function resetGame() {
  state.snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ];
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };
  state.score = 0;
  state.food = randomFood();
  state.status = 'idle';
  stopTimer();
  updateHud();
  draw();
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer() {
  if (state.timerId) return;
  state.timerId = setInterval(tick, BASE_SPEED);
}

function startGame() {
  if (state.status === 'running') return;
  if (state.status === 'gameover' || state.status === 'idle') {
    resetGame();
  }
  state.status = 'running';
  startTimer();
  updateHud();
}

function pauseGame() {
  if (state.status !== 'running') return;
  state.status = 'paused';
  stopTimer();
  updateHud();
}

function resumeGame() {
  if (state.status !== 'paused') return;
  state.status = 'running';
  startTimer();
  updateHud();
}

function restartGame() {
  resetGame();
  startGame();
}

function setDirection(next) {
  const opposite = state.direction.x === -next.x && state.direction.y === -next.y;
  const queuedOpposite = state.nextDirection.x === -next.x && state.nextDirection.y === -next.y;
  if (opposite || queuedOpposite) return;
  state.nextDirection = next;
  if (state.status === 'idle') startGame();
}

function gameOver() {
  state.status = 'gameover';
  stopTimer();
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem(STORAGE_KEY, String(state.highScore));
  }
  updateHud();
  draw();
}

function tick() {
  if (state.status !== 'running') return;
  state.direction = state.nextDirection;

  const head = state.snake[0];
  const nextHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y,
  };
  const ateFood = nextHead.x === state.food.x && nextHead.y === state.food.y;

  const hitWall = nextHead.x < 0 || nextHead.x >= GRID || nextHead.y < 0 || nextHead.y >= GRID;
  const bodySegments = ateFood ? state.snake : state.snake.slice(0, -1);
  const hitBody = bodySegments.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
  if (hitWall || hitBody) {
    gameOver();
    return;
  }

  state.snake.unshift(nextHead);
  if (ateFood) {
    state.score += 1;
    state.food = randomFood();
  } else {
    state.snake.pop();
  }

  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem(STORAGE_KEY, String(state.highScore));
  }

  updateHud();
  draw();
}

function drawCell(x, y, fillStyle, radius = 6) {
  if (!ctx) return;
  const size = state.cellSize;
  const padding = size * 0.12;
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.roundRect(x * size + padding, y * size + padding, size - padding * 2, size - padding * 2, radius);
  ctx.fill();
}

function draw() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(3, 11, 13, 0.95)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i <= GRID; i += 1) {
    ctx.strokeStyle = 'rgba(112, 255, 181, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(i * state.cellSize, 0);
    ctx.lineTo(i * state.cellSize, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * state.cellSize);
    ctx.lineTo(canvas.width, i * state.cellSize);
    ctx.stroke();
  }

  drawCell(state.food.x, state.food.y, '#ff6f86', 999);
  state.snake.forEach((segment, index) => {
    drawCell(segment.x, segment.y, index === 0 ? '#73ffb6' : '#2ebd7c', 8);
  });
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();
  const mapping = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
  };

  if (key === ' ' || key === 'enter') {
    event.preventDefault();
    if (state.status === 'paused') {
      resumeGame();
    } else if (state.status === 'running') {
      pauseGame();
    } else {
      startGame();
    }
    return;
  }

  if (!mapping[key]) return;
  event.preventDefault();
  setDirection(mapping[key]);
}

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'start') {
      if (state.status === 'paused') {
        resumeGame();
      } else {
        startGame();
      }
    }
    if (action === 'pause') {
      if (state.status === 'running') pauseGame();
      else if (state.status === 'paused') resumeGame();
      else startGame();
    }
    if (action === 'restart') restartGame();
  });
});

directionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const directions = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    setDirection(directions[button.dataset.direction]);
  });
});

window.addEventListener('keydown', handleKeydown);
window.addEventListener('resize', resizeCanvas);

if (canvas && ctx) {
  if (typeof ctx.roundRect !== 'function') {
    ctx.roundRect = function roundRect(x, y, w, h, r) {
      const radius = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r;
      this.beginPath();
      this.moveTo(x + radius.tl, y);
      this.lineTo(x + w - radius.tr, y);
      this.quadraticCurveTo(x + w, y, x + w, y + radius.tr);
      this.lineTo(x + w, y + h - radius.br);
      this.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h);
      this.lineTo(x + radius.bl, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - radius.bl);
      this.lineTo(x, y + radius.tl);
      this.quadraticCurveTo(x, y, x + radius.tl, y);
      this.closePath();
    };
  }

  resetGame();
  resizeCanvas();
  updateHud();
}
