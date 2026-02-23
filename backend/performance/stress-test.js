/**
 * k6 Stress Testing Script
 *
 * Tests system behavior beyond expected capacity to identify breaking points.
 *
 * Usage:
 *   k6 run performance/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '2m', target: 100 },   // Below normal load
        { duration: '5m', target: 100 },   // Normal load
        { duration: '2m', target: 300 },   // Around breaking point
        { duration: '5m', target: 300 },   // Stress
        { duration: '2m', target: 500 },   // Beyond breaking point
        { duration: '5m', target: 500 },   // Extreme stress
        { duration: '5m', target: 0 },     // Recovery
    ],
    thresholds: {
        http_req_duration: ['p(99)<2000'],  // 99% of requests < 2s
        http_req_failed: ['rate<0.10'],     // Allow up to 10% error rate under stress
        errors: ['rate<0.10'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
    // Test 1: Health endpoint under stress
    const healthRes = http.get(`${BASE_URL}/`);
    const healthOk = check(healthRes, {
        'health status 200': (r) => r.status === 200,
    });
    errorRate.add(!healthOk);

    sleep(0.3);

    // Test 2: Auth endpoint under stress
    const loginPayload = JSON.stringify({
        email: 'stress-test@example.com',
        password: 'password123',
    });

    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
        headers: { 'Content-Type': 'application/json' },
    });

    const loginOk = check(loginRes, {
        'login completes (any status)': (r) =>
            r.status === 200 || r.status === 403 || r.status === 429,
        'login response time < 2s': (r) => r.timings.duration < 2000,
    });
    errorRate.add(!loginOk);

    sleep(0.5);
}
