# Mock данные для локальной разработки

## Назначение

Файл `admin-mock-data.js` содержит тестовые данные для локальной разработки и отладки модуля администрирования.

## Использование

### 1. Включить mock режим в admin.js
```javascript
USE_MOCK_API: true  // Изменить с false на true
```

### 2. Подключить файл в admin/index.html
```html
<!-- Добавить ПЕРЕД admin.js -->
<script src="js/admin-mock-data.js"></script>
<script src="js/admin.js"></script>
```

### 3. Перезагрузить страницу

Теперь модуль будет работать с тестовыми данными из `admin-mock-data.js`:
- 3 команды (Alpha, Beta, Архив)
- 8 пользователей (admin, 2 leader, assistant, 2 sales, blocked, waiting)
- 3 запроса на регистрацию
- Права доступа для 6 ролей
- 5 записей аудита

## В продакшене

**ВАЖНО:** В production окружении:
- `USE_MOCK_API` должен быть `false`
- Файл `admin-mock-data.js` НЕ должен быть подключён в HTML
- Данные загружаются из реального API (Google Apps Script)

## Модификация данных

Для изменения тестовых данных отредактируйте `admin-mock-data.js` напрямую. Данные хранятся в объекте `window.ADMIN_MOCK_DATA`.

---

*Создано: 2026-01-14*
