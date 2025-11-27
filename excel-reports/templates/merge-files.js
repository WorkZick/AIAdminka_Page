// Шаблон: Объединение файлов
// Объединяет несколько файлов по заголовкам

window.TEMPLATE_MERGE_FILES = {
    id: 'merge_files',
    name: 'Объединение файлов',
    description: 'Объединяет несколько файлов по заголовкам',
    filesConfig: {
        step1: { name: 'Файлы для объединения', multiple: true }
    },
    handler: (...filesData) => {
        const filtered = filesData.filter(f => f !== undefined);
        if (filtered.length < 1) {
            throw new Error('Требуется минимум 1 файл');
        }

        const allHeaders = new Set();
        const filesHeaders = [];

        filtered.forEach(fileData => {
            if (!fileData || !Array.isArray(fileData) || fileData.length === 0) return;
            const headers = fileData[0] || [];
            filesHeaders.push(headers);
            headers.forEach(h => {
                if (h) allHeaders.add(h.toString().trim());
            });
        });

        const result = [Array.from(allHeaders)];
        const headersMapping = filesHeaders.map(headers => {
            const mapping = {};
            headers.forEach((h, i) => {
                if (h) mapping[h.toString().trim()] = i;
            });
            return mapping;
        });

        filtered.forEach((fileData, fileIndex) => {
            if (!fileData || !Array.isArray(fileData)) return;
            const currentMapping = headersMapping[fileIndex];
            
            for (let rowIndex = 1; rowIndex < fileData.length; rowIndex++) {
                const row = fileData[rowIndex];
                if (!row) continue;
                
                const newRow = new Array(allHeaders.size).fill('');
                const headersArray = Array.from(allHeaders);
                
                headersArray.forEach((header, resultIndex) => {
                    const sourceIndex = currentMapping[header];
                    if (sourceIndex !== undefined && row[sourceIndex] !== undefined) {
                        newRow[resultIndex] = row[sourceIndex] === null ? '' : row[sourceIndex];
                    }
                });
                
                result.push(newRow);
            }
        });

        return result;
    }
};
