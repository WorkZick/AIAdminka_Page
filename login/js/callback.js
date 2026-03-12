/**
 * OAuth Callback Handler
 * Обрабатывает OAuth редирект от Google
 * Поддерживает silent refresh (popup/iframe) и redirect refresh (полный редирект)
 */

(function() {
    const message = document.getElementById('message');
    const sub = document.getElementById('sub');
    const spinner = document.getElementById('spinner');

    // Проверяем, это silent refresh (из iframe/popup)?
    const isSilentRefresh = sessionStorage.getItem('oauth_silent') === 'true';

    // Redirect refresh: полный редирект для продления сессии (без popup)
    const isRedirectRefresh = sessionStorage.getItem('oauth_redirect_refresh') === 'true';

    // Счётчик ошибок state для защиты от бесконечного цикла редиректов
    const stateErrorCount = parseInt(sessionStorage.getItem('oauth_state_errors') || '0');

    function handleCallbackError(e) {
        if (isSilentRefresh) {
            sessionStorage.removeItem('oauth_silent');
            window.close();
            return;
        }
        // Авторедирект на login (auth-redirect сохраняется в sessionStorage)
        if (stateErrorCount < 3) {
            sessionStorage.setItem('oauth_state_errors', String(stateErrorCount + 1));
            window.location.href = 'index.html';
        } else {
            // После 3 неудач — показываем ошибку
            sessionStorage.removeItem('oauth_state_errors');
            spinner.style.display = 'none';
            message.textContent = e.message;
            message.className = 'message error';
            sub.innerHTML = '<a href="index.html" class="error-link">Вернуться на страницу входа</a>';
        }
    }

    try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const returnedState = params.get('state');
        const error = params.get('error');

        if (error) {
            if (isSilentRefresh) {
                sessionStorage.removeItem('oauth_silent');
                window.close();
                return;
            }
            if (isRedirectRefresh) {
                // prompt=none не сработал — нужен интерактивный логин
                // auth-redirect остаётся для возврата после логина
                sessionStorage.removeItem('oauth_redirect_refresh');
                window.location.href = 'index.html';
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
        // State не удаляем до успешной валидации токена (защита от race condition)

        // Получаем данные пользователя для обновления токена
        const fetchController = new AbortController();
        const fetchTimeout = setTimeout(function() { fetchController.abort(); }, 10000);

        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': 'Bearer ' + accessToken },
            signal: fetchController.signal
        })
        .then(function(response) {
            clearTimeout(fetchTimeout);
            if (!response.ok) {
                throw new Error('Ошибка получения данных пользователя: HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function(userInfo) {
            if (!userInfo.email) {
                throw new Error('Не удалось получить email пользователя');
            }

            // Токен валиден — теперь безопасно удалять state
            sessionStorage.removeItem('oauth_state');

            // Сохраняем полные данные авторизации
            const authData = {
                accessToken: accessToken,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                timestamp: Date.now()
            };
            localStorage.setItem('cloud-auth', JSON.stringify(authData));

            // Успешный логин — сбрасываем счётчик ошибок
            sessionStorage.removeItem('oauth_state_errors');

            // Очищаем URL от токена
            history.replaceState(null, '', window.location.pathname);

            if (isSilentRefresh) {
                // Silent refresh завершён - закрываем окно
                sessionStorage.removeItem('oauth_silent');
                window.close();
                return;
            }

            if (isRedirectRefresh) {
                // Redirect refresh: возвращаемся напрямую на страницу (минуя login)
                sessionStorage.removeItem('oauth_redirect_refresh');
                const returnUrl = sessionStorage.getItem('auth-redirect');
                sessionStorage.removeItem('auth-redirect');
                if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
                    window.location.href = returnUrl;
                } else {
                    window.location.href = 'index.html';
                }
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
            handleCallbackError(e);
        });

    } catch (e) {
        handleCallbackError(e);
    }
})();
