// Хранилище для Team Info (использует StorageManager для базовых операций)
const storage = {
    key: 'team_info_data',

    // Загрузка данных
    async loadData() {
        return StorageManager.getArray(this.key);
    },

    // Сохранение данных
    async saveData(data) {
        return StorageManager.set(this.key, data);
    },
    
    // Экспорт в файл
    async exportToFile(data) {
        try {
            const exportData = {
                data: data,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `team-info-export-${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Export error:', error);
            return false;
        }
    },
    
    // Импорт из файла
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = JSON.parse(e.target.result);
                    let data = [];

                    if (content.data && Array.isArray(content.data)) {
                        data = content.data;
                    } else if (Array.isArray(content)) {
                        data = content;
                    }

                    // Миграция старых данных на новую структуру
                    data = data.map(item => {
                        // Если есть старое поле title, но нет fullName - мигрируем
                        if (item.title && !item.fullName) {
                            return {
                                ...item,
                                fullName: item.title,
                                position: item.position || '',
                                grade: item.grade || 'Middle',
                                predefinedFields: item.predefinedFields || {},
                                customFields: item.customFields || {},
                                comment: item.comment || ''
                            };
                        }
                        return item;
                    });

                    resolve(data);
                } catch (error) {
                    reject(new Error('Неверный формат файла'));
                }
            };
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsText(file);
        });
    }
};

console.log('✅ Storage loaded');
