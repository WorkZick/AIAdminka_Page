// Home Page Application
const homeApp = {
    // State
    tickets: [],
    isAdmin: false,
    currentTicket: null,
    uploadedImages: [], // { file, preview, base64 }

    // Status labels
    statusLabels: {
        'new': 'Новый',
        'in_progress': 'В работе',
        'need_info': 'Нужна информация',
        'resolved': 'Решено',
        'closed': 'Закрыт'
    },

    // ============ INIT ============

    async init() {
        // Check if CloudStorage is available
        if (typeof CloudStorage !== 'undefined') {
            await CloudStorage.init();
            this.isAdmin = await this.checkIsAdmin();
            this.loadTickets();
        }

        // Initialize RoleGuard for role-based UI
        if (typeof RoleGuard !== 'undefined') {
            await RoleGuard.init();
        }

        // Setup image upload handler
        const imageInput = document.getElementById('imageInput');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        }

        // Setup modal close handlers
        this.setupModalHandlers();
    },

    setupModalHandlers() {
        // Close modals on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('active');
                }
            });
        });
    },

    // ============ SIDEBAR ============

    toggleSidebar() {
        // Delegate to SidebarController if available
        if (typeof SidebarController !== 'undefined') {
            SidebarController.toggle();
        } else {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
        }
    },

    // ============ ABOUT MODAL ============

    showAbout() {
        // Delegate to global function from about-modal component
        if (typeof showAboutModal === 'function') {
            showAboutModal();
        } else {
            const modal = document.getElementById('aboutModal');
            if (modal) modal.classList.add('active');
        }
    },

    closeAbout() {
        // Delegate to global function from about-modal component
        if (typeof closeAboutModal === 'function') {
            closeAboutModal();
        } else {
            const modal = document.getElementById('aboutModal');
            if (modal) modal.classList.remove('active');
        }
    },

    // ============ TICKETS ============

    async checkIsAdmin() {
        try {
            return await CloudStorage.checkIsAdmin();
        } catch (e) {
            console.error('Error checking admin status:', e);
            return false;
        }
    },

    async loadTickets() {
        const listEl = document.getElementById('ticketsList');
        const badge = document.getElementById('ticketsBadge');

        try {
            this.tickets = await CloudStorage.getTickets(false);
            this.renderTickets();

            // Update badge with count of active tickets
            const activeCount = this.tickets.filter(t =>
                t.status !== 'closed' && t.status !== 'resolved'
            ).length;

            if (activeCount > 0) {
                badge.textContent = activeCount > 99 ? '99+' : activeCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) {
            console.error('Error loading tickets:', e);
            listEl.innerHTML = '<div class="tickets-empty">Не удалось загрузить</div>';
        }
    },

    toggleTicketsDrawer() {
        const panel = document.getElementById('ticketsPanel');
        const overlay = document.getElementById('ticketsOverlay');
        const toggle = document.getElementById('ticketsToggle');

        panel.classList.toggle('open');
        overlay.classList.toggle('open');
        toggle.style.display = panel.classList.contains('open') ? 'none' : 'flex';
    },

    renderTickets() {
        const listEl = document.getElementById('ticketsList');

        if (this.tickets.length === 0) {
            listEl.innerHTML = '<div class="tickets-empty">Нет обращений</div>';
            return;
        }

        // Sort: new first, then by date desc
        const sorted = [...this.tickets].sort((a, b) => {
            // Closed/resolved at the end
            const aWeight = (a.status === 'closed' || a.status === 'resolved') ? 1 : 0;
            const bWeight = (b.status === 'closed' || b.status === 'resolved') ? 1 : 0;
            if (aWeight !== bWeight) return aWeight - bWeight;

            // Then by date
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        let html = '';
        sorted.forEach(ticket => {
            const statusLabel = this.statusLabels[ticket.status] || ticket.status;
            const date = this.formatDate(ticket.createdAt);

            html += `
                <div class="ticket-card status-${ticket.status}" onclick="homeApp.viewTicket('${ticket.id}')">
                    <div class="ticket-card-header">
                        <div class="ticket-title">${this.escapeHtml(ticket.title)}</div>
                        <span class="ticket-status status-${ticket.status}">${statusLabel}</span>
                    </div>
                    <div class="ticket-meta">
                        <span class="ticket-author">${this.escapeHtml(ticket.authorName || ticket.authorEmail)}</span>
                        <span class="ticket-date">${date}</span>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
    },

    // ============ CREATE TICKET MODAL ============

    showTicketModal() {
        // Reset form
        document.getElementById('ticketTitle').value = '';
        document.getElementById('ticketDescription').value = '';
        document.getElementById('imagePreviews').innerHTML = '';
        this.uploadedImages = [];
        this.updateImageUploadBtn();

        document.getElementById('ticketModal').classList.add('active');
    },

    closeTicketModal() {
        document.getElementById('ticketModal').classList.remove('active');
    },

    handleImageSelect(e) {
        const files = Array.from(e.target.files);
        const maxImages = 3;
        const currentCount = this.uploadedImages.length;
        const canAdd = maxImages - currentCount;

        if (canAdd <= 0) {
            alert('Максимум 3 изображения');
            return;
        }

        const filesToProcess = files.slice(0, canAdd);

        filesToProcess.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            if (file.size > 5 * 1024 * 1024) {
                alert('Файл ' + file.name + ' слишком большой (макс. 5MB)');
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                this.uploadedImages.push({
                    file: file,
                    preview: ev.target.result,
                    base64: ev.target.result
                });
                this.renderImagePreviews();
            };
            reader.readAsDataURL(file);
        });

        // Reset input
        e.target.value = '';
    },

    renderImagePreviews() {
        const container = document.getElementById('imagePreviews');
        let html = '';

        this.uploadedImages.forEach((img, index) => {
            html += `
                <div class="image-preview">
                    <img src="${img.preview}" alt="Preview">
                    <button class="image-preview-remove" onclick="homeApp.removeImage(${index})">&times;</button>
                </div>
            `;
        });

        container.innerHTML = html;
        this.updateImageUploadBtn();
    },

    removeImage(index) {
        this.uploadedImages.splice(index, 1);
        this.renderImagePreviews();
    },

    updateImageUploadBtn() {
        const btn = document.getElementById('imageUploadBtn');
        if (this.uploadedImages.length >= 3) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'flex';
        }
    },

    async submitTicket() {
        const title = document.getElementById('ticketTitle').value.trim();
        const description = document.getElementById('ticketDescription').value.trim();

        if (!title) {
            alert('Введите заголовок');
            return;
        }

        const btn = document.getElementById('btnSubmitTicket');
        btn.disabled = true;
        btn.textContent = 'Отправка...';

        try {
            // Upload images first
            const imageIds = [];
            for (const img of this.uploadedImages) {
                const result = await CloudStorage.uploadImage('tickets', 'ticket_' + Date.now() + '.jpg', img.base64);
                if (result.fileId) {
                    imageIds.push(result.fileId);
                }
            }

            // Create ticket
            await CloudStorage.createTicket({
                title: title,
                description: description,
                images: imageIds
            });

            this.closeTicketModal();
            alert('Спасибо! Ваше обращение отправлено.');
            this.loadTickets();

        } catch (e) {
            console.error('Error creating ticket:', e);
            alert('Ошибка: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Отправить';
        }
    },

    // ============ VIEW TICKET MODAL ============

    viewTicket(ticketId) {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        this.currentTicket = ticket;

        document.getElementById('ticketViewTitle').textContent = ticket.title;

        let bodyHtml = '';

        // Description
        if (ticket.description) {
            bodyHtml += `<div class="ticket-view-description">${this.escapeHtml(ticket.description)}</div>`;
        }

        // Images
        if (ticket.images && ticket.images.length > 0) {
            bodyHtml += '<div class="ticket-view-images">';
            ticket.images.forEach(imgId => {
                const url = CloudStorage.getImageUrl(imgId);
                bodyHtml += `
                    <div class="ticket-view-image" onclick="window.open('https://drive.google.com/file/d/${imgId}/view', '_blank')">
                        <img src="${url}" alt="Screenshot">
                    </div>
                `;
            });
            bodyHtml += '</div>';
        }

        // Meta
        const statusLabel = this.statusLabels[ticket.status] || ticket.status;
        bodyHtml += `
            <div class="ticket-view-meta">
                <strong>Статус:</strong> ${statusLabel}<br>
                <strong>Автор:</strong> ${this.escapeHtml(ticket.authorName || ticket.authorEmail)}<br>
                <strong>Создан:</strong> ${this.formatDate(ticket.createdAt)}
            </div>
        `;

        // Comments
        if (ticket.comments && ticket.comments.length > 0) {
            bodyHtml += '<div class="ticket-view-comments"><h4>Комментарии</h4>';
            ticket.comments.forEach(comment => {
                const isAdmin = comment.isAdmin ? ' admin' : '';
                bodyHtml += `
                    <div class="ticket-comment${isAdmin}">
                        <div class="ticket-comment-header">
                            <span>${this.escapeHtml(comment.authorName || comment.authorEmail)}</span>
                            <span>${this.formatDate(comment.createdAt)}</span>
                        </div>
                        <div class="ticket-comment-text">${this.escapeHtml(comment.text)}</div>
                    </div>
                `;
            });
            bodyHtml += '</div>';
        }

        document.getElementById('ticketViewBody').innerHTML = bodyHtml;

        // Footer with reply form
        const footer = document.getElementById('ticketViewFooter');
        const isClosed = ticket.status === 'closed';

        if (isClosed) {
            footer.style.display = 'none';
        } else if (this.isAdmin) {
            footer.style.display = 'flex';
            footer.innerHTML = `
                <div class="admin-panel">
                    <select class="form-select" id="ticketStatusSelect" onchange="homeApp.changeTicketStatus()">
                        <option value="new" ${ticket.status === 'new' ? 'selected' : ''}>Новый</option>
                        <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                        <option value="need_info" ${ticket.status === 'need_info' ? 'selected' : ''}>Нужна информация</option>
                        <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Решено</option>
                        <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>Закрыт</option>
                    </select>
                    <div class="admin-comment-input">
                        <input type="text" id="adminCommentInput" placeholder="Написать комментарий...">
                        <button class="btn-primary" onclick="homeApp.addAdminComment()">Отправить</button>
                    </div>
                </div>
            `;
        } else {
            footer.style.display = 'flex';
            footer.innerHTML = `
                <div class="user-reply-panel">
                    <input type="text" id="userReplyInput" class="form-input" placeholder="Написать ответ...">
                    <button class="btn-primary" onclick="homeApp.addUserReply()">Отправить</button>
                </div>
            `;
        }

        document.getElementById('ticketViewModal').classList.add('active');
    },

    closeTicketViewModal() {
        document.getElementById('ticketViewModal').classList.remove('active');
        this.currentTicket = null;
    },

    async changeTicketStatus() {
        if (!this.currentTicket) return;

        const newStatus = document.getElementById('ticketStatusSelect').value;

        try {
            await CloudStorage.updateTicketStatus(this.currentTicket.id, newStatus);
            this.currentTicket.status = newStatus;
            await this.loadTickets();
            // Re-render view modal
            this.viewTicket(this.currentTicket.id);
        } catch (e) {
            console.error('Error updating status:', e);
            alert('Ошибка: ' + e.message);
        }
    },

    async addAdminComment() {
        if (!this.currentTicket) return;

        const input = document.getElementById('adminCommentInput');
        const text = input.value.trim();

        if (!text) return;

        try {
            await CloudStorage.addTicketComment(this.currentTicket.id, text);
            input.value = '';
            await this.loadTickets();
            this.viewTicket(this.currentTicket.id);
        } catch (e) {
            console.error('Error adding comment:', e);
            alert('Ошибка: ' + e.message);
        }
    },

    async addUserReply() {
        if (!this.currentTicket) return;

        const input = document.getElementById('userReplyInput');
        const text = input.value.trim();

        if (!text) return;

        try {
            await CloudStorage.addTicketComment(this.currentTicket.id, text);
            input.value = '';
            await this.loadTickets();
            this.viewTicket(this.currentTicket.id);
        } catch (e) {
            console.error('Error adding reply:', e);
            alert('Ошибка: ' + e.message);
        }
    },

    // ============ GAME MODAL ============

    showGameModal() {
        document.getElementById('gameModal').classList.add('active');
        pacmanGame.reset();
    },

    closeGameModal() {
        document.getElementById('gameModal').classList.remove('active');
        pacmanGame.stop();
    },

    // ============ HELPERS ============

    formatDate(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    homeApp.init();
});

// ============ IMAGE HUNT GAME ============
const pacmanGame = {
    canvas: null,
    ctx: null,
    running: false,
    animationId: null,
    score: 0,
    cellSize: 40,
    gridSize: 16,
    lerpSpeed: 0.15,

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
        if (Math.abs(diff) < 0.01) return target;
        return current + diff * speed;
    },

    updateVisualPositions() {
        // Smooth hunter movement
        this.pacman.visualX = this.lerp(this.pacman.visualX, this.pacman.x, this.lerpSpeed);
        this.pacman.visualY = this.lerp(this.pacman.visualY, this.pacman.y, this.lerpSpeed);
        this.pacman.wobble = (this.pacman.wobble + 0.1) % (Math.PI * 2);

        // Smooth ghost movement
        this.ghosts.forEach(ghost => {
            if (!ghost.eaten) {
                ghost.visualX = this.lerp(ghost.visualX, ghost.x, this.lerpSpeed * 0.7);
                ghost.visualY = this.lerp(ghost.visualY, ghost.y, this.lerpSpeed * 0.7);
                ghost.wobble = (ghost.wobble + 0.12) % (Math.PI * 2);
            }
        });
    },

    gameLoop(timestamp = 0) {
        if (!this.running) return;

        this.lastFrameTime = timestamp;

        // Update hunter movement
        if (timestamp - this.lastMoveTime > 100) {
            this.movePacman();
            this.lastMoveTime = timestamp;
        }

        // Update ghost movement (slower)
        if (timestamp - this.lastGhostMoveTime > 220) {
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
                if (Math.random() < 0.7) {
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

            if (dist < 0.7) {
                // Pac-Man eats the ghost!
                ghost.eaten = true;
                this.score += 100;
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
        const colors = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffa94d'];
        const colorIndex = parseInt(ghost.imageKey.replace('ghost', ''));

        // Random phrase popup
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = this.eatPhrases[Math.floor(Math.random() * this.eatPhrases.length)];
        popup.style.left = (ghost.visualX * this.cellSize + this.cellSize / 2) + 'px';
        popup.style.top = (ghost.visualY * this.cellSize) + 'px';
        popup.style.color = colors[colorIndex];
        container.appendChild(popup);

        setTimeout(() => popup.remove(), 1500);
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
                'Рынок наш! 💪',
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
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw walls
        ctx.fillStyle = '#2a2a2a';
        this.walls.forEach(wall => {
            ctx.fillRect(wall.x * size + 1, wall.y * size + 1, size - 2, size - 2);
        });

        // Draw grid lines (subtle)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
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
        const imgSize = size - 8;
        const offset = 4;

        // Pulse animation
        const pulse = 1 + Math.abs(Math.sin(this.pacman.wobble * 2)) * 0.08;
        const pulseOffset = (imgSize * (pulse - 1)) / 2;

        ctx.save();

        // Glow effect
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 12;

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
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(
                x + offset - pulseOffset,
                y + offset - pulseOffset,
                imgSize * pulse,
                imgSize * pulse
            );
            // Question mark
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000';
            ctx.font = `bold ${size * 0.5}px Arial`;
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
        const imgSize = size - 8;
        const offset = 4;

        // Wobble animation
        const wobbleOffset = Math.sin(ghost.wobble) * 2;
        const scale = 1 + Math.abs(Math.sin(ghost.wobble * 1.5)) * 0.05;
        const scaleOffset = (imgSize * (scale - 1)) / 2;

        // Ghost colors for placeholders
        const placeholderColors = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffa94d'];
        const colorIndex = parseInt(ghost.imageKey.replace('ghost', ''));

        ctx.save();

        // Glow effect
        ctx.shadowColor = placeholderColors[colorIndex];
        ctx.shadowBlur = 10;

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
            ctx.fillStyle = placeholderColors[colorIndex];
            ctx.fillRect(
                x + offset - scaleOffset,
                y + offset + wobbleOffset - scaleOffset,
                imgSize * scale,
                imgSize * scale
            );
            // Number
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${size * 0.4}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(colorIndex + 1, x + size / 2, y + size / 2 + wobbleOffset);
        }

        ctx.restore();
    }
};
