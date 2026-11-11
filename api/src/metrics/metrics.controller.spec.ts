import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  it('renvoie les metriques du processus au format Prometheus', async () => {
    const text = await new MetricsController().metrics();

    expect(text).toContain('# TYPE process_cpu_user_seconds_total counter');
  });
});
