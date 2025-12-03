/**
 * SharedWorker для синхронизации
 * Один воркер на все вкладки - никаких дубликатов
 *
 * БЕЗОПАСНОСТЬ: Все запросы отправляются через POST с accessToken
 */

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyeWmZs028zVkzKTrqNTbzTasKK0Z63eCfV1I4RUV6BJWMH8r62kScLh7U5B45bHRRILA/exec';

// Уникальный ID этого воркера
const WORKER_ID = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

let queue = [];
let isSyncing = false;
let accessToken = null; // Используем токен вместо email
const ports = new Set();

// Подключение новой вкладки
self.onconnect = function(e) {
    const port = e.ports[0];
    ports.add(port);

    port.onmessage = function(event) {
        handleMessage(event.data, port);
    };

    port.start();

    // Отправляем текущий статус (без sensitive данных)
    port.postMessage({
        type: 'STATUS',
        queueLength: queue.length,
        isSyncing: isSyncing,
        workerId: WORKER_ID
    });
};

function handleMessage(data, senderPort) {
    switch (data.type) {
        case 'SET_TOKEN':
            // Используем токен вместо email для безопасности
            accessToken = data.accessToken;
            // Если есть очередь, начинаем синхронизацию
            if (queue.length > 0 && !isSyncing) {
                processQueue();
            }
            break;

        // Legacy поддержка SET_EMAIL (конвертируем в SET_TOKEN)
        case 'SET_EMAIL':
            if (data.accessToken) {
                accessToken = data.accessToken;
            }
            if (queue.length > 0 && !isSyncing) {
                processQueue();
            }
            break;

        case 'ADD_TO_QUEUE':
            addToQueue(data.operations);
            break;

        case 'CANCEL':
            cancelSync();
            break;
    }
}

function broadcast(message) {
    ports.forEach(port => {
        try {
            port.postMessage(message);
        } catch (e) {
            ports.delete(port);
        }
    });
}

function addToQueue(operations) {
    for (const op of operations) {
        // Проверяем дубликаты
        const key = getKey(op);
        const exists = queue.some(q => getKey(q) === key);
        if (!exists) {
            queue.push(op);
        }
    }

    broadcast({
        type: 'QUEUE_UPDATED',
        queue: queue
    });

    if (!isSyncing && queue.length > 0) {
        processQueue();
    }
}

function getKey(op) {
    if (op.entity === 'partner' && op.type === 'add') {
        const d = op.data;
        return `${op.type}:${op.entity}:${(d.subagent||'').toLowerCase()}|${(d.subagentId||'').toLowerCase()}|${(d.method||'').toLowerCase()}`;
    }
    return `${op.type}:${op.entity}:${op.data.id || JSON.stringify(op.data)}`;
}

async function processQueue() {
    if (isSyncing || !accessToken) {
        return;
    }

    isSyncing = true;
    broadcast({ type: 'SYNC_STARTED' });

    let processed = 0;
    let errors = [];

    while (queue.length > 0) {
        const operation = queue.shift();

        broadcast({
            type: 'PROGRESS',
            processed: processed,
            remaining: queue.length
        });

        try {
            await executeOperation(operation);
            processed++;

            // Удаляем из partners-data после успешной синхронизации
            if (operation.tempId) {
                broadcast({
                    type: 'REMOVE_LOCAL',
                    tempId: operation.tempId,
                    entity: operation.entity
                });
            }

        } catch (error) {
            operation.attempts = (operation.attempts || 0) + 1;

            if (operation.attempts < 3) {
                queue.unshift(operation);
                await delay(1000 * operation.attempts);
            } else {
                errors.push({ operation, error: error.message });
            }
        }

        await delay(100);
    }

    isSyncing = false;
    broadcast({
        type: 'SYNC_COMPLETE',
        processed: processed,
        errors: errors
    });
}

async function executeOperation(operation) {
    const { type, entity, data } = operation;

    let action;
    if (entity === 'partner') {
        action = type === 'add' ? 'addPartner' : type === 'update' ? 'updatePartner' : 'deletePartner';
    } else if (entity === 'method') {
        action = type === 'add' ? 'addMethod' : type === 'update' ? 'updateMethod' : 'deleteMethod';
    } else if (entity === 'template') {
        action = type === 'add' ? 'addTemplate' : type === 'update' ? 'updateTemplate' : 'deleteTemplate';
    } else {
        throw new Error('Unknown entity: ' + entity);
    }

    // Используем GET с URL параметрами (GAS теряет POST body при редиректе)
    const url = new URL(SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('accessToken', accessToken);

    if (type === 'add') {
        url.searchParams.set('data', JSON.stringify(data));
    } else if (type === 'update') {
        url.searchParams.set('id', data.id);
        url.searchParams.set('data', JSON.stringify(data));
    } else if (type === 'delete') {
        url.searchParams.set('id', data.id);
    }

    const response = await fetch(url.toString(), {
        method: 'GET'
    });

    const result = await response.json();

    if (result.error) {
        throw new Error(result.error);
    }

    return result;
}

function cancelSync() {
    queue = [];
    isSyncing = false;
    broadcast({ type: 'CANCELLED' });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
