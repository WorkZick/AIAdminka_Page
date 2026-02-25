/* onboarding-state.js — StateManager (Pub/Sub) */

const OnboardingState = (() => {
    'use strict';

    const _state = {
        requests: [],
        filteredRequests: [],
        currentRequest: null,
        currentStep: 1,
        view: 'list',           // list | form | review
        filters: {
            ownership: 'my',    // my | review | all
            status: '',
            search: ''
        },
        userRole: 'sales',
        userEmail: '',
        loading: false
    };

    const _subscribers = {};

    function get(path) {
        const parts = path.split('.');
        let val = _state;
        for (const part of parts) {
            if (val == null) return undefined;
            val = val[part];
        }
        return val;
    }

    function set(path, value) {
        const parts = path.split('.');
        let obj = _state;
        for (let i = 0; i < parts.length - 1; i++) {
            if (obj[parts[i]] == null) obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
        _notify(parts[0]);
    }

    function subscribe(key, callback) {
        if (!_subscribers[key]) _subscribers[key] = [];
        _subscribers[key].push(callback);
    }

    function _notify(key) {
        if (_subscribers[key]) {
            _subscribers[key].forEach(cb => cb(_state[key]));
        }
    }

    return { get, set, subscribe };
})();
