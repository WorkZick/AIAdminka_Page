// Простой экспорт менеджер
const exportManager = {
    // Экспорт всех записей в текст
    async exportAll() {
        try {
            const data = await storage.loadData();

            if (data.length === 0) {
                alert('Нет данных для экспорта');
                return;
            }

            let text = `Информация о команде\nЭкспортировано: ${new Date().toLocaleString('ru-RU')}\n\n`;

            data.forEach((item, index) => {
                text += `${index + 1}. ${item.fullName || item.title}\n`;

                if (item.position) {
                    text += `   Должность: ${item.position}`;
                    if (item.grade) {
                        text += ` (${item.grade})`;
                    }
                    text += '\n';
                }

                if (item.predefinedFields && Object.keys(item.predefinedFields).length > 0) {
                    Object.entries(item.predefinedFields).forEach(([name, value]) => {
                        text += `   ${name}: ${value}\n`;
                    });
                }

                if (item.customFields && Object.keys(item.customFields).length > 0) {
                    Object.entries(item.customFields).forEach(([name, fieldData]) => {
                        const visible = fieldData.visible !== undefined ? fieldData.visible : true;
                        const values = fieldData.values || [{ value: fieldData.value || fieldData }];

                        if (visible) {
                            const displayValues = values.map(val => {
                                if (typeof val === 'string') return val;
                                if (fieldData.type === 'money') {
                                    return `${val.value} ${val.currency || 'RUB'}`;
                                }
                                return val.value || val;
                            }).join(', ');
                            text += `   ${name}: ${displayValues}\n`;
                        } else {
                            text += `   ${name}: [СКРЫТО]\n`;
                        }
                    });
                }

                if (item.comment) {
                    text += `   Комментарий: ${item.comment}\n`;
                }

                text += '\n';
            });

            // Скачиваем файл
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `team-info-${new Date().toISOString().slice(0,10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`Экспортировано ${data.length} записей в TXT файл!`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Ошибка экспорта: ' + error.message);
        }
    },
    
    // Показать модальное окно выборочного экспорта
    async showModal() {
        try {
            const data = await storage.loadData();
            
            if (data.length === 0) {
                alert('Нет данных для экспорта');
                return;
            }
            
            // Заполняем список записей
            const container = document.getElementById('exportItems');
            container.innerHTML = data.map(item => `
                <div class="export-item">
                    <input type="checkbox" class="export-checkbox" data-id="${item.id}" checked>
                    <div class="export-preview">
                        <div class="export-preview-title">${this.escapeHtml(item.fullName || item.title)}</div>
                        <div class="export-preview-content">${this.getItemPreview(item)}</div>
                    </div>
                </div>
            `).join('');
            
            // Показываем модальное окно
            document.getElementById('exportModal').classList.add('active');
            
        } catch (error) {
            console.error('Show modal error:', error);
            alert('Ошибка открытия окна экспорта: ' + error.message);
        }
    },
    
    // Закрыть модальное окно
    closeModal() {
        document.getElementById('exportModal').classList.remove('active');
    },
    
    // Выбрать все записи
    selectAll(select) {
        const checkboxes = document.querySelectorAll('.export-checkbox');
        checkboxes.forEach(cb => cb.checked = select);
    },
    
    // Экспортировать выбранные записи
    async exportSelected() {
        try {
            const data = await storage.loadData();
            const selectedIds = Array.from(document.querySelectorAll('.export-checkbox:checked'))
                .map(cb => parseInt(cb.dataset.id));
            
            if (selectedIds.length === 0) {
                alert('Выберите записи для экспорта');
                return;
            }
            
            const selectedData = data.filter(item => selectedIds.includes(item.id));
            
            // Определяем формат экспорта
            const formatRadio = document.querySelector('input[name="exportFormat"]:checked');
            const format = formatRadio ? formatRadio.value : 'txt';
            
            if (format === 'json') {
                await this.exportSelectedAsJSON(selectedData);
            } else {
                await this.exportSelectedAsTXT(selectedData);
            }
            
            this.closeModal();
            
        } catch (error) {
            console.error('Export selected error:', error);
            alert('Ошибка экспорта: ' + error.message);
        }
    },
    
    // Экспорт выбранных в JSON
    async exportSelectedAsJSON(data) {
        const exportData = {
            data: data,
            timestamp: new Date().toISOString(),
            version: '1.0',
            exported: data.length
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `team_info_selected_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`Успешно экспортировано ${data.length} записей в JSON формате!\nФайл сохранен в папку Загрузки.`);
    },
    
    // Экспорт выбранных в TXT
    async exportSelectedAsTXT(data) {
        let text = `Выборочный экспорт информации о команде\nЭкспортировано: ${new Date().toLocaleString('ru-RU')}\nЗаписей: ${data.length}\n\n`;

        data.forEach((item, index) => {
            text += `${index + 1}. ${item.fullName || item.title}\n`;

            if (item.position) {
                text += `   Должность: ${item.position}`;
                if (item.grade) {
                    text += ` (${item.grade})`;
                }
                text += '\n';
            }

            if (item.predefinedFields && Object.keys(item.predefinedFields).length > 0) {
                Object.entries(item.predefinedFields).forEach(([name, value]) => {
                    text += `   ${name}: ${value}\n`;
                });
            }

            if (item.customFields && Object.keys(item.customFields).length > 0) {
                Object.entries(item.customFields).forEach(([name, fieldData]) => {
                    const visible = fieldData.visible !== undefined ? fieldData.visible : true;
                    const values = fieldData.values || [{ value: fieldData.value || fieldData }];

                    if (visible) {
                        const displayValues = values.map(val => {
                            if (typeof val === 'string') return val;
                            if (fieldData.type === 'money') {
                                return `${val.value} ${val.currency || 'RUB'}`;
                            }
                            return val.value || val;
                        }).join(', ');
                        text += `   ${name}: ${displayValues}\n`;
                    } else {
                        text += `   ${name}: [СКРЫТО]\n`;
                    }
                });
            }

            if (item.comment) {
                text += `   Комментарий: ${item.comment}\n`;
            }

            text += '\n';
        });

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `team_info_selected_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`Успешно экспортировано ${data.length} записей в TXT формате!\nФайл сохранен в папку Загрузки.`);
    },
    
    // Получение превью записи
    getItemPreview(item) {
        let parts = [];

        if (item.position) {
            parts.push(item.position + (item.grade ? ` (${item.grade})` : ''));
        }

        const predefinedCount = item.predefinedFields ? Object.keys(item.predefinedFields).length : 0;
        const customCount = item.customFields ? Object.keys(item.customFields).length : 0;
        const totalFields = predefinedCount + customCount;

        if (totalFields > 0) {
            parts.push(`${totalFields} полей`);
        }

        if (item.comment) {
            const shortComment = item.comment.length > 30 ?
                item.comment.substring(0, 30) + '...' :
                item.comment;
            parts.push(shortComment);
        }

        return parts.join(' • ') || 'Базовая информация';
    },
    
    // Экранирование HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },
    
    // Инициализация
    init() {
        console.log('✅ Export Manager loaded');
        
        // Обработчик закрытия модального окна по клику вне него
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
    }
};

console.log('✅ Export Manager loaded');
