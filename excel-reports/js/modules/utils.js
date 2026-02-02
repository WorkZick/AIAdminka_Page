// Utils - Утилиты и вспомогательные функции

class ExcelReportsUtils {
    // Поиск колонки по заголовку (case-insensitive)
    // headers - массив заголовков
    // possibleNames - массив возможных названий колонки
    findColumn(headers, possibleNames) {
        for (let i = 0; i < headers.length; i++) {
            const header = (headers[i] || '').toString().trim();
            for (const name of possibleNames) {
                if (header.toLowerCase() === name.toLowerCase()) {
                    return i;
                }
            }
        }
        return -1;
    }

    // Получить значение ячейки по индексу колонки
    getCellValue(row, colIndex, defaultValue = '') {
        if (!row || colIndex < 0 || colIndex >= row.length) {
            return defaultValue;
        }
        const value = row[colIndex];
        return value !== null && value !== undefined ? value : defaultValue;
    }

    // Проверка, что строка не пустая
    isRowEmpty(row) {
        if (!row || row.length === 0) return true;
        return row.every(cell => {
            const value = (cell || '').toString().trim();
            return value === '';
        });
    }

    // Форматирование даты для отображения
    formatDate(date) {
        if (!date) return '';
        if (date instanceof Date) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        }
        return date.toString();
    }

    // Форматирование числа с разделителем тысяч
    formatNumber(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return Number(num).toLocaleString('ru-RU', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    // Форматирование процента
    formatPercent(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) return '0%';
        return `${(value * 100).toFixed(decimals)}%`;
    }

    // Безопасное преобразование в число
    toNumber(value, defaultValue = 0) {
        if (value === null || value === undefined) return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
    }

    // Генерация уникального ID
    generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Debounce функция для оптимизации
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Глубокое клонирование объекта
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));

        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = this.deepClone(obj[key]);
            }
        }
        return clonedObj;
    }

    // Показать уведомление (универсальный метод)
    showNotification(message, type = 'info', duration = 4000) {
        // Удаляем предыдущие уведомления того же типа
        const existing = document.querySelectorAll(`.toast-notification.toast-${type}`);
        existing.forEach(el => el.remove());

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;

        // Иконки для разных типов
        const icons = {
            success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
            error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
            warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
            info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
        };

        const iconDiv = document.createElement('div');
        iconDiv.className = 'toast-icon';
        iconDiv.innerHTML = icons[type] || icons.info;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'toast-message';
        messageDiv.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        closeBtn.addEventListener('click', () => toast.remove());

        toast.appendChild(iconDiv);
        toast.appendChild(messageDiv);
        toast.appendChild(closeBtn);

        document.body.appendChild(toast);

        // Анимация появления
        requestAnimationFrame(() => toast.classList.add('show'));

        // Автоматическое скрытие
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Показать сообщение об ошибке
    showError(message, duration = 5000) {
        console.error(message);
        this.showNotification(message, 'error', duration);
    }

    // Показать сообщение об успехе
    showSuccess(message, duration = 3000) {
        console.log(message);
        this.showNotification(message, 'success', duration);
    }

    // Показать предупреждение
    showWarning(message, duration = 4000) {
        console.warn(message);
        this.showNotification(message, 'warning', duration);
    }

    // Показать информационное сообщение
    showInfo(message, duration = 3000) {
        console.log(message);
        this.showNotification(message, 'info', duration);
    }

    // Валидация email
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Экранирование HTML для безопасного отображения
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Получить расширение файла
    getFileExtension(fileName) {
        const parts = fileName.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    // Проверка, что файл Excel
    isExcelFile(fileName) {
        const ext = this.getFileExtension(fileName);
        return ['xlsx', 'xls'].includes(ext);
    }

    // Форматирование размера файла
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Логирование с временной меткой
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('ru-RU');
        const prefix = `[${timestamp}] [Excel Reports]`;

        switch (type) {
            case 'error':
                console.error(prefix, message);
                break;
            case 'warn':
                console.warn(prefix, message);
                break;
            default:
                console.log(prefix, message);
        }
    }
}

// Экспорт для использования в других модулях
window.ExcelReportsUtils = ExcelReportsUtils;
