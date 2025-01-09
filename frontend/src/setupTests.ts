import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
    default: vi.fn(() => ({
        on: vi.fn(),
        emit: vi.fn(),
        off: vi.fn(),
    })),
}));

// Mock axios
vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({
            get: vi.fn(),
            post: vi.fn(),
            interceptors: {
                request: { use: vi.fn() },
                response: { use: vi.fn() },
            },
        })),
    },
}));

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
}); 