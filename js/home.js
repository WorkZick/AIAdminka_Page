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
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    },

    // ============ ABOUT MODAL ============

    showAbout() {
        document.getElementById('aboutModal').classList.add('active');
    },

    closeAbout() {
        document.getElementById('aboutModal').classList.remove('active');
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
