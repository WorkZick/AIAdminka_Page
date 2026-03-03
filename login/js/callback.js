/**
 * OAuth Callback Handler
 * Обрабатывает OAuth редирект от Google
 * Поддерживает silent refresh в iframe
 */

(function() {
    const message = document.getElementById('message');
    const sub = document.getElementById('sub');
    const spinner = document.getElementById('spinner');

    // Проверяем, это silent refresh (из iframe)?
    const isSilentRefresh = sessionStorage.getItem('oauth_silent') === 'true';

    try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const returnedState = params.get('state');
        const error = params.get('error');

        if (error) {
            // В silent режиме ошибка означает что нужен интерактивный логин
            if (isSilentRefresh) {
                sessionStorage.removeItem('oauth_silent');
                window.close();
                return;
            }
            throw new Error('Авторизация отклонена: ' + error);
        }

        if (!accessToken) {
            if (isSilentRefresh) {
                sessionStorage.removeItem('oauth_silent');
                window.close();
                return;
            }
            throw new Error('Токен не получен');
        }

        // CSRF защита: проверяем state параметр
        const savedState = sessionStorage.getItem('oauth_state');
        if (!savedState || savedState !== returnedState) {
            sessionStorage.removeItem('oauth_state');
            sessionStorage.removeItem('oauth_silent');
            if (isSilentRefresh) {
                window.close();
                return;
            }
            throw new Error('Ошибка безопасности: неверный state параметр');
        }
        sessionStorage.removeItem('oauth_state');

        // Получаем данные пользователя для обновления токена
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        })
        .then(function(response) { return response.json(); })
        .then(function(userInfo) {
            // Сохраняем полные данные авторизации
            const authData = {
                accessToken: accessToken,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                timestamp: Date.now()
            };
            localStorage.setItem('cloud-auth', JSON.stringify(authData));

            // Очищаем URL от токена
            history.replaceState(null, '', window.location.pathname);

            if (isSilentRefresh) {
                // Silent refresh завершён - закрываем окно
                sessionStorage.removeItem('oauth_silent');
                window.close();
                return;
            }

            // Обычный логин - редирект
            spinner.style.display = 'none';
            message.textContent = 'Авторизация успешна!';
            message.className = 'message success';
            sub.textContent = 'Перенаправление...';

            // Всегда перенаправляем на login/index.html для проверки доступа.
            // auth-redirect остаётся в sessionStorage — login.js использует его
            // после успешной верификации (предотвращает redirect-loop для
            // удалённых/новых пользователей, которых приложение не знает).
            setTimeout(function() {
                window.location.href = 'index.html';
            }, 500);
        })
        .catch(function(e) {
            if (isSilentRefresh) {
                sessionStorage.removeItem('oauth_silent');
                window.close();
                return;
            }
            throw e;
        });

    } catch (e) {
        if (isSilentRefresh) {
            sessionStorage.removeItem('oauth_silent');
            window.close();
            return;
        }
        spinner.style.display = 'none';
        message.textContent = e.message;
        message.className = 'message error';
        sub.innerHTML = '<a href="index.html" class="error-link">Вернуться на страницу входа</a>';
    }
})();
