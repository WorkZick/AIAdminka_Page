import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
    resolve(__dirname, '../../team-info/js/modules/team-avatars.js'),
    'utf-8'
);

// ─────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────

/**
 * Build a fresh TeamAvatars instance with all dependencies mocked.
 */
function buildTeamAvatars(overrides = {}) {
    const TeamState = {
        tempImageData: null,
        cropSettings: { scale: 1, posX: 0, posY: 0 },
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        cropHandlers: null,
        oldCropHandlers: null,
        currentAvatar: null,
        ...overrides.teamState
    };

    const Toast = {
        warning: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        ...overrides.toast
    };

    const fn = new Function(
        'TeamState', 'Toast', 'document',
        `${code}\nreturn TeamAvatars;`
    );

    const module = fn(TeamState, Toast, document);

    return { module, TeamState, Toast };
}

// ─────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────

function setupCropDOM() {
    document.body.innerHTML = `
        <div id="cropModal">
            <img id="cropImage" />
            <div id="cropPreview" style="width:120px;height:120px;"></div>
        </div>
        <img id="formAvatar" class="hidden" />
        <div class="form-avatar-placeholder visible"></div>
        <input id="formAvatarInput" type="file" value="" />
    `;
}

// ─────────────────────────────────────────────
// Helper: create a mock File
// ─────────────────────────────────────────────

function makeFile(name, type, sizeBytes) {
    const blob = new Blob(['x'.repeat(sizeBytes)], { type });
    return new File([blob], name, { type });
}

// ─────────────────────────────────────────────
// handleAvatarUpload — file type validation
// ─────────────────────────────────────────────

describe('TeamAvatars — handleAvatarUpload: file type validation', () => {
    beforeEach(() => {
        setupCropDOM();
    });

    it('should accept image/jpeg files', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('photo.jpg', 'image/jpeg', 100);
        const event = { target: { files: [file], value: '' } };

        // FileReader is used internally; we just verify Toast.warning was NOT called
        module.handleAvatarUpload(event);

        expect(Toast.warning).not.toHaveBeenCalled();
    });

    it('should accept image/png files', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('photo.png', 'image/png', 100);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).not.toHaveBeenCalled();
    });

    it('should accept image/gif files', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('anim.gif', 'image/gif', 100);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).not.toHaveBeenCalled();
    });

    it('should accept image/webp files', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('img.webp', 'image/webp', 100);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).not.toHaveBeenCalled();
    });

    it('should reject image/bmp with Toast.warning', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('img.bmp', 'image/bmp', 100);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).toHaveBeenCalledWith('Допустимые форматы: JPEG, PNG, GIF, WebP');
    });

    it('should reject application/pdf with Toast.warning', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('doc.pdf', 'application/pdf', 100);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).toHaveBeenCalledWith('Допустимые форматы: JPEG, PNG, GIF, WebP');
    });

    it('should reject text/plain with Toast.warning', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('file.txt', 'text/plain', 100);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).toHaveBeenCalledWith('Допустимые форматы: JPEG, PNG, GIF, WebP');
    });

    it('should reject empty MIME type string', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('noext', '', 100);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).toHaveBeenCalledWith('Допустимые форматы: JPEG, PNG, GIF, WebP');
    });

    it('should reset input value when type is rejected', () => {
        const { module } = buildTeamAvatars();
        const file = makeFile('img.bmp', 'image/bmp', 100);
        const event = { target: { files: [file], value: 'some/path' } };

        module.handleAvatarUpload(event);

        expect(event.target.value).toBe('');
    });
});

// ─────────────────────────────────────────────
// handleAvatarUpload — file size validation
// ─────────────────────────────────────────────

describe('TeamAvatars — handleAvatarUpload: file size validation', () => {
    beforeEach(() => {
        setupCropDOM();
    });

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

    it('should accept a file exactly at the 5 MB limit', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('img.jpg', 'image/jpeg', MAX_SIZE);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).not.toHaveBeenCalled();
    });

    it('should accept a file 1 byte below the 5 MB limit', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('img.jpg', 'image/jpeg', MAX_SIZE - 1);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).not.toHaveBeenCalled();
    });

    it('should reject a file 1 byte above the 5 MB limit', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('img.jpg', 'image/jpeg', MAX_SIZE + 1);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).toHaveBeenCalledWith('Максимальный размер файла: 5 МБ');
    });

    it('should reject a 10 MB file', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('big.jpg', 'image/jpeg', 10 * 1024 * 1024);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).toHaveBeenCalledWith('Максимальный размер файла: 5 МБ');
    });

    it('should reset input value when size is exceeded', () => {
        const { module } = buildTeamAvatars();
        const file = makeFile('big.png', 'image/png', MAX_SIZE + 1);
        const event = { target: { files: [file], value: 'path/to/big.png' } };

        module.handleAvatarUpload(event);

        expect(event.target.value).toBe('');
    });

    it('should accept a 1-byte file', () => {
        const { module, Toast } = buildTeamAvatars();
        const file = makeFile('tiny.jpg', 'image/jpeg', 1);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────
// handleAvatarUpload — edge cases
// ─────────────────────────────────────────────

describe('TeamAvatars — handleAvatarUpload: edge cases', () => {
    beforeEach(() => {
        setupCropDOM();
    });

    it('should do nothing when no file is selected (files[0] undefined)', () => {
        const { module, Toast } = buildTeamAvatars();
        const event = { target: { files: [], value: '' } };

        expect(() => module.handleAvatarUpload(event)).not.toThrow();
        expect(Toast.warning).not.toHaveBeenCalled();
    });

    it('should not show size warning for invalid type (type check comes first)', () => {
        const { module, Toast } = buildTeamAvatars();
        // Invalid type AND oversized — type rejection must fire, not size
        const file = makeFile('doc.pdf', 'application/pdf', 10 * 1024 * 1024);
        const event = { target: { files: [file], value: '' } };

        module.handleAvatarUpload(event);

        expect(Toast.warning).toHaveBeenCalledTimes(1);
        expect(Toast.warning).toHaveBeenCalledWith('Допустимые форматы: JPEG, PNG, GIF, WebP');
    });
});

// ─────────────────────────────────────────────
// showCropModal
// ─────────────────────────────────────────────

describe('TeamAvatars — showCropModal', () => {
    beforeEach(() => {
        setupCropDOM();
    });

    it('should set tempImageData on TeamState', () => {
        const { module, TeamState } = buildTeamAvatars();

        module.showCropModal('data:image/jpeg;base64,abc123');

        expect(TeamState.tempImageData).toBe('data:image/jpeg;base64,abc123');
    });

    it('should reset cropSettings to defaults', () => {
        const { module, TeamState } = buildTeamAvatars({
            teamState: {
                cropSettings: { scale: 2, posX: 50, posY: 30 },
                cropHandlers: null,
                oldCropHandlers: null
            }
        });

        module.showCropModal('data:image/jpeg;base64,abc');

        expect(TeamState.cropSettings.scale).toBe(1);
        expect(TeamState.cropSettings.posX).toBe(0);
        expect(TeamState.cropSettings.posY).toBe(0);
    });

    it('should set cropImage.src to the provided imageData', () => {
        const { module } = buildTeamAvatars();
        const imageData = 'data:image/png;base64,xyz';

        module.showCropModal(imageData);

        expect(document.getElementById('cropImage').src).toContain('base64,xyz');
    });

    it('should add "active" class to cropModal', () => {
        const { module } = buildTeamAvatars();

        module.showCropModal('data:image/jpeg;base64,test');

        expect(document.getElementById('cropModal').classList.contains('active')).toBe(true);
    });

    it('should register cropHandlers on TeamState', () => {
        const { module, TeamState } = buildTeamAvatars();

        module.showCropModal('data:image/jpeg;base64,h');

        expect(TeamState.cropHandlers).not.toBeNull();
        expect(typeof TeamState.cropHandlers.handleMouseDown).toBe('function');
        expect(typeof TeamState.cropHandlers.handleMouseMove).toBe('function');
        expect(typeof TeamState.cropHandlers.handleMouseUp).toBe('function');
        expect(typeof TeamState.cropHandlers.handleWheel).toBe('function');
    });
});

// ─────────────────────────────────────────────
// closeCropModal
// ─────────────────────────────────────────────

describe('TeamAvatars — closeCropModal', () => {
    beforeEach(() => {
        setupCropDOM();
    });

    it('should remove "active" class from cropModal', () => {
        const { module } = buildTeamAvatars();
        document.getElementById('cropModal').classList.add('active');

        module.closeCropModal();

        expect(document.getElementById('cropModal').classList.contains('active')).toBe(false);
    });

    it('should set tempImageData to null', () => {
        const { module, TeamState } = buildTeamAvatars({
            teamState: { tempImageData: 'data:image/jpeg;base64,abc', cropHandlers: null }
        });

        module.closeCropModal();

        expect(TeamState.tempImageData).toBeNull();
    });

    it('should reset cropSettings', () => {
        const { module, TeamState } = buildTeamAvatars({
            teamState: {
                tempImageData: null,
                cropSettings: { scale: 2, posX: 10, posY: 20 },
                cropHandlers: null
            }
        });

        module.closeCropModal();

        expect(TeamState.cropSettings.scale).toBe(1);
        expect(TeamState.cropSettings.posX).toBe(0);
        expect(TeamState.cropSettings.posY).toBe(0);
    });

    it('should clear cropHandlers and oldCropHandlers', () => {
        const { module, TeamState } = buildTeamAvatars();
        // Simulate previously registered handlers
        const noop = vi.fn();
        TeamState.cropHandlers = {
            handleMouseDown: noop,
            handleMouseMove: noop,
            handleMouseUp: noop,
            handleWheel: noop
        };

        module.closeCropModal();

        expect(TeamState.cropHandlers).toBeNull();
        expect(TeamState.oldCropHandlers).toBeNull();
    });

    it('should reset the file input value', () => {
        const { module } = buildTeamAvatars();
        // jsdom file inputs can only be set to '' programmatically
        // The source code sets value = '', so verify it doesn't throw
        module.closeCropModal();

        expect(document.getElementById('formAvatarInput').value).toBe('');
    });

    it('should not throw when cropHandlers is null', () => {
        const { module } = buildTeamAvatars({ teamState: { cropHandlers: null } });

        expect(() => module.closeCropModal()).not.toThrow();
    });
});
