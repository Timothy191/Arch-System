/**
 * @jest-environment node
 */

import { checkGrafanaHealth, listApprovedDashboards } from './grafana';
import { checkPrometheusHealth, queryPrometheus } from './prometheus';

describe('Grafana & Prometheus bounded read-only adapters', () => {
  it('blocks SSRF against private/loopback URLs in Grafana adapter', async () => {
    await expect(checkGrafanaHealth('http://127.0.0.1:3000', 'token')).rejects.toThrow();
    await expect(
      listApprovedDashboards({ baseUrl: 'http://169.254.169.254', apiKey: 'token' })
    ).rejects.toThrow();
  });

  it('blocks SSRF and non-allowlisted metrics in Prometheus adapter', async () => {
    await expect(checkPrometheusHealth('http://localhost:9090')).rejects.toThrow();
    await expect(
      queryPrometheus({ baseUrl: 'https://prometheus.example.com', metric: 'arbitrary_promql{}' })
    ).rejects.toThrow('Metric is not allowlisted');
  });
});
