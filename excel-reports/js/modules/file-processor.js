// FileProcessor - Обработка Excel файлов

class FileProcessor {
    constructor(utils) {
        this.utils = utils; // Ссылка на Utils для поиска колонок и валидации
    }

    // Универсальная загрузка файлов с валидацией
    async loadFiles(files, config, onProgress = null) {
        const results = [];
        const total = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Вызываем callback прогресса
            if (onProgress) {
                onProgress(i + 1, total, file.name);
            }

            try {
                const result = await this.loadSingleFile(file, config);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    fileName: file.name,
                    error: error.message
                });
            }
        }

        return results;
    }

    // Загрузка одного файла
    async loadSingleFile(file, config) {
        // Проверяем расширение
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            throw new Error('Неверный формат файла. Поддерживаются только .xlsx и .xls');
        }

        // Читаем Excel файл
        const data = await this.readExcelFile(file);

        if (!data || data.length === 0) {
            throw new Error('Файл пуст или не содержит данных');
        }

        // Валидация обязательных колонок (уже проверено в readExcelFile)
        if (config.requiredColumns && config.requiredColumns.length > 0) {
            const headers = data[0] || [];
            const validationResult = this.validateHeaders(headers, config.requiredColumns);

            if (!validationResult.valid) {
                throw new Error(`Отсутствуют обязательные колонки: ${validationResult.missing.join(', ')}`);
            }
        }

        return {
            success: true,
            fileName: file.name,
            data: data,
            rowCount: data.length - 1 // Минус заголовок
        };
    }

    // Чтение Excel файла через ExcelJS
    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const workbook = new ExcelJS.Workbook();

                    await workbook.xlsx.load(arrayBuffer);

                    // Берём первый лист
                    const worksheet = workbook.worksheets[0];
                    if (!worksheet) {
                        reject(new Error('Файл не содержит листов'));
                        return;
                    }

                    // Конвертируем в массив массивов
                    const data = [];

                    worksheet.eachRow((row, rowNumber) => {
                        const rowData = [];
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            rowData[colNumber - 1] = cell.value;
                        });
                        data.push(rowData);
                    });

                    resolve(data);
                } catch (error) {
                    reject(new Error(`Ошибка чтения файла: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Ошибка чтения файла'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // Валидация заголовков (обязательных колонок)
    validateHeaders(headers, requiredColumns) {
        const missing = [];

        for (const requiredCol of requiredColumns) {
            const found = this.utils.findColumn(headers, [requiredCol]);
            if (found === -1) {
                missing.push(requiredCol);
            }
        }

        return {
            valid: missing.length === 0,
            missing: missing
        };
    }

    // Объединить данные из нескольких файлов
    mergeFileData(results) {
        const successfulResults = results.filter(r => r.success);

        if (successfulResults.length === 0) {
            return [];
        }

        // Если один файл - возвращаем его данные
        if (successfulResults.length === 1) {
            return successfulResults[0].data;
        }

        // Если несколько файлов - объединяем (заголовок берём из первого)
        const headers = successfulResults[0].data[0];
        const mergedData = [headers];

        successfulResults.forEach(result => {
            const dataRows = result.data.slice(1); // Пропускаем заголовок
            mergedData.push(...dataRows);
        });

        return mergedData;
    }

    // Получить статистику загруженных файлов
    getLoadStats(results) {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const totalRows = results
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.rowCount, 0);

        return {
            total: results.length,
            successful: successful,
            failed: failed,
            totalRows: totalRows
        };
    }

    // Форматирование результатов для отображения
    formatResults(results) {
        const stats = this.getLoadStats(results);
        const messages = [];

        if (stats.successful > 0) {
            messages.push(`✓ Успешно загружено: ${stats.successful} файл(ов), ${stats.totalRows} строк`);
        }

        if (stats.failed > 0) {
            messages.push(`✗ Ошибки: ${stats.failed} файл(ов)`);
            const failedFiles = results.filter(r => !r.success);
            failedFiles.forEach(file => {
                messages.push(`  - ${file.fileName}: ${file.error}`);
            });
        }

        return messages.join('\n');
    }

    // Проверка валидности всех результатов
    areAllValid(results) {
        return results.length > 0 && results.every(r => r.success);
    }
}

// Экспорт для использования в других модулях
window.FileProcessor = FileProcessor;
