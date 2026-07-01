import http from "perf/http";
import { check, sleep } from "k6";

// Stress testing configuration
export const options = {
  stages: [
    { duration: "2m", target: 100 }, // ramp up to 100 users
    { duration: "5m", target: 100 }, // stay at 100 for 5 minutes
    { duration: "2m", target: 200 }, // ramp up to 200 users
    { duration: "5m", target: 200 }, // stay at 200 for 5 minutes
    { duration: "2m", target: 0 }, // scale down. Recovery stage.
  ],
  thresholds: {
    // 99% of requests must complete below 1.5s
    http_req_duration: ["p(99)<1500"],
    // Error rate must be less than 1%
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const responses = http.batch([
    ["GET", `${BASE_URL}/`, null, { tags: { name: "Homepage" } }],
    ["GET", `${BASE_URL}/api/health`, null, { tags: { name: "HealthCheck" } }],
  ]);

  check(responses[0], {
    "homepage status is 200": (r) => r.status === 200,
  });
  check(responses[1], {
    "health api is 200": (r) => r.status === 200,
  });

  sleep(1);
}
