// Загрузчик всех шаблонов
// Объединяет отдельные шаблоны в единый объект TEMPLATES

// Проверяем, что все шаблоны загружены
if (typeof window.TEMPLATE_COMBINED_REPORT === 'undefined') {
    console.error('Шаблон COMBINED_REPORT не загружен!');
}
if (typeof window.TEMPLATE_DEPOSITS_WITHDRAWALS === 'undefined') {
    console.error('Шаблон DEPOSITS_WITHDRAWALS не загружен!');
}
if (typeof window.TEMPLATE_REGISTRATIONS === 'undefined') {
    console.error('Шаблон REGISTRATIONS не загружен!');
}
if (typeof window.TEMPLATE_BTAG === 'undefined') {
    console.error('Шаблон BTAG не загружен!');
}
if (typeof window.TEMPLATE_ANALYTICS_T9 === 'undefined') {
    console.error('Шаблон ANALYTICS_T9 не загружен!');
}
if (typeof window.TEMPLATE_ACTIVE_USERS === 'undefined') {
    console.error('Шаблон ACTIVE_USERS не загружен!');
}

// Собираем все шаблоны в единый объект (Общий отчет - первым)
const TEMPLATES = {
    COMBINED_REPORT: window.TEMPLATE_COMBINED_REPORT,
    DEPOSITS_WITHDRAWALS: window.TEMPLATE_DEPOSITS_WITHDRAWALS,
    REGISTRATIONS: window.TEMPLATE_REGISTRATIONS,
    BTAG: window.TEMPLATE_BTAG,
    ANALYTICS_T9: window.TEMPLATE_ANALYTICS_T9,
    ACTIVE_USERS: window.TEMPLATE_ACTIVE_USERS
};
