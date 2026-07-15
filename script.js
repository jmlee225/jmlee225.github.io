const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
const gameTabs = Array.from(document.querySelectorAll('[data-game-tab]'));
const gamePanels = Array.from(document.querySelectorAll('[data-game-panel]'));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const STORAGE_KEYS = {
  snake: 'loop-engineering-snake-high-score',
  poop: 'loop-engineering-poop-high-score',
};

function drawRoundRect(ctx, x, y, width, height, radius) {
  const r = typeof radius === 'number'
    ? { tl: radius, tr: radius, br: radius, bl: radius }
    : radius;

  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + width - r.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr);
  ctx.lineTo(x + width, y + height - r.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
  ctx.lineTo(x + r.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
}

class SnakeGame {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#snake-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.scoreEl = root.querySelector('#snake-score');
    this.highScoreEl = root.querySelector('#snake-high-score');
    this.statusEl = root.querySelector('#snake-status');
    this.messageEl = root.querySelector('#snake-message');
    this.actionButtons = Array.from(root.querySelectorAll('[data-snake-action]'));
    this.directionButtons = Array.from(root.querySelectorAll('[data-snake-direction]'));
    this.highScore = Number(localStorage.getItem(STORAGE_KEYS.snake) || 0);
    this.state = {
      snake: [],
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      food: { x: 0, y: 0 },
      score: 0,
      status: 'idle',
      timerId: null,
      cellSize: 0,
    };

    this.bindControls();
    this.reset();
  }

  bindControls() {
    this.actionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.snakeAction;
        if (action === 'start') {
          this.start();
        } else if (action === 'pause') {
          if (this.state.status === 'running') this.pause();
          else if (this.state.status === 'paused') this.resume();
          else this.start();
        } else if (action === 'restart') {
          this.restart();
        }
      });
    });

    this.directionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const directions = {
          up: { x: 0, y: -1 },
          down: { x: 0, y: 1 },
          left: { x: -1, y: 0 },
          right: { x: 1, y: 0 },
        };
        this.setDirection(directions[button.dataset.snakeDirection]);
      });
    });
  }

  updateHud() {
    if (this.scoreEl) this.scoreEl.textContent = String(this.state.score);
    if (this.highScoreEl) this.highScoreEl.textContent = String(this.highScore);
    if (this.statusEl) {
      const labels = {
        idle: '대기',
        running: '진행',
        paused: '일시정지',
        gameover: '게임 오버',
      };
      this.statusEl.textContent = labels[this.state.status] || this.state.status;
    }
    if (this.messageEl) {
      const messages = {
        idle: '방향키나 WASD를 누르면 시작합니다.',
        running: '방향키 또는 WASD로 이동하세요.',
        paused: '일시정지 상태입니다. 다시 시작하거나 스페이스를 누르세요.',
        gameover: '충돌했습니다. 재시작으로 다시 도전하세요.',
      };
      this.messageEl.textContent = messages[this.state.status] || '';
    }
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const size = Math.max(1, Math.floor(this.canvas.clientWidth));
    this.canvas.width = size;
    this.canvas.height = size;
    this.state.cellSize = size / 20;
    this.draw();
  }

  randomFood() {
    let food;
    do {
      food = {
        x: Math.floor(Math.random() * 20),
        y: Math.floor(Math.random() * 20),
      };
    } while (this.state.snake.some((segment) => segment.x === food.x && segment.y === food.y));
    return food;
  }

  stopTimer() {
    if (this.state.timerId) {
      clearInterval(this.state.timerId);
      this.state.timerId = null;
    }
  }

  startTimer() {
    if (this.state.timerId) return;
    this.state.timerId = setInterval(() => this.tick(), 130);
  }

  reset() {
    this.stopTimer();
    this.state.snake = [
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
    ];
    this.state.direction = { x: 1, y: 0 };
    this.state.nextDirection = { x: 1, y: 0 };
    this.state.food = this.randomFood();
    this.state.score = 0;
    this.state.status = 'idle';
    this.updateHud();
    this.draw();
  }

  start() {
    if (this.state.status === 'running') return;
    if (this.state.status === 'idle' || this.state.status === 'gameover') {
      this.reset();
    }
    this.state.status = 'running';
    this.startTimer();
    this.updateHud();
  }

  pause() {
    if (this.state.status !== 'running') return;
    this.state.status = 'paused';
    this.stopTimer();
    this.updateHud();
  }

  resume() {
    if (this.state.status !== 'paused') return;
    this.state.status = 'running';
    this.startTimer();
    this.updateHud();
  }

  restart() {
    this.reset();
    this.start();
  }

  setDirection(next) {
    if (!next) return;
    const oppositeCurrent = this.state.direction.x === -next.x && this.state.direction.y === -next.y;
    const oppositeQueued = this.state.nextDirection.x === -next.x && this.state.nextDirection.y === -next.y;
    if (oppositeCurrent || oppositeQueued) return;
    this.state.nextDirection = next;
    if (this.state.status === 'idle') this.start();
  }

  gameOver() {
    this.state.status = 'gameover';
    this.stopTimer();
    if (this.state.score > this.highScore) {
      this.highScore = this.state.score;
      localStorage.setItem(STORAGE_KEYS.snake, String(this.highScore));
    }
    this.updateHud();
    this.draw();
  }

  tick() {
    if (this.state.status !== 'running') return;

    this.state.direction = this.state.nextDirection;
    const head = this.state.snake[0];
    const nextHead = {
      x: head.x + this.state.direction.x,
      y: head.y + this.state.direction.y,
    };
    const ateFood = nextHead.x === this.state.food.x && nextHead.y === this.state.food.y;
    const hitWall = nextHead.x < 0 || nextHead.x >= 20 || nextHead.y < 0 || nextHead.y >= 20;
    const bodySegments = ateFood ? this.state.snake : this.state.snake.slice(0, -1);
    const hitBody = bodySegments.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);

    if (hitWall || hitBody) {
      this.gameOver();
      return;
    }

    this.state.snake.unshift(nextHead);

    if (ateFood) {
      this.state.score += 1;
      this.state.food = this.randomFood();
    } else {
      this.state.snake.pop();
    }

    if (this.state.score > this.highScore) {
      this.highScore = this.state.score;
      localStorage.setItem(STORAGE_KEYS.snake, String(this.highScore));
    }

    this.updateHud();
    this.draw();
  }

  drawCell(x, y, fillStyle, radius = 8) {
    if (!this.ctx) return;
    const size = this.state.cellSize;
    const padding = size * 0.12;
    this.ctx.fillStyle = fillStyle;
    drawRoundRect(this.ctx, x * size + padding, y * size + padding, size - padding * 2, size - padding * 2, radius);
    this.ctx.fill();
  }

  draw() {
    if (!this.canvas || !this.ctx || !this.state.cellSize) return;
    const { width, height } = this.canvas;

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = 'rgba(3, 11, 13, 0.96)';
    this.ctx.fillRect(0, 0, width, height);

    for (let i = 0; i <= 20; i += 1) {
      this.ctx.strokeStyle = 'rgba(115, 255, 182, 0.08)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(i * this.state.cellSize, 0);
      this.ctx.lineTo(i * this.state.cellSize, height);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * this.state.cellSize);
      this.ctx.lineTo(width, i * this.state.cellSize);
      this.ctx.stroke();
    }

    this.drawCell(this.state.food.x, this.state.food.y, '#ff6f86', 999);
    this.state.snake.forEach((segment, index) => {
      this.drawCell(segment.x, segment.y, index === 0 ? '#73ffb6' : '#2ebd7c', 8);
    });
  }
}

class PoopGame {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#poop-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.scoreEl = root.querySelector('#poop-score');
    this.highScoreEl = root.querySelector('#poop-high-score');
    this.levelEl = root.querySelector('#poop-level');
    this.statusEl = root.querySelector('#poop-status');
    this.messageEl = root.querySelector('#poop-message');
    this.actionButtons = Array.from(root.querySelectorAll('[data-poop-action]'));
    this.moveButtons = Array.from(root.querySelectorAll('[data-poop-move]'));
    this.highScore = Number(localStorage.getItem(STORAGE_KEYS.poop) || 0);
    this.state = {
      playerX: 0,
      playerY: 0,
      playerWidth: 28,
      playerHeight: 56,
      poop: [],
      score: 0,
      level: 1,
      status: 'idle',
      frameId: null,
      lastTimestamp: 0,
      spawnTimer: 0,
      elapsed: 0,
      width: 0,
      height: 0,
    };

    this.bindControls();
    this.reset();
  }

  bindControls() {
    this.actionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.poopAction;
        if (action === 'start') {
          this.start();
        } else if (action === 'pause') {
          if (this.state.status === 'running') this.pause();
          else if (this.state.status === 'paused') this.resume();
          else this.start();
        } else if (action === 'restart') {
          this.restart();
        }
      });
    });

    this.moveButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const move = button.dataset.poopMove;
        this.movePlayer(move === 'left' ? -1 : 1);
      });
    });
  }

  updateHud() {
    if (this.scoreEl) this.scoreEl.textContent = String(this.state.score);
    if (this.highScoreEl) this.highScoreEl.textContent = String(this.highScore);
    if (this.levelEl) this.levelEl.textContent = String(this.state.level);
    if (this.statusEl) {
      const labels = {
        idle: '대기',
        running: '진행',
        paused: '일시정지',
        gameover: '게임 오버',
      };
      this.statusEl.textContent = labels[this.state.status] || this.state.status;
    }
    if (this.messageEl) {
      const messages = {
        idle: '좌우 버튼이나 방향키로 졸라맨을 움직이세요.',
        running: '피한 똥 1개당 1점이 쌓입니다. 뒤로 갈수록 더 빠르고 많이 떨어집니다.',
        paused: '일시정지 상태입니다. 다시 시작하거나 스페이스를 누르세요.',
        gameover: '똥에 맞았습니다. 재시작으로 다시 도전하세요.',
      };
      this.messageEl.textContent = messages[this.state.status] || '';
    }
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight));
    this.canvas.width = width;
    this.canvas.height = height;
    this.state.width = width;
    this.state.height = height;
    this.state.playerY = height - 56;
    this.state.playerWidth = Math.max(22, Math.round(width * 0.045));
    this.state.playerHeight = Math.max(48, Math.round(height * 0.14));
    this.state.playerX = clamp(this.state.playerX || width / 2, this.state.playerWidth, width - this.state.playerWidth);
    this.draw();
  }

  stopLoop() {
    if (this.state.frameId) {
      cancelAnimationFrame(this.state.frameId);
      this.state.frameId = null;
    }
  }

  reset() {
    this.stopLoop();
    this.state.poop = [];
    this.state.score = 0;
    this.state.level = 1;
    this.state.status = 'idle';
    this.state.lastTimestamp = 0;
    this.state.spawnTimer = 0;
    this.state.elapsed = 0;
    this.state.playerX = this.state.width ? this.state.width / 2 : 0;
    this.updateHud();
    this.draw();
  }

  start() {
    if (this.state.status === 'running') return;
    if (this.state.status === 'idle' || this.state.status === 'gameover') {
      this.reset();
    }
    this.state.status = 'running';
    this.state.lastTimestamp = performance.now();
    this.updateHud();
    this.scheduleFrame();
  }

  pause() {
    if (this.state.status !== 'running') return;
    this.state.status = 'paused';
    this.stopLoop();
    this.updateHud();
  }

  resume() {
    if (this.state.status !== 'paused') return;
    this.state.status = 'running';
    this.state.lastTimestamp = performance.now();
    this.updateHud();
    this.scheduleFrame();
  }

  restart() {
    this.reset();
    this.start();
  }

  scheduleFrame() {
    if (this.state.frameId || this.state.status !== 'running') return;
    this.state.frameId = requestAnimationFrame((timestamp) => this.frame(timestamp));
  }

  frame(timestamp) {
    if (this.state.status !== 'running') {
      this.state.frameId = null;
      return;
    }

    const delta = Math.min(40, timestamp - this.state.lastTimestamp || 16);
    this.state.lastTimestamp = timestamp;
    this.update(delta);
    this.draw();
    if (this.state.status !== 'running') {
      this.state.frameId = null;
      return;
    }
    this.state.frameId = requestAnimationFrame((nextTimestamp) => this.frame(nextTimestamp));
  }

  currentLevel() {
    return 1 + Math.floor(this.state.score / 5) + Math.floor(this.state.elapsed / 8000);
  }

  spawnInterval() {
    return Math.max(280, 1100 - (this.currentLevel() - 1) * 95);
  }

  spawnPoop() {
    const size = 18 + Math.random() * 12;
    const x = size / 2 + Math.random() * (this.state.width - size);
    const speed = 170 + this.currentLevel() * 18 + Math.random() * 28;
    this.state.poop.push({
      x,
      y: -size,
      size,
      speed,
    });
  }

  movePlayer(direction) {
    if (!direction) return;
    if (this.state.status === 'idle' || this.state.status === 'gameover') {
      this.reset();
      this.state.status = 'running';
      this.state.lastTimestamp = performance.now();
      this.updateHud();
      this.scheduleFrame();
    }

    if (this.state.status !== 'running') return;

    const step = Math.max(20, Math.round(this.state.width * 0.055));
    this.state.playerX = clamp(
      this.state.playerX + step * direction,
      this.state.playerWidth,
      this.state.width - this.state.playerWidth,
    );
    this.draw();
  }

  gameOver() {
    this.state.status = 'gameover';
    this.stopLoop();
    if (this.state.score > this.highScore) {
      this.highScore = this.state.score;
      localStorage.setItem(STORAGE_KEYS.poop, String(this.highScore));
    }
    this.updateHud();
    this.draw();
  }

  update(delta) {
    this.state.elapsed += delta;
    this.state.level = this.currentLevel();

    this.state.spawnTimer += delta;
    const interval = this.spawnInterval();
    while (this.state.spawnTimer >= interval) {
      this.state.spawnTimer -= interval;
      this.spawnPoop();
    }

    const player = this.playerRect();
    const nextPoop = [];

    for (const poop of this.state.poop) {
      poop.y += poop.speed * (delta / 1000);
      const poopRect = this.poopRect(poop);

      if (this.intersects(player, poopRect)) {
        this.gameOver();
        return;
      }

      if (poop.y - poop.size / 2 > this.state.height + 12) {
        this.state.score += 1;
      } else {
        nextPoop.push(poop);
      }
    }

    this.state.poop = nextPoop;

    if (this.state.score > this.highScore) {
      this.highScore = this.state.score;
      localStorage.setItem(STORAGE_KEYS.poop, String(this.highScore));
    }

    this.state.level = this.currentLevel();
    this.updateHud();
  }

  playerRect() {
    return {
      x: this.state.playerX - this.state.playerWidth,
      y: this.state.playerY - this.state.playerHeight,
      width: this.state.playerWidth * 2,
      height: this.state.playerHeight * 2,
    };
  }

  poopRect(poop) {
    return {
      x: poop.x - poop.size / 2,
      y: poop.y - poop.size / 2,
      width: poop.size,
      height: poop.size * 1.05,
    };
  }

  intersects(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  drawStickFigure(ctx, x, groundY) {
    const headY = groundY - this.state.playerHeight * 1.25;
    const torsoY = groundY - this.state.playerHeight * 0.45;
    const armY = groundY - this.state.playerHeight * 0.95;
    const legY = groundY;

    ctx.save();
    ctx.strokeStyle = '#73ffb6';
    ctx.fillStyle = '#73ffb6';
    ctx.lineWidth = Math.max(3, Math.round(this.state.width * 0.007));
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(x, headY, this.state.playerHeight * 0.22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, headY + this.state.playerHeight * 0.22);
    ctx.lineTo(x, torsoY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, armY);
    ctx.lineTo(x - this.state.playerHeight * 0.32, armY + this.state.playerHeight * 0.08);
    ctx.moveTo(x, armY);
    ctx.lineTo(x + this.state.playerHeight * 0.32, armY + this.state.playerHeight * 0.08);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, torsoY);
    ctx.lineTo(x - this.state.playerHeight * 0.24, legY);
    ctx.moveTo(x, torsoY);
    ctx.lineTo(x + this.state.playerHeight * 0.24, legY);
    ctx.stroke();

    ctx.restore();
  }

  drawPoop(ctx, poop) {
    const radius = poop.size / 2;
    const x = poop.x;
    const y = poop.y;
    ctx.save();
    ctx.fillStyle = '#8b5a2b';
    ctx.strokeStyle = '#5f3a18';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 0.95, radius * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.35, y - radius * 0.8);
    ctx.quadraticCurveTo(x, y - radius * 1.2, x + radius * 0.35, y - radius * 0.8);
    ctx.stroke();
    ctx.restore();
  }

  draw() {
    if (!this.canvas || !this.ctx || !this.state.width || !this.state.height) return;
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const groundY = height - 28;

    ctx.clearRect(0, 0, width, height);

    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#07151a');
    background.addColorStop(1, '#02090b');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(115, 255, 182, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 28) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(115, 255, 182, 0.04)';
    ctx.fillRect(0, groundY, width, height - groundY);

    ctx.strokeStyle = 'rgba(115, 255, 182, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    const playerCenterX = clamp(this.state.playerX || width / 2, this.state.playerWidth, width - this.state.playerWidth);
    this.drawStickFigure(ctx, playerCenterX, groundY);

    this.state.poop.forEach((poop) => this.drawPoop(ctx, poop));

    if (this.state.status === 'idle') {
      ctx.save();
      ctx.fillStyle = 'rgba(231, 255, 240, 0.84)';
      ctx.font = '600 18px Inter, Noto Sans KR, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('좌우 버튼이나 방향키로 시작하세요.', width / 2, height / 2 - 8);
      ctx.fillStyle = 'rgba(158, 189, 173, 0.84)';
      ctx.font = '14px Inter, Noto Sans KR, sans-serif';
      ctx.fillText('피한 똥 하나당 1점. 뒤로 갈수록 더 어려워집니다.', width / 2, height / 2 + 18);
      ctx.restore();
    }

    if (this.state.status === 'gameover') {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ff7c93';
      ctx.font = '700 24px Inter, Noto Sans KR, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('게임 오버', width / 2, height / 2 - 10);
      ctx.fillStyle = '#e7fff0';
      ctx.font = '15px Inter, Noto Sans KR, sans-serif';
      ctx.fillText('재시작을 누르면 다시 도전할 수 있습니다.', width / 2, height / 2 + 16);
      ctx.restore();
    }
  }
}

const games = {
  snake: new SnakeGame(document.querySelector('#panel-snake')),
  poop: new PoopGame(document.querySelector('#panel-poop')),
};

let activeGameKey = 'snake';

function activateGameTab(nextKey) {
  if (!games[nextKey]) return;

  activeGameKey = nextKey;

  gameTabs.forEach((button) => {
    const isActive = button.dataset.gameTab === nextKey;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  gamePanels.forEach((panel) => {
    panel.hidden = panel.dataset.gamePanel !== nextKey;
  });

  games[nextKey].resize();
}

gameTabs.forEach((button) => {
  button.addEventListener('click', () => activateGameTab(button.dataset.gameTab));
});

function activeGame() {
  return games[activeGameKey];
}

window.addEventListener('keydown', (event) => {
  const game = activeGame();
  if (!game || typeof game.handleKeydown !== 'function') return;
  if (game.handleKeydown(event)) {
    event.preventDefault();
  }
});

window.addEventListener('resize', () => {
  const game = activeGame();
  if (game && typeof game.resize === 'function') {
    game.resize();
  }
});

SnakeGame.prototype.handleKeydown = function handleSnakeKeydown(event) {
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
    if (this.state.status === 'paused') {
      this.resume();
    } else if (this.state.status === 'running') {
      this.pause();
    } else {
      this.start();
    }
    return true;
  }

  if (!mapping[key]) return false;
  this.setDirection(mapping[key]);
  return true;
};

PoopGame.prototype.handleKeydown = function handlePoopKeydown(event) {
  const key = event.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    this.movePlayer(-1);
    return true;
  }
  if (key === 'arrowright' || key === 'd') {
    this.movePlayer(1);
    return true;
  }
  if (key === ' ' || key === 'enter') {
    if (this.state.status === 'paused') {
      this.resume();
    } else if (this.state.status === 'running') {
      this.pause();
    } else {
      this.start();
    }
    return true;
  }
  return false;
};

activateGameTab('snake');
