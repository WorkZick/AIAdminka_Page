// Загрузчик всех шаблонов
// Объединяет отдельные шаблоны в единый объект TEMPLATES

// Проверяем, что все шаблоны загружены
if (typeof window.TEMPLATE_DEPOSITS_WITHDRAWALS === 'undefined') {
    console.error('Шаблон DEPOSITS_WITHDRAWALS не загружен!');
}
if (typeof window.TEMPLATE_MERGE_FILES === 'undefined') {
    console.error('Шаблон MERGE_FILES не загружен!');
}
if (typeof window.TEMPLATE_REGISTRATIONS === 'undefined') {
    console.error('Шаблон REGISTRATIONS не загружен!');
}

// Собираем все шаблоны в единый объект
const TEMPLATES = {
    DEPOSITS_WITHDRAWALS: window.TEMPLATE_DEPOSITS_WITHDRAWALS,
    MERGE_FILES: window.TEMPLATE_MERGE_FILES,
    REGISTRATIONS: window.TEMPLATE_REGISTRATIONS
};

// Экспортируем для обратной совместимости
window.TEMPLATES = TEMPLATES;

console.log('Загружено шаблонов:', Object.keys(TEMPLATES).length);
