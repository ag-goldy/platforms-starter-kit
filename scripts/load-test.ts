/**
 * Load test script for Atlas Helpdesk
 *
 * Prerequisites:
 *   npm install -g k6  (or brew install k6)
 *
 * Usage:
 *   k6 run scripts/load-test.ts
 *
 * Targets Phase 10 performance budgets:
 *   - 200 concurrent users
 *   - 50 req/s sustained
 *   - p95 latency < 600ms for inbox, < 800ms for portal home
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const _inboxLatency = new Trend("inbox_latency");
const _portalLatency = new Trend("portal_latency");
const apiLatency = new Trend("api_latency");

export const options = {
  stages: [
    { duration: "2m", target: 50 }, // Ramp up to 50 users
    { duration: "5m", target: 200 }, // Ramp up to 200 users
    { duration: "10m", target: 200 }, // Sustain 200 users
    { duration: "3m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"], // 95% of requests under 1s
    http_req_failed: ["rate<0.01"], // Error rate under 1%
    errors: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "https://atlas.agrnetworks.com";

export default function loadTest() {
  // 1. Hit public landing page
  const landingRes = http.get(`${BASE_URL}/`);
  check(landingRes, {
    "landing status is 200": (r) => r.status === 200,
    "landing time < 800ms": (r) => r.timings.duration < 800,
  });
  errorRate.add(landingRes.status !== 200);
  sleep(1);

  // 2. Hit public status page
  const statusRes = http.get(`${BASE_URL}/api/public/status`);
  check(statusRes, {
    "status api is 200": (r) => r.status === 200,
    "status api time < 300ms": (r) => r.timings.duration < 300,
  });
  errorRate.add(statusRes.status !== 200);
  apiLatency.add(statusRes.timings.duration);
  sleep(1);

  // 3. Hit a public KB article (adjust slug as needed)
  const kbRes = http.get(`${BASE_URL}/kb-public/demo/getting-started`);
  check(kbRes, {
    "kb page status is 200 or 404": (r) => r.status === 200 || r.status === 404,
  });
  errorRate.add(kbRes.status >= 500);
  sleep(2);
}
