/* onboarding-utils.js — Common utilities for partner-onboarding modules */

const OnboardingUtils = (() => {
    'use strict';

    /**
     * Check if value is empty (undefined, null, or empty string).
     * Replaces 9+ inline patterns: `value === undefined || value === '' || value === null`
     */
    function isEmpty(value) {
        return value === undefined || value === '' || value === null;
    }

    /**
     * Check if role is admin-like (admin or leader).
     * Replaces 15+ inline patterns: `myRole === 'admin' || myRole === 'leader'`
     * @param {string} role - userRole value from OnboardingState
     */
    function isAdminLike(role) {
        return role === 'admin' || role === 'leader';
    }

    /**
     * Format ISO date string to dd.mm.yy hh:mm
     * Merges 3 implementations from list.js, steps.js, source.js.
     * Handles null/undefined input and invalid dates.
     */
    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}.${mm}.${yy} ${hh}:${min}`;
    }

    /**
     * Get current user roles and admin status from OnboardingState.
     * Replaces 12+ instances of:
     *   const myRole = OnboardingState.get('userRole');
     *   const sysRole = OnboardingState.get('systemRole');
     *   const isAdmin = myRole === 'admin' || myRole === 'leader';
     * @returns {{ myRole: string, sysRole: string, isAdmin: boolean }}
     */
    function getRoles() {
        const myRole = OnboardingState.get('userRole');
        const sysRole = OnboardingState.get('systemRole');
        return {
            myRole,
            sysRole,
            isAdmin: isAdminLike(myRole)
        };
    }

    return { isEmpty, isAdminLike, formatDateTime, getRoles };
})();
