# Mock данные для локальной разработки

## Назначение

Файл `team-mock-data.js` содержит тестовые данные для локальной разработки и отладки модуля "Информация о сотрудниках".

## Использование

### 1. Включить mock режим в team-api.js
```javascript
USE_MOCK_API: true  // Изменить с false на true
```

### 2. Подключить файл в team-info/index.html
```html
<!-- Добавить ПЕРЕД team-api.js -->
<script src="js/team-mock-data.js"></script>
<script src="js/team-api.js"></script>
```

### 3. Перезагрузить страницу

Теперь модуль будет работать с тестовыми данными из `team-mock-data.js`:
- Команда "Alpha"
- 4 сотрудника (leader, assistant, 2 sales)
- 2 ожидающих пользователя

## В продакшене

**ВАЖНО:** В production окружении:
- `USE_MOCK_API` должен быть `false`
- Файл `team-mock-data.js` НЕ должен быть подключён в HTML
- Данные загружаются из реального API (Google Apps Script)

## Модификация данных

Для изменения тестовых данных отредактируйте `team-mock-data.js` напрямую. Данные хранятся в объекте `window.TEAM_MOCK_DATA`.

---

*Создано: 2026-01-14*
