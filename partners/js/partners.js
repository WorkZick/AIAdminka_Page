// Основной модуль управления партнерами
const partners = {
    currentEditId: null,

    // Инициализация
    init() {
        this.render();
    },

    // Отрисовка списка партнеров
    render() {
        const partnersData = StorageManager.getArray('partners-data');
        const tbody = document.getElementById('partnersTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.querySelector('.partners-table');

        if (partnersData.length === 0) {
            emptyState.classList.add('show');
            table.style.display = 'none';
        } else {
            emptyState.classList.remove('show');
            table.style.display = 'table';

            tbody.innerHTML = partnersData.map(partner => `
                <tr>
                    <td>${this.escapeHtml(partner.method)}</td>
                    <td>${this.escapeHtml(partner.subagent)}</td>
                    <td>${this.escapeHtml(partner.subagentId)}</td>
                    <td class="actions-cell">
                        <div class="action-buttons">
                            <button class="btn-icon btn-edit" onclick="partners.showEditModal('${partner.id}')" title="Редактировать">
                                <i data-lucide="edit"></i>
                            </button>
                            <button class="btn-icon btn-delete" onclick="partners.deletePartner('${partner.id}')" title="Удалить">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            // Инициализируем иконки Lucide
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    },

    // Показать модальное окно добавления
    showAddModal() {
        this.currentEditId = null;
        document.getElementById('modalTitle').textContent = 'Добавить нового партнера';
        document.getElementById('savePartnerBtn').textContent = 'Добавить партнера';
        document.getElementById('partnerForm').reset();
        document.getElementById('partnerModal').classList.add('show');
    },

    // Показать модальное окно редактирования
    showEditModal(id) {
        this.currentEditId = id;
        const partnersData = StorageManager.getArray('partners-data');
        const partner = partnersData.find(p => p.id === id);

        if (partner) {
            document.getElementById('modalTitle').textContent = 'Редактировать партнера';
            document.getElementById('savePartnerBtn').textContent = 'Сохранить изменения';
            document.getElementById('methodInput').value = partner.method;
            document.getElementById('subagentInput').value = partner.subagent;
            document.getElementById('subagentIdInput').value = partner.subagentId;
            document.getElementById('partnerModal').classList.add('show');
        }
    },

    // Закрыть модальное окно
    closeModal() {
        document.getElementById('partnerModal').classList.remove('show');
        document.getElementById('partnerForm').reset();
        this.currentEditId = null;
    },

    // Сохранить партнера
    savePartner() {
        const method = document.getElementById('methodInput').value.trim();
        const subagent = document.getElementById('subagentInput').value.trim();
        const subagentId = document.getElementById('subagentIdInput').value.trim();

        if (!method || !subagent || !subagentId) {
            alert('Пожалуйста, заполните все поля');
            return;
        }

        const partnerData = {
            method,
            subagent,
            subagentId
        };

        if (this.currentEditId) {
            // Обновление существующего партнера
            if (StorageManager.updateItem('partners-data', this.currentEditId, partnerData)) {
                this.closeModal();
                this.render();
            } else {
                alert('Ошибка при обновлении партнера');
            }
        } else {
            // Добавление нового партнера
            if (StorageManager.addItem('partners-data', partnerData)) {
                this.closeModal();
                this.render();
            } else {
                alert('Ошибка при добавлении партнера');
            }
        }
    },

    // Удалить партнера
    deletePartner(id) {
        if (confirm('Вы уверены, что хотите удалить этого партнера?')) {
            if (StorageManager.deleteItem('partners-data', id)) {
                this.render();
            } else {
                alert('Ошибка при удалении партнера');
            }
        }
    },

    // Экранирование HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    partners.init();
});
