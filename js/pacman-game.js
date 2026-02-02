// Pac-Man Game - Image Hunt

// Game Configuration Constants
const GAME_CONFIG = {
    // Movement intervals (ms)
    HUNTER_MOVE_INTERVAL: 100,
    GHOST_MOVE_INTERVAL: 220,

    // Animation speeds
    LERP_SPEED: 0.15,
    GHOST_LERP_MULTIPLIER: 0.7,
    HUNTER_WOBBLE_SPEED: 0.1,
    GHOST_WOBBLE_SPEED: 0.12,
    LERP_MIN_DIFF: 0.01,

    // Collision & Scoring
    COLLISION_DISTANCE: 0.7,
    POINTS_PER_GHOST: 100,

    // AI Behavior
    GHOST_FLEE_CHANCE: 0.7,

    // Visual effects
    IMAGE_PADDING: 8,
    IMAGE_OFFSET: 4,
    HUNTER_PULSE_AMPLITUDE: 0.08,
    HUNTER_PULSE_MULTIPLIER: 2,
    HUNTER_GLOW_SIZE: 12,
    GHOST_SCALE_AMPLITUDE: 0.05,
    GHOST_SCALE_MULTIPLIER: 1.5,
    GHOST_GLOW_SIZE: 10,
    GHOST_WOBBLE_OFFSET: 2,

    // UI & Animations
    POPUP_DURATION: 1500,
    GRID_LINE_OPACITY: 0.03,

    // Font sizes (relative to cell size)
    HUNTER_FONT_SIZE: 0.5,
    GHOST_FONT_SIZE: 0.4,

    // Colors
    COLORS: {
        BACKGROUND: '#0d0d0d',
        WALL: '#2a2a2a',
        HUNTER: '#ffcc00',
        HUNTER_GLOW: '#ffcc00',
        TEXT: '#000',
        GHOST_TEXT: '#fff',
        GHOSTS: ['#ff6b6b', '#4dabf7', '#51cf66', '#ffa94d']
    }
};

const pacmanGame = {
    canvas: null,
    ctx: null,
    running: false,
    animationId: null,
    score: 0,
    cellSize: 40,
    gridSize: 16,
    lerpSpeed: GAME_CONFIG.LERP_SPEED,

    // Images (loaded from icons/game/ folder)
    images: {
        hunter: null,
        ghost0: null,
        ghost1: null,
        ghost2: null,
        ghost3: null
    },
    imagesLoaded: false,

    // Hunter (player)
    pacman: {
        x: 7, y: 7,
        visualX: 7, visualY: 7,
        direction: 0,
        nextDirection: null,
        wobble: 0
    },

    // Targets (ghosts)
    ghosts: [],

    // Walls
    walls: [],
    wallSet: new Set(),

    // Preload images from folder
    loadImages() {
        if (this.imagesLoaded) return Promise.resolve();

        const imagePaths = {
            hunter: 'icons/game/hunter.png',
            ghost0: 'icons/game/victim1.png',
            ghost1: 'icons/game/victim2.png',
            ghost2: 'icons/game/victim3.png',
            ghost3: 'icons/game/victim4.png'
        };

        const promises = Object.entries(imagePaths).map(([key, path]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    resolve();
                };
                img.onerror = () => resolve(); // Continue even if image not found
                img.src = path;
            });
        });

        return Promise.all(promises).then(() => {
            this.imagesLoaded = true;
        });
    },

    init() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.cellSize = this.canvas.width / this.gridSize;
        this.generateMaze();
        this.setupControls();
        this.loadImages();
    },

    generateMaze() {
        this.walls = [];
        this.wallSet = new Set();

        const addWall = (x, y) => {
            const key = `${x},${y}`;
            if (!this.wallSet.has(key)) {
                this.walls.push({ x, y });
                this.wallSet.add(key);
            }
        };

        // Border walls
        for (let i = 0; i < this.gridSize; i++) {
            addWall(i, 0);
            addWall(i, this.gridSize - 1);
            addWall(0, i);
            addWall(this.gridSize - 1, i);
        }

        // Maze pattern
        const maze = [
            // Top area
            [2,2], [3,2], [5,2], [6,2],
            [9,2], [10,2], [12,2], [13,2],
            [2,3], [6,3], [9,3], [13,3],
            [3,4], [4,4], [5,4], [6,4],
            [9,4], [10,4], [11,4], [12,4],

            // Middle area
            [2,6], [3,6], [4,6],
            [11,6], [12,6], [13,6],
            [2,7], [13,7],
            [2,8], [3,8], [4,8],
            [11,8], [12,8], [13,8],

            // Center
            [6,6], [7,6], [8,6], [9,6],
            [6,9], [7,9], [8,9], [9,9],

            // Bottom area
            [3,11], [4,11], [5,11], [6,11],
            [9,11], [10,11], [11,11], [12,11],
            [2,12], [6,12], [9,12], [13,12],
            [2,13], [3,13], [5,13], [6,13],
            [9,13], [10,13], [12,13], [13,13],
        ];

        maze.forEach(([x, y]) => addWall(x, y));
    },

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.running) return;

            let dir = null;
            switch (e.key) {
                case 'ArrowRight': dir = 0; break;
                case 'ArrowDown': dir = 1; break;
                case 'ArrowLeft': dir = 2; break;
                case 'ArrowUp': dir = 3; break;
            }

            if (dir !== null) {
                e.preventDefault();
                this.pacman.nextDirection = dir;
            }
        });
    },

    reset() {
        this.init();
        this.score = 0;
        this.pacman = {
            x: 7, y: 12,
            visualX: 7, visualY: 12,
            direction: 0,
            nextDirection: null,
            wobble: 0
        };

        // Initialize ghosts in corners
        this.ghosts = [
            { x: 1, y: 1, visualX: 1, visualY: 1, imageKey: 'ghost0', eaten: false, wobble: 0 },
            { x: 14, y: 1, visualX: 14, visualY: 1, imageKey: 'ghost1', eaten: false, wobble: Math.PI/2 },
            { x: 1, y: 14, visualX: 1, visualY: 14, imageKey: 'ghost2', eaten: false, wobble: Math.PI },
            { x: 14, y: 14, visualX: 14, visualY: 14, imageKey: 'ghost3', eaten: false, wobble: Math.PI*1.5 }
        ];

        this.updateUI();
        this.showOverlay('start');
        this.draw();
    },

    start() {
        this.hideOverlay();
        this.running = true;
        this.lastMoveTime = 0;
        this.lastGhostMoveTime = 0;
        this.lastFrameTime = 0;
        this.gameLoop();
    },

    stop() {
        this.running = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    // Smooth interpolation
    lerp(current, target, speed) {
        const diff = target - current;
        if (Math.abs(diff) < GAME_CONFIG.LERP_MIN_DIFF) return target;
        return current + diff * speed;
    },

    updateVisualPositions() {
        // Smooth hunter movement
        this.pacman.visualX = this.lerp(this.pacman.visualX, this.pacman.x, this.lerpSpeed);
        this.pacman.visualY = this.lerp(this.pacman.visualY, this.pacman.y, this.lerpSpeed);
        this.pacman.wobble = (this.pacman.wobble + GAME_CONFIG.HUNTER_WOBBLE_SPEED) % (Math.PI * 2);

        // Smooth ghost movement
        this.ghosts.forEach(ghost => {
            if (!ghost.eaten) {
                ghost.visualX = this.lerp(ghost.visualX, ghost.x, this.lerpSpeed * GAME_CONFIG.GHOST_LERP_MULTIPLIER);
                ghost.visualY = this.lerp(ghost.visualY, ghost.y, this.lerpSpeed * GAME_CONFIG.GHOST_LERP_MULTIPLIER);
                ghost.wobble = (ghost.wobble + GAME_CONFIG.GHOST_WOBBLE_SPEED) % (Math.PI * 2);
            }
        });
    },

    gameLoop(timestamp = 0) {
        if (!this.running) return;

        this.lastFrameTime = timestamp;

        // Update hunter movement
        if (timestamp - this.lastMoveTime > GAME_CONFIG.HUNTER_MOVE_INTERVAL) {
            this.movePacman();
            this.lastMoveTime = timestamp;
        }

        // Update ghost movement (slower)
        if (timestamp - this.lastGhostMoveTime > GAME_CONFIG.GHOST_MOVE_INTERVAL) {
            this.moveGhosts();
            this.lastGhostMoveTime = timestamp;
        }

        // Update smooth visual positions every frame
        this.updateVisualPositions();

        // Check collisions
        this.checkCollisions();

        // Draw
        this.draw();

        // Check win condition
        const aliveGhosts = this.ghosts.filter(g => !g.eaten);
        if (aliveGhosts.length === 0) {
            this.win();
            return;
        }

        this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    },

    /**
     * Обновить позицию охотника (pacman)
     *
     * @description
     * 1. Пытается сменить направление, если запрошено (nextDirection)
     * 2. Проверяет, свободна ли клетка перед сменой направления
     * 3. Двигается в текущем направлении, если нет стены
     */
    movePacman() {
        // Try to change direction if requested
        if (this.pacman.nextDirection !== null) {
            const nextPos = this.getNextPosition(this.pacman.x, this.pacman.y, this.pacman.nextDirection);
            if (!this.isWall(nextPos.x, nextPos.y)) {
                this.pacman.direction = this.pacman.nextDirection;
            }
            this.pacman.nextDirection = null;
        }

        // Move in current direction
        const next = this.getNextPosition(this.pacman.x, this.pacman.y, this.pacman.direction);
        if (!this.isWall(next.x, next.y)) {
            this.pacman.x = next.x;
            this.pacman.y = next.y;
        }
    },

    /**
     * Обновить позиции всех жертв (ghosts)
     *
     * @description
     * AI поведение: жертвы убегают от охотника
     * 1. Вычисляет все возможные ходы (не в стену)
     * 2. Оценивает расстояние до охотника после каждого хода
     * 3. С вероятностью 70% выбирает ход, максимально удаляющий от охотника
     * 4. С вероятностью 30% - случайный ход (добавляет непредсказуемость)
     */
    moveGhosts() {
        this.ghosts.forEach(ghost => {
            if (ghost.eaten) return;

            // Ghost runs AWAY from Pac-Man
            const dx = ghost.x - this.pacman.x;
            const dy = ghost.y - this.pacman.y;

            // Get all possible directions
            const directions = [0, 1, 2, 3];
            const validMoves = [];

            directions.forEach(dir => {
                const next = this.getNextPosition(ghost.x, ghost.y, dir);
                if (!this.isWall(next.x, next.y)) {
                    // Calculate distance from pacman after this move
                    const distX = next.x - this.pacman.x;
                    const distY = next.y - this.pacman.y;
                    const dist = Math.sqrt(distX * distX + distY * distY);
                    validMoves.push({ dir, next, dist });
                }
            });

            if (validMoves.length > 0) {
                // Sort by distance (prefer moves that increase distance from pacman)
                validMoves.sort((a, b) => b.dist - a.dist);

                // Add some randomness (70% chance to run away, 30% random)
                let chosen;
                if (Math.random() < GAME_CONFIG.GHOST_FLEE_CHANCE) {
                    chosen = validMoves[0]; // Best escape route
                } else {
                    chosen = validMoves[Math.floor(Math.random() * validMoves.length)];
                }

                ghost.x = chosen.next.x;
                ghost.y = chosen.next.y;
            }
        });
    },

    getNextPosition(x, y, direction) {
        switch (direction) {
            case 0: return { x: x + 1, y };
            case 1: return { x, y: y + 1 };
            case 2: return { x: x - 1, y };
            case 3: return { x, y: y - 1 };
        }
        return { x, y };
    },

    isWall(x, y) {
        return this.wallSet.has(`${x},${y}`);
    },

    checkCollisions() {
        this.ghosts.forEach(ghost => {
            if (ghost.eaten) return;

            // Check collision using visual proximity for smoother feel
            const dx = ghost.visualX - this.pacman.visualX;
            const dy = ghost.visualY - this.pacman.visualY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < GAME_CONFIG.COLLISION_DISTANCE) {
                // Pac-Man eats the ghost!
                ghost.eaten = true;
                this.score += GAME_CONFIG.POINTS_PER_GHOST;
                this.updateUI();
                this.showEatEffect(ghost);
            }
        });
    },

    // Phrases when eating competitors
    eatPhrases: [
        'Кто это?',
        'Ну шо вы, перцы?',
        'Щя',
        'Ну общайтесь, общайтесь'
    ],

    showEatEffect(ghost) {
        const container = document.getElementById('gameContainer');
        const colorIndex = parseInt(ghost.imageKey.replace('ghost', ''));

        // Random phrase popup
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = this.eatPhrases[Math.floor(Math.random() * this.eatPhrases.length)];
        popup.style.left = (ghost.visualX * this.cellSize + this.cellSize / 2) + 'px';
        popup.style.top = (ghost.visualY * this.cellSize) + 'px';
        popup.style.color = GAME_CONFIG.COLORS.GHOSTS[colorIndex];
        container.appendChild(popup);

        setTimeout(() => popup.remove(), GAME_CONFIG.POPUP_DURATION);
    },

    win() {
        this.running = false;
        this.showOverlay('win');
    },

    showOverlay(type) {
        const overlay = document.getElementById('gameOverlay');
        const message = document.getElementById('gameMessage');

        overlay.classList.remove('hidden');

        if (type === 'start') {
            message.innerHTML = `
                <h3>Охота за конкурентами!</h3>
                <p>Сожри всех конкурентов!</p>
                <p class="game-controls">Стрелки для управления</p>
                <button class="btn-primary" onclick="pacmanGame.start()">Начать охоту!</button>
            `;
        } else if (type === 'win') {
            const winPhrases = [
                'Рынок наш!',
                'Монополия достигнута!'
            ];
            message.innerHTML = `
                <h3>Победа!</h3>
                <p>${winPhrases[Math.floor(Math.random() * winPhrases.length)]}</p>
                <button class="btn-primary" onclick="pacmanGame.reset(); pacmanGame.start();">Играть снова</button>
            `;
        }
    },

    hideOverlay() {
        document.getElementById('gameOverlay').classList.add('hidden');
    },

    updateUI() {
        const scoreEl = document.getElementById('gameScore');
        const ghostsEl = document.getElementById('ghostsLeft');

        if (scoreEl) scoreEl.textContent = this.score;
        if (ghostsEl) ghostsEl.textContent = this.ghosts.filter(g => !g.eaten).length;
    },

    draw() {
        if (!this.ctx) return;

        const ctx = this.ctx;
        const size = this.cellSize;

        // Clear canvas
        ctx.fillStyle = GAME_CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw walls
        ctx.fillStyle = GAME_CONFIG.COLORS.WALL;
        this.walls.forEach(wall => {
            ctx.fillRect(wall.x * size + 1, wall.y * size + 1, size - 2, size - 2);
        });

        // Draw grid lines (subtle)
        ctx.strokeStyle = `rgba(255, 255, 255, ${GAME_CONFIG.GRID_LINE_OPACITY})`;
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * size, 0);
            ctx.lineTo(i * size, this.canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * size);
            ctx.lineTo(this.canvas.width, i * size);
            ctx.stroke();
        }

        // Draw ghosts
        this.ghosts.forEach(ghost => {
            if (ghost.eaten) return;
            this.drawGhost(ghost);
        });

        // Draw Pac-Man
        this.drawPacman();
    },

    drawPacman() {
        const ctx = this.ctx;
        const size = this.cellSize;
        const x = this.pacman.visualX * size;
        const y = this.pacman.visualY * size;
        const imgSize = size - GAME_CONFIG.IMAGE_PADDING;
        const offset = GAME_CONFIG.IMAGE_OFFSET;

        // Pulse animation
        const pulse = 1 + Math.abs(Math.sin(this.pacman.wobble * GAME_CONFIG.HUNTER_PULSE_MULTIPLIER)) * GAME_CONFIG.HUNTER_PULSE_AMPLITUDE;
        const pulseOffset = (imgSize * (pulse - 1)) / 2;

        ctx.save();

        // Glow effect
        ctx.shadowColor = GAME_CONFIG.COLORS.HUNTER_GLOW;
        ctx.shadowBlur = GAME_CONFIG.HUNTER_GLOW_SIZE;

        if (this.images.hunter) {
            // Draw uploaded image
            ctx.drawImage(
                this.images.hunter,
                x + offset - pulseOffset,
                y + offset - pulseOffset,
                imgSize * pulse,
                imgSize * pulse
            );
        } else {
            // Placeholder square
            ctx.fillStyle = GAME_CONFIG.COLORS.HUNTER;
            ctx.fillRect(
                x + offset - pulseOffset,
                y + offset - pulseOffset,
                imgSize * pulse,
                imgSize * pulse
            );
            // Question mark
            ctx.shadowBlur = 0;
            ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
            ctx.font = `bold ${size * GAME_CONFIG.HUNTER_FONT_SIZE}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', x + size / 2, y + size / 2);
        }

        ctx.restore();
    },

    drawGhost(ghost) {
        const ctx = this.ctx;
        const size = this.cellSize;
        const x = ghost.visualX * size;
        const y = ghost.visualY * size;
        const imgSize = size - GAME_CONFIG.IMAGE_PADDING;
        const offset = GAME_CONFIG.IMAGE_OFFSET;

        // Wobble animation
        const wobbleOffset = Math.sin(ghost.wobble) * GAME_CONFIG.GHOST_WOBBLE_OFFSET;
        const scale = 1 + Math.abs(Math.sin(ghost.wobble * GAME_CONFIG.GHOST_SCALE_MULTIPLIER)) * GAME_CONFIG.GHOST_SCALE_AMPLITUDE;
        const scaleOffset = (imgSize * (scale - 1)) / 2;

        const colorIndex = parseInt(ghost.imageKey.replace('ghost', ''));

        ctx.save();

        // Glow effect
        ctx.shadowColor = GAME_CONFIG.COLORS.GHOSTS[colorIndex];
        ctx.shadowBlur = GAME_CONFIG.GHOST_GLOW_SIZE;

        const img = this.images[ghost.imageKey];
        if (img) {
            // Draw uploaded image
            ctx.drawImage(
                img,
                x + offset - scaleOffset,
                y + offset + wobbleOffset - scaleOffset,
                imgSize * scale,
                imgSize * scale
            );
        } else {
            // Placeholder square
            ctx.fillStyle = GAME_CONFIG.COLORS.GHOSTS[colorIndex];
            ctx.fillRect(
                x + offset - scaleOffset,
                y + offset + wobbleOffset - scaleOffset,
                imgSize * scale,
                imgSize * scale
            );
            // Number
            ctx.shadowBlur = 0;
            ctx.fillStyle = GAME_CONFIG.COLORS.GHOST_TEXT;
            ctx.font = `bold ${size * GAME_CONFIG.GHOST_FONT_SIZE}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(colorIndex + 1, x + size / 2, y + size / 2 + wobbleOffset);
        }

        ctx.restore();
    }
};
