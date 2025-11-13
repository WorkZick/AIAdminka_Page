// Минимальная система логирования
class Logger {
    constructor() {
        this.logs = [];
        this.element = document.getElementById('logs');
        this.init();
    }

    init() {
        this.log('Система логирования запущена');
        this.setupButtons();
        this.setupToggle();
    }

    setupButtons() {
        const clearBtn = document.getElementById('clearLogsBtn');
        if (clearBtn) {
            clearBtn.onclick = () => this.clear();
        }
    }

    log(message, type = 'info') {
        const time = new Date().toLocaleTimeString();
        const icons = { 
            info: 'ℹ️', 
            success: '✅', 
            error: '❌', 
            warn: '⚠️' 
        };
        const entry = `${icons[type] || 'ℹ️'} [${time}] ${message}`;
        
        this.logs.push({ time, message, type, entry });
        this.element.textContent += entry + '\n';
        this.element.scrollTop = this.element.scrollHeight;
        
        console.log(`[ExcelReports] ${entry}`);
        
        // Автооткрытие логов при ошибке
        if (type === 'error') {
            const content = document.getElementById('logsContent');
            const toggle = document.getElementById('logsToggle');
            if (content && toggle && !content.classList.contains('show')) {
                content.classList.add('show');
                toggle.classList.add('expanded');
                setTimeout(() => {
                    this.element.scrollTop = this.element.scrollHeight;
                }, 100);
            }
        }
    }

    clear() {
        this.logs = [];
        this.element.textContent = '';
        this.log('Логи очищены');
    }

    setupToggle() {
        const toggle = document.getElementById('logsToggle');
        const content = document.getElementById('logsContent');
        
        if (toggle && content) {
            toggle.onclick = () => {
                const isExpanded = content.classList.contains('show');
                
                if (isExpanded) {
                    content.classList.remove('show');
                    toggle.classList.remove('expanded');
                } else {
                    content.classList.add('show');
                    toggle.classList.add('expanded');
                    setTimeout(() => {
                        this.element.scrollTop = this.element.scrollHeight;
                    }, 100);
                }
            };
        }
    }
}

const logger = new Logger();
