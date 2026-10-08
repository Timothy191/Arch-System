import { check } from 'k6';
import http from 'k6/http';
import encoding from 'k6/encoding';

export const options = {
  scenarios: {
    shift_closeout_storm: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 50,
      stages: [
        { duration: '10s', target: 5 }, // Wave 1: light smoke test
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://mrwhtxbhrzyttlsyuofc.supabase.co';
const SUPABASE_ANON_KEY =
  __ENV.SUPABASE_ANON_KEY || 'sb_publishable_d-7-pJnWomgpNtWFFy_yCA_4axrPll5';

// Credentials come from the environment only — never a committed literal.
// NOTE: this is a k6 script, so it must use __ENV, not process.env.
// Supply with: k6 run -e TEST_PASSWORD=... e2e/load/shift-closeout-storm.js
const TEST_EMAIL = __ENV.TEST_EMAIL || 'admin@plantcormining.os';
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function base64urlEncode(str) {
  let base64 = encoding.b64encode(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function setup() {
  if (!TEST_PASSWORD) {
    throw new Error(
      'TEST_PASSWORD is not set. Run with: k6 run -e TEST_PASSWORD=... e2e/load/shift-closeout-storm.js'
    );
  }
  // Login to get a valid session
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (res.status !== 200) {
    throw new Error(`Failed to authenticate: ${res.status} ${res.body}`);
  }

  const session = JSON.parse(res.body);

  // Construct the cookie expected by @supabase/ssr
  const sessionData = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  // Encode as base64url string as per @supabase/ssr convention
  const cookieEncoded = 'base64-' + base64urlEncode(sessionData);

  return {
    cookie: `sb-mrwhtxbhrzyttlsyuofc-auth-token=${encodeURIComponent(cookieEncoded)}`,
    token: session.access_token,
    deptId: 'd290f1ee-6c54-4b01-90e6-d701748f0851', // Sample valid UUID for deptId
  };
}

export default function (data) {
  const idempotencyKey = uuidv4();

  const payload = JSON.stringify({
    deptId: data.deptId,
    date: '2026-10-01',
    shift: 'day',
    operatorName: 'Automated Storm Operator',
    alarmResponseAvgSeconds: Math.floor(Math.random() * 10),
    incidentAckAvgSeconds: Math.floor(Math.random() * 5),
    systemUptimePercent: 99.9,
    missedIncidentsCount: 0,
    summaryNotes: 'Automated shift closeout during storm simulation',
    checklistItems: [],
    idempotencyKey: idempotencyKey,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      // We also pass the Authorization header, as getUser() falls back to it!
      Authorization: `Bearer ${data.token}`,
      Cookie: data.cookie,
      'Idempotency-Key': idempotencyKey,
    },
  };

  const res = http.post(`${BASE_URL}/api/control-room/shift-closeout`, payload, params);

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });
}
