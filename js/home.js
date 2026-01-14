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

        // Setup event listeners (replaces inline onclick)
        this.initEventListeners();
    },

    initEventListeners() {
        // Feedback card
        const feedbackCard = document.querySelector('.module-card-accent');
        if (feedbackCard) {
            feedbackCard.addEventListener('click', () => this.showTicketModal());
        }

        // Game card
        const gameCard = document.querySelector('.module-card-game');
        if (gameCard) {
            gameCard.addEventListener('click', () => this.showGameModal());
        }

        // Tickets drawer
        const ticketsOverlay = document.getElementById('ticketsOverlay');
        if (ticketsOverlay) {
            ticketsOverlay.addEventListener('click', () => this.toggleTicketsDrawer());
        }

        const ticketsToggle = document.getElementById('ticketsToggle');
        if (ticketsToggle) {
            ticketsToggle.addEventListener('click', () => this.toggleTicketsDrawer());
        }

        // Tickets refresh button
        const btnRefresh = document.querySelector('.btn-refresh');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => this.loadTickets());
        }

        // Tickets drawer close button
        const btnCloseDrawer = document.querySelector('.btn-close-drawer');
        if (btnCloseDrawer) {
            btnCloseDrawer.addEventListener('click', () => this.toggleTicketsDrawer());
        }

        // Ticket modal close buttons
        const ticketModalClose = document.querySelector('#ticketModal .modal-close');
        if (ticketModalClose) {
            ticketModalClose.addEventListener('click', () => this.closeTicketModal());
        }

        const btnCancelTicket = document.querySelector('#ticketModal .btn-secondary');
        if (btnCancelTicket) {
            btnCancelTicket.addEventListener('click', () => this.closeTicketModal());
        }

        const btnSubmitTicket = document.getElementById('btnSubmitTicket');
        if (btnSubmitTicket) {
            btnSubmitTicket.addEventListener('click', () => this.submitTicket());
        }

        // Ticket view modal close button
        const ticketViewClose = document.querySelector('#ticketViewModal .modal-close');
        if (ticketViewClose) {
            ticketViewClose.addEventListener('click', () => this.closeTicketViewModal());
        }

        // Game modal close button
        const gameModalClose = document.querySelector('#gameModal .modal-close');
        if (gameModalClose) {
            gameModalClose.addEventListener('click', () => this.closeGameModal());
        }

        // Game start button
        const btnStartGame = document.querySelector('#gameModal .btn-primary');
        if (btnStartGame && typeof pacmanGame !== 'undefined') {
            btnStartGame.addEventListener('click', () => pacmanGame.start());
        }
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

        // Show loading state
        listEl.textContent = '';
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'tickets-empty tickets-loading';
        loadingDiv.textContent = 'Загрузка...';
        listEl.appendChild(loadingDiv);

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
            listEl.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'tickets-empty';
            errorDiv.textContent = 'Не удалось загрузить';
            listEl.appendChild(errorDiv);
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

        // Clear existing content
        listEl.textContent = '';

        if (this.tickets.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'tickets-empty';
            emptyDiv.textContent = 'Нет обращений';
            listEl.appendChild(emptyDiv);
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

        // Create ticket cards using DOM API
        sorted.forEach(ticket => {
            const statusLabel = this.statusLabels[ticket.status] || ticket.status;
            const date = this.formatDate(ticket.createdAt);

            // Create ticket card
            const card = document.createElement('div');
            card.className = `ticket-card status-${ticket.status}`;
            card.addEventListener('click', () => this.viewTicket(ticket.id));

            // Header
            const header = document.createElement('div');
            header.className = 'ticket-card-header';

            const title = document.createElement('div');
            title.className = 'ticket-title';
            title.textContent = ticket.title;

            const status = document.createElement('span');
            status.className = `ticket-status status-${ticket.status}`;
            status.textContent = statusLabel;

            header.appendChild(title);
            header.appendChild(status);

            // Meta
            const meta = document.createElement('div');
            meta.className = 'ticket-meta';

            const author = document.createElement('span');
            author.className = 'ticket-author';
            author.textContent = ticket.authorName || ticket.authorEmail;

            const dateSpan = document.createElement('span');
            dateSpan.className = 'ticket-date';
            dateSpan.textContent = date;

            meta.appendChild(author);
            meta.appendChild(dateSpan);

            // Assemble card
            card.appendChild(header);
            card.appendChild(meta);
            listEl.appendChild(card);
        });
    },

    // ============ CREATE TICKET MODAL ============

    showTicketModal() {
        // Reset form
        document.getElementById('ticketTitle').value = '';
        document.getElementById('ticketDescription').value = '';
        document.getElementById('imagePreviews').textContent = '';
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
            Toast.warning('Максимум 3 изображения');
            return;
        }

        const filesToProcess = files.slice(0, canAdd);

        filesToProcess.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            if (file.size > 5 * 1024 * 1024) {
                Toast.warning('Файл слишком большой (макс. 5MB)');
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
        container.textContent = '';

        this.uploadedImages.forEach((img, index) => {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview';

            const imgEl = document.createElement('img');
            imgEl.src = img.preview;
            imgEl.alt = 'Preview';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'image-preview-remove';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => this.removeImage(index));

            previewDiv.appendChild(imgEl);
            previewDiv.appendChild(removeBtn);
            container.appendChild(previewDiv);
        });

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
            Toast.warning('Введите заголовок');
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
            Toast.success('Спасибо! Ваше обращение отправлено.');
            this.loadTickets();

        } catch (e) {
            console.error('Error creating ticket:', e);
            Toast.error('Ошибка: ' + e.message);
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

        const body = document.getElementById('ticketViewBody');
        body.textContent = '';

        // Description
        if (ticket.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'ticket-view-description';
            descDiv.textContent = ticket.description;
            body.appendChild(descDiv);
        }

        // Images
        if (ticket.images && ticket.images.length > 0) {
            const imagesDiv = document.createElement('div');
            imagesDiv.className = 'ticket-view-images';

            ticket.images.forEach(imgId => {
                const url = CloudStorage.getImageUrl(imgId);

                const imageDiv = document.createElement('div');
                imageDiv.className = 'ticket-view-image';
                imageDiv.dataset.imgId = imgId;
                imageDiv.addEventListener('click', (e) => this.openImage(e.currentTarget.dataset.imgId));

                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Screenshot';

                imageDiv.appendChild(img);
                imagesDiv.appendChild(imageDiv);
            });

            body.appendChild(imagesDiv);
        }

        // Meta
        const statusLabel = this.statusLabels[ticket.status] || ticket.status;
        const metaDiv = document.createElement('div');
        metaDiv.className = 'ticket-view-meta';

        const statusLine = document.createElement('div');
        const statusStrong = document.createElement('strong');
        statusStrong.textContent = 'Статус: ';
        statusLine.appendChild(statusStrong);
        statusLine.appendChild(document.createTextNode(statusLabel));

        const authorLine = document.createElement('div');
        const authorStrong = document.createElement('strong');
        authorStrong.textContent = 'Автор: ';
        authorLine.appendChild(authorStrong);
        authorLine.appendChild(document.createTextNode(ticket.authorName || ticket.authorEmail));

        const dateLine = document.createElement('div');
        const dateStrong = document.createElement('strong');
        dateStrong.textContent = 'Создан: ';
        dateLine.appendChild(dateStrong);
        dateLine.appendChild(document.createTextNode(this.formatDate(ticket.createdAt)));

        metaDiv.appendChild(statusLine);
        metaDiv.appendChild(authorLine);
        metaDiv.appendChild(dateLine);
        body.appendChild(metaDiv);

        // Comments
        if (ticket.comments && ticket.comments.length > 0) {
            const commentsDiv = document.createElement('div');
            commentsDiv.className = 'ticket-view-comments';

            const heading = document.createElement('h4');
            heading.textContent = 'Комментарии';
            commentsDiv.appendChild(heading);

            ticket.comments.forEach(comment => {
                const commentDiv = document.createElement('div');
                commentDiv.className = comment.isAdmin ? 'ticket-comment admin' : 'ticket-comment';

                const headerDiv = document.createElement('div');
                headerDiv.className = 'ticket-comment-header';

                const authorSpan = document.createElement('span');
                authorSpan.textContent = comment.authorName || comment.authorEmail;

                const dateSpan = document.createElement('span');
                dateSpan.textContent = this.formatDate(comment.createdAt);

                headerDiv.appendChild(authorSpan);
                headerDiv.appendChild(dateSpan);

                const textDiv = document.createElement('div');
                textDiv.className = 'ticket-comment-text';
                textDiv.textContent = comment.text;

                commentDiv.appendChild(headerDiv);
                commentDiv.appendChild(textDiv);
                commentsDiv.appendChild(commentDiv);
            });

            body.appendChild(commentsDiv);
        }

        // Footer with reply form
        const footer = document.getElementById('ticketViewFooter');
        footer.textContent = '';
        const isClosed = ticket.status === 'closed';

        if (isClosed) {
            footer.style.display = 'none';
        } else if (this.isAdmin) {
            footer.style.display = 'flex';

            const adminPanel = document.createElement('div');
            adminPanel.className = 'admin-panel';

            // Status select
            const statusSelect = document.createElement('select');
            statusSelect.className = 'form-select';
            statusSelect.id = 'ticketStatusSelect';
            statusSelect.addEventListener('change', () => this.changeTicketStatus());

            const statuses = [
                { value: 'new', label: 'Новый' },
                { value: 'in_progress', label: 'В работе' },
                { value: 'need_info', label: 'Нужна информация' },
                { value: 'resolved', label: 'Решено' },
                { value: 'closed', label: 'Закрыт' }
            ];

            statuses.forEach(status => {
                const option = document.createElement('option');
                option.value = status.value;
                option.textContent = status.label;
                option.selected = ticket.status === status.value;
                statusSelect.appendChild(option);
            });

            // Comment input
            const commentInputDiv = document.createElement('div');
            commentInputDiv.className = 'admin-comment-input';

            const commentInput = document.createElement('input');
            commentInput.type = 'text';
            commentInput.id = 'adminCommentInput';
            commentInput.placeholder = 'Написать комментарий...';

            const sendBtn = document.createElement('button');
            sendBtn.className = 'btn-primary';
            sendBtn.textContent = 'Отправить';
            sendBtn.addEventListener('click', () => this.addAdminComment());

            commentInputDiv.appendChild(commentInput);
            commentInputDiv.appendChild(sendBtn);

            adminPanel.appendChild(statusSelect);
            adminPanel.appendChild(commentInputDiv);
            footer.appendChild(adminPanel);
        } else {
            footer.style.display = 'flex';

            const userPanel = document.createElement('div');
            userPanel.className = 'user-reply-panel';

            const replyInput = document.createElement('input');
            replyInput.type = 'text';
            replyInput.id = 'userReplyInput';
            replyInput.className = 'form-input';
            replyInput.placeholder = 'Написать ответ...';

            const sendBtn = document.createElement('button');
            sendBtn.className = 'btn-primary';
            sendBtn.textContent = 'Отправить';
            sendBtn.addEventListener('click', () => this.addUserReply());

            userPanel.appendChild(replyInput);
            userPanel.appendChild(sendBtn);
            footer.appendChild(userPanel);
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
            Toast.error('Ошибка: ' + e.message);
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
            Toast.error('Ошибка: ' + e.message);
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
            Toast.error('Ошибка: ' + e.message);
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
    },

    openImage(imgId) {
        // Validate imgId - should only contain alphanumeric, dash, underscore
        if (!imgId || !/^[\w-]+$/.test(imgId)) {
            console.warn('Invalid image ID:', imgId);
            return;
        }
        window.open(`https://drive.google.com/file/d/${imgId}/view`, '_blank');
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize components
    ComponentLoader.init('shared');
    await ComponentLoader.load('sidebar', '#sidebar-container', {
        basePath: '.',
        activeModule: 'home'
    });
    await ComponentLoader.load('about-modal', '#about-modal-container', {
        basePath: '.'
    });
    SidebarController.init({ basePath: '.' });

    // Initialize app
    homeApp.init();

    // Initialize about modal after component is loaded
    initAboutModal();
});

// ============ ABOUT MODAL (Global functions) ============
function showAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.classList.add('active');
}

function closeAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.classList.remove('active');
}

function initAboutModal() {
    // Close button handler
    const closeBtn = document.querySelector('#aboutModal .modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAboutModal);
    }

    // Close by clicking overlay
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeAboutModal();
        });
    }

    // Close by Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('aboutModal');
            if (modal && modal.classList.contains('active')) {
                closeAboutModal();
            }
        }
    });

    // Version info click handler
    const versionInfo = document.querySelector('.version-info');
    if (versionInfo) {
        versionInfo.addEventListener('click', showAboutModal);
    }
}
