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

    // Показать сообщение об ошибке
    showError(message, duration = 5000) {
        console.error(message);

        // Создаём элемент для отображения ошибки
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(220, 53, 69, 0.95);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease;
            font-family: 'TT Firs Neue', sans-serif;
            font-size: 14px;
        `;

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => errorDiv.remove(), 300);
        }, duration);
    }

    // Показать сообщение об успехе
    showSuccess(message, duration = 3000) {
        console.log(message);

        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(40, 167, 69, 0.95);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease;
            font-family: 'TT Firs Neue', sans-serif;
            font-size: 14px;
        `;

        document.body.appendChild(successDiv);

        setTimeout(() => {
            successDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => successDiv.remove(), 300);
        }, duration);
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
