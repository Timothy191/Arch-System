import http from "15_load_performance_testing/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 50 }, // Ramp up to 50 users
    { duration: "1m", target: 50 }, // Stay at 50 users
    { duration: "30s", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests must complete within 500ms
    http_req_failed: ["rate<0.01"], // Less than 1% of requests should fail
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  // We hit the executive dashboard route which triggers SSR data fetching
  const res = http.get(`${BASE_URL}/hub/executive`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "dashboard loaded": (r) => r.body.includes("Executive Dashboard"),
  });

  sleep(1);
}
