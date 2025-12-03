// Logger for Excel Reports
const logger = {
    element: null,

    init() {
        this.element = document.getElementById('logs');
        this.log('Система логирования запущена', 'info');
    },

    log(message, type = 'info') {
        if (!this.element) {
            this.element = document.getElementById('logs');
        }

        const time = new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Remove empty state message
        const emptyState = this.element.querySelector('.log-empty');
        if (emptyState) {
            emptyState.remove();
        }

        const item = document.createElement('div');
        item.className = `log-item ${type}`;
        item.innerHTML = `
            <div class="log-time">${time}</div>
            <div class="log-message">${message}</div>
        `;
        this.element.appendChild(item);
        this.element.scrollTop = this.element.scrollHeight;

        console.log(`[ExcelReports] [${time}] ${message}`);
    },

    clear() {
        if (this.element) {
            this.element.innerHTML = '<div class="log-empty">Нет записей</div>';
        }
    }
};

// Initialize logger when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    logger.init();
});
