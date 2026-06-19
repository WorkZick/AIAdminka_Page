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
