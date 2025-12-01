/**
 * SharedWorker для синхронизации
 * Один воркер на все вкладки - никаких дубликатов
 */

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyeWmZs028zVkzKTrqNTbzTasKK0Z63eCfV1I4RUV6BJWMH8r62kScLh7U5B45bHRRILA/exec';

// Уникальный ID этого воркера для отладки
const WORKER_ID = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
console.log('🆔 SharedWorker создан с ID:', WORKER_ID);

let queue = [];
let isSyncing = false;
let email = null;
const ports = new Set();

// Подключение новой вкладки
self.onconnect = function(e) {
    const port = e.ports[0];
    ports.add(port);
    console.log(`🔗 Новая вкладка подключена. Всего: ${ports.size}`);

    port.onmessage = function(event) {
        console.log(`📩 Сообщение: ${event.data.type}`);
        handleMessage(event.data, port);
    };

    port.start();

    // Отправляем текущий статус
    console.log(`📤 Отправка статуса: queue=${queue.length}, isSyncing=${isSyncing}, workerId=${WORKER_ID}`);
    port.postMessage({
        type: 'STATUS',
        queue: queue,
        isSyncing: isSyncing,
        workerId: WORKER_ID
    });
};

function handleMessage(data, senderPort) {
    switch (data.type) {
        case 'SET_EMAIL':
            email = data.email;
            // Если есть очередь, начинаем синхронизацию
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
    console.log(`🔄 processQueue: isSyncing=${isSyncing}, email=${email}, queue=${queue.length}`);
    if (isSyncing || !email) {
        console.log('⏭️ Пропуск: ' + (isSyncing ? 'уже синхронизируется' : 'нет email'));
        return;
    }

    isSyncing = true;
    broadcast({ type: 'SYNC_STARTED' });
    console.log('🚀 Синхронизация началась');

    let processed = 0;
    let errors = [];

    while (queue.length > 0) {
        const operation = queue.shift();
        console.log(`📤 Операция: ${operation.type} ${operation.entity}`);

        broadcast({
            type: 'PROGRESS',
            processed: processed,
            remaining: queue.length
        });

        try {
            await executeOperation(operation);
            processed++;
            console.log(`✅ Успешно: ${operation.type} ${operation.entity}`);

            // Удаляем из partners-data после успешной синхронизации
            if (operation.tempId) {
                broadcast({
                    type: 'REMOVE_LOCAL',
                    tempId: operation.tempId,
                    entity: operation.entity
                });
            }

        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            operation.attempts = (operation.attempts || 0) + 1;

            if (operation.attempts < 3) {
                console.log(`🔁 Повтор (попытка ${operation.attempts + 1})`);
                queue.unshift(operation);
                await delay(1000 * operation.attempts);
            } else {
                console.log(`💀 Операция провалена после 3 попыток`);
                errors.push({ operation, error: error.message });
            }
        }

        await delay(100);
    }

    isSyncing = false;
    console.log(`🏁 Синхронизация завершена: ${processed} операций, ${errors.length} ошибок`);
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

    let url = `${SCRIPT_URL}?action=${action}&email=${encodeURIComponent(email)}`;

    if (type === 'add') {
        url += `&data=${encodeURIComponent(JSON.stringify(data))}`;
    } else if (type === 'update') {
        url += `&id=${encodeURIComponent(data.id)}&data=${encodeURIComponent(JSON.stringify(data))}`;
    } else if (type === 'delete') {
        url += `&id=${encodeURIComponent(data.id)}`;
    }

    const response = await fetch(url);
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

console.log('SharedWorker started');
