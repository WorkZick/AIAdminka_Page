// FileProcessor - Обработка Excel файлов (SheetJS + Web Worker)

class FileProcessor {
    constructor(utils) {
        this.utils = utils;
        this._worker = null;
        this._workerBusy = false;
        this._workerQueue = [];
    }

    // Получить или создать Worker (ленивая инициализация)
    _getWorker() {
        if (!this._worker) {
            this._worker = new Worker('js/modules/excel-worker.js');
            this._worker.onerror = (e) => {
                console.error('Excel Worker error:', e.message);
            };
        }
        return this._worker;
    }

    // Универсальная загрузка файлов с валидацией
    async loadFiles(files, config, onProgress = null) {
        const results = [];
        const total = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

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
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            throw new Error('Неверный формат файла. Поддерживаются только .xlsx и .xls');
        }

        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум: 100 МБ`);
        }

        const data = await this.readExcelFile(file);

        if (!data || data.length === 0) {
            throw new Error('Файл пуст или не содержит данных');
        }

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
            rowCount: data.length - 1
        };
    }

    // Чтение Excel файла через SheetJS в Web Worker (с очередью для предотвращения race condition)
    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const task = () => this._processInWorker(file).then(resolve, reject);

            if (this._workerBusy) {
                this._workerQueue.push(task);
            } else {
                this._workerBusy = true;
                task().finally(() => this._processNextInQueue());
            }
        });
    }

    // Обработать следующую задачу из очереди
    _processNextInQueue() {
        const next = this._workerQueue.shift();
        if (next) {
            next().finally(() => this._processNextInQueue());
        } else {
            this._workerBusy = false;
        }
    }

    // Отправка файла в Worker и ожидание результата
    async _processInWorker(file) {
        const WORKER_TIMEOUT = 120000; // 2 минуты
        const arrayBuffer = await file.arrayBuffer();
        const worker = this._getWorker();

        return new Promise((resolve, reject) => {
            let batchedData = null;

            const timer = setTimeout(() => {
                cleanup();
                this._worker.terminate();
                this._worker = null;
                reject(new Error('Превышено время обработки файла. Файл слишком большой или повреждён.'));
            }, WORKER_TIMEOUT);

            const cleanup = () => {
                clearTimeout(timer);
                worker.removeEventListener('message', handler);
                worker.removeEventListener('error', errorHandler);
            };

            const errorHandler = (e) => {
                cleanup();
                reject(new Error('Ошибка Worker: ' + (e.message || 'неизвестная ошибка')));
            };

            const handler = (e) => {
                const msg = e.data;

                switch (msg.type) {
                    case 'done':
                        cleanup();
                        resolve(msg.data);
                        break;

                    case 'start':
                        batchedData = new Array(msg.totalRows);
                        break;

                    case 'batch':
                        for (let i = 0; i < msg.batch.length; i++) {
                            batchedData[msg.offset + i] = msg.batch[i];
                        }
                        break;

                    case 'batch-end':
                        cleanup();
                        for (let i = 0; i < msg.batch.length; i++) {
                            batchedData[msg.offset + i] = msg.batch[i];
                        }
                        resolve(batchedData);
                        break;

                    case 'error':
                        cleanup();
                        reject(new Error(msg.error));
                        break;
                }
            };

            worker.addEventListener('message', handler);
            worker.addEventListener('error', errorHandler);

            // Transferable ArrayBuffer — zero-copy transfer to Worker
            worker.postMessage({ arrayBuffer, fileIndex: 0 }, [arrayBuffer]);
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

        if (successfulResults.length === 1) {
            return successfulResults[0].data;
        }

        const headers = successfulResults[0].data[0];
        const mergedData = [headers];

        successfulResults.forEach(result => {
            const dataRows = result.data.slice(1);
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

    // Завершение Worker при уничтожении
    destroy() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
        this._workerBusy = false;
        this._workerQueue = [];
    }
}

// Экспорт для использования в других модулях
window.FileProcessor = FileProcessor;
