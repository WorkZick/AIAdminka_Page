// Web Worker for parsing Excel files using SheetJS
// Handles large files without blocking the UI thread

try {
    importScripts('../lib/xlsx.full.min.js');
} catch (e) {
    self.onmessage = function () {
        self.postMessage({
            type: 'error',
            fileIndex: 0,
            error: 'Не удалось загрузить библиотеку SheetJS. Проверьте что файл xlsx.full.min.js доступен.'
        });
    };
    throw e;
}

const MAX_ROWS = 500000;

self.onmessage = function (e) {
    const { arrayBuffer, fileIndex } = e.data;

    try {
        const workbook = XLSX.read(arrayBuffer, {
            type: 'array',
            dense: true,
            cellDates: true,
            cellNF: false,
            cellText: false
        });

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            self.postMessage({ type: 'error', fileIndex, error: 'Файл не содержит листов' });
            return;
        }

        const worksheet = workbook.Sheets[sheetName];

        const data = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: true,
            dateNF: 'dd.mm.yyyy',
            defval: ''
        });

        if (!data || data.length === 0) {
            self.postMessage({ type: 'error', fileIndex, error: 'Файл пуст или не содержит данных' });
            return;
        }

        if (data.length > MAX_ROWS) {
            self.postMessage({
                type: 'error',
                fileIndex,
                error: `Файл содержит слишком много строк (${data.length}). Максимум: ${MAX_ROWS}`
            });
            return;
        }

        // Send data in batches to avoid postMessage frame drops on large datasets
        const BATCH_SIZE = 10000;
        const totalRows = data.length;

        if (totalRows <= BATCH_SIZE) {
            self.postMessage({ type: 'done', fileIndex, data, totalRows });
        } else {
            self.postMessage({ type: 'start', fileIndex, totalRows });

            for (let i = 0; i < totalRows; i += BATCH_SIZE) {
                const batch = data.slice(i, i + BATCH_SIZE);
                const isLast = (i + BATCH_SIZE) >= totalRows;
                self.postMessage({
                    type: isLast ? 'batch-end' : 'batch',
                    fileIndex,
                    batch,
                    offset: i,
                    totalRows
                });
            }
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            fileIndex,
            error: 'Ошибка чтения файла: ' + (error.message || error)
        });
    }
};
