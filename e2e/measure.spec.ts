import { test, expect } from '@playwright/test';

test('measure metrics', async ({ page }) => {
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');

  const startNav = Date.now();
  await page.goto('http://localhost:3000/hub', { waitUntil: 'domcontentloaded' });
  const navLatency = Date.now() - startNav;
  console.log('Dashboard Navigation Latency:', navLatency, 'ms');

  const metrics2 = await client.send('Performance.getMetrics');
  const jsHeap2 = metrics2.metrics.find(m => m.name === 'JSHeapUsedSize').value;
  console.log('Dashboard Memory:', jsHeap2 / 1024 / 1024, 'MB');

  console.log('Checking ThreeHeroRotator...');
  const startThree = Date.now();
  await page.waitForSelector('[aria-label="Department Hero Highlights"]', { timeout: 10000 }).catch(() => null);
  const threeHeroRotator = await page.$('[aria-label="Department Hero Highlights"]');
  const threeStartupCost = Date.now() - startThree;
  console.log('ThreeHeroRotator found:', !!threeHeroRotator);
  console.log('ThreeHeroRotator Startup Cost:', threeStartupCost, 'ms');

  // Measure FPS
  const fps = await page.evaluate(() => {
    return new Promise(resolve => {
      let frames = 0;
      let start = performance.now();
      const loop = () => {
        frames++;
        if (performance.now() - start < 1000) {
          requestAnimationFrame(loop);
        } else {
          resolve(frames);
        }
      };
      requestAnimationFrame(loop);
    });
  });
  console.log('FPS during active animation:', fps);

  // Navigate to highest data view? Maybe http://localhost:3000/hub/executive?
  const startNavData = Date.now();
  await page.goto('http://localhost:3000/hub/executive', { waitUntil: 'domcontentloaded' });
  const navDataLatency = Date.now() - startNavData;
  console.log('Highest-data dashboard view latency:', navDataLatency, 'ms');

  // Measure memory growth
  for (let i=0; i<3; i++) {
    await page.goto('http://localhost:3000/hub', { waitUntil: 'domcontentloaded' });
    await page.goto('http://localhost:3000/hub/executive', { waitUntil: 'domcontentloaded' });
  }

  await client.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(1000);
  const metrics3 = await client.send('Performance.getMetrics');
  const jsHeap3 = metrics3.metrics.find(m => m.name === 'JSHeapUsedSize').value;
  console.log('Final Memory after navigations:', jsHeap3 / 1024 / 1024, 'MB');
  console.log('Memory Growth:', (jsHeap3 - jsHeap2) / 1024 / 1024, 'MB');
});
