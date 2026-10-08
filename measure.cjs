const { chromium } = require('@playwright/test');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');

  console.log('Navigating to hub...');
  const startNav = Date.now();
  await page.goto('http://localhost:3000/hub', { waitUntil: 'domcontentloaded' });
  const navLatency = Date.now() - startNav;
  console.log('Dashboard Navigation Latency:', navLatency, 'ms');

  const metrics2 = await client.send('Performance.getMetrics');
  console.log('Dashboard Memory:', metrics2.metrics.find(m => m.name === 'JSHeapUsedSize').value / 1024 / 1024, 'MB');

  console.log('Checking ThreeHeroRotator...');
  const startThree = Date.now();
  await page.waitForSelector('[aria-label="Department Hero Highlights"]', { timeout: 10000 }).catch(() => null);
  const threeHeroRotator = await page.$('[aria-label="Department Hero Highlights"]');
  const threeStartupCost = Date.now() - startThree;
  console.log('ThreeHeroRotator found:', !!threeHeroRotator);
  console.log('ThreeHeroRotator Startup Cost:', threeStartupCost, 'ms');
  
  // Start FPS trace
  await client.send('Tracing.start', {
    categories: '-*,disabled-by-default-devtools.timeline.frame',
    options: 'RecordUntilCustom'
  });
  
  await page.waitForTimeout(2000);
  
  const trace = await client.send('Tracing.end');
  console.log('Collected trace');
  
  // Actually, we can get frame times from requestAnimationFrame in the browser
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
  
  // Memory growth repeated navigation
  let memGrowth = 0;
  for (let i=0; i<3; i++) {
    await page.goto('http://localhost:3000/hub/executive', { waitUntil: 'domcontentloaded' });
    await page.goto('http://localhost:3000/hub', { waitUntil: 'domcontentloaded' });
  }
  const metrics3 = await client.send('Performance.getMetrics');
  const finalMem = metrics3.metrics.find(m => m.name === 'JSHeapUsedSize').value / 1024 / 1024;
  console.log('Final Dashboard Memory after navigation:', finalMem, 'MB');
  console.log('Memory Growth:', finalMem - (metrics2.metrics.find(m => m.name === 'JSHeapUsedSize').value / 1024 / 1024), 'MB');

  await browser.close();
})();
