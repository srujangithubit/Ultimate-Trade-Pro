/**
 * k6 Load Testing Script for the Backtesting Platform API
 *
 * Prerequisites:
 *   1. Install k6: https://k6.io/docs/get-started/installation/
 *   2. Start the backend server: npm run start:dev
 *   3. Set environment variables:
 *      - BASE_URL (default: http://localhost:3000)
 *      - AUTH_TOKEN (optional, for authenticated endpoints)
 *
 * Usage:
 *   k6 run performance/load-test.js
 *   k6 run --env BASE_URL=http://localhost:3000 performance/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const sessionCreateDuration = new Trend('session_create_duration');

export const options = {
    stages: [
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '3m', target: 50 },   // Hold at 50 users
        { duration: '1m', target: 100 },  // Ramp up to 100 users
        { duration: '3m', target: 100 },  // Hold at 100 users
        { duration: '1m', target: 200 },  // Spike to 200 users
        { duration: '2m', target: 200 },  // Hold at 200 users
        { duration: '2m', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],     // 95% of requests < 500ms
        http_req_failed: ['rate<0.05'],       // Error rate < 5%
        errors: ['rate<0.05'],                // Custom error rate < 5%
        login_duration: ['p(95)<1000'],       // Login < 1s at p95
        session_create_duration: ['p(95)<800'], // Session create < 800ms at p95
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
    // Register a test user for authenticated tests
    const uniqueId = Date.now();
    const payload = JSON.stringify({
        email: `loadtest-${uniqueId}@example.com`,
        password: 'password123',
        displayName: 'Load Test User',
    });

    const response = http.post(`${BASE_URL}/auth/register`, payload, {
        headers: { 'Content-Type': 'application/json' },
    });

    if (response.status === 201) {
        return {
            accessToken: response.json('accessToken'),
            refreshToken: response.json('refreshToken'),
            email: `loadtest-${uniqueId}@example.com`,
        };
    }

    return { accessToken: null, email: null };
}

export default function (data) {
    const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: data.accessToken ? `Bearer ${data.accessToken}` : '',
    };

    group('Health Check', () => {
        const response = http.get(`${BASE_URL}/`);
        const success = check(response, {
            'health check status 200': (r) => r.status === 200,
            'health check response time < 100ms': (r) => r.timings.duration < 100,
        });
        errorRate.add(!success);
    });

    sleep(0.5);

    group('Auth - Login', () => {
        const payload = JSON.stringify({
            email: data.email,
            password: 'password123',
        });

        const start = Date.now();
        const response = http.post(`${BASE_URL}/auth/login`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });
        loginDuration.add(Date.now() - start);

        const success = check(response, {
            'login status 200': (r) => r.status === 200,
            'login has access token': (r) => r.json('accessToken') !== undefined,
            'login response time < 500ms': (r) => r.timings.duration < 500,
        });
        errorRate.add(!success);
    });

    sleep(1);

    group('Backtesting - Create Session', () => {
        const payload = JSON.stringify({
            userId: 'perf-test-user',
            sessionName: `Load Test ${Date.now()}`,
            instrument: 'AAPL',
            assetClass: 'stock',
            startingBalance: 10000,
            startDate: '2024-01-01',
            endDate: '2024-12-31',
        });

        const start = Date.now();
        const response = http.post(
            `${BASE_URL}/backtesting/sessions`,
            payload,
            { headers: authHeaders },
        );
        sessionCreateDuration.add(Date.now() - start);

        const success = check(response, {
            'session create returns 201 or 401': (r) =>
                r.status === 201 || r.status === 401,
            'session create response time < 800ms': (r) =>
                r.timings.duration < 800,
        });
        errorRate.add(!success);
    });

    sleep(1);
}
