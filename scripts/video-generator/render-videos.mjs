import { chromium } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_DIR = path.join(REPO_ROOT, "docs/videos");
const FRAMES_TEMP_DIR = path.join(__dirname, "temp_frames");

async function renderVideo({ htmlPath, outputFilename, slideDurationSec = 6 }) {
  console.log(`\n🎬 Starting video rendering for: ${outputFilename}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(FRAMES_TEMP_DIR, { recursive: true });

  // Clean old frames
  const oldFiles = fs.readdirSync(FRAMES_TEMP_DIR);
  for (const f of oldFiles) {
    fs.unlinkSync(path.join(FRAMES_TEMP_DIR, f));
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const absoluteHtml = `file://${path.resolve(__dirname, htmlPath)}`;
  await page.goto(absoluteHtml, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const totalSlides = await page.evaluate(() => window.totalSlides || 4);
  const fps = 5; // 5 frames per second for smooth slide video
  const totalFramesPerSlide = slideDurationSec * fps;
  let frameCounter = 0;

  for (let s = 0; s < totalSlides; s++) {
    await page.evaluate((slideIdx) => window.setSlide(slideIdx), s);
    await page.waitForTimeout(200);

    for (let f = 0; f < totalFramesPerSlide; f++) {
      const framePath = path.join(
        FRAMES_TEMP_DIR,
        `frame_${String(frameCounter).padStart(5, "0")}.png`,
      );
      await page.screenshot({ path: framePath, type: "png" });
      frameCounter++;
      await page.waitForTimeout(1000 / fps);
    }
    console.log(`  ✓ Rendered Slide ${s + 1} / ${totalSlides} (${totalFramesPerSlide} frames)`);
  }

  await browser.close();

  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  console.log(`📦 Encoding MP4 video via FFmpeg -> ${outputPath}`);

  const ffmpegCmd = `ffmpeg -y -framerate ${fps} -i "${FRAMES_TEMP_DIR}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -r 30 "${outputPath}"`;
  execSync(ffmpegCmd, { stdio: "inherit" });

  console.log(`✅ Successfully generated video: ${outputPath}`);
}

async function main() {
  try {
    // 1. Render Video 1: Executive & Shareholder Edition
    await renderVideo({
      htmlPath: "executive-presentation.html",
      outputFilename: "arch-system-executive-briefing.mp4",
      slideDurationSec: 6,
    });

    // 2. Render Video 2: Technical Deep-Dive & Systems Architecture Edition
    await renderVideo({
      htmlPath: "technical-presentation.html",
      outputFilename: "arch-system-technical-architecture.mp4",
      slideDurationSec: 6,
    });

    console.log("\n🎉 All codebase walkthrough videos generated successfully in docs/videos/");
  } catch (error) {
    console.error("❌ Video rendering failed:", error);
    process.exit(1);
  } finally {
    // Cleanup temporary frames
    if (fs.existsSync(FRAMES_TEMP_DIR)) {
      fs.rmSync(FRAMES_TEMP_DIR, { recursive: true, force: true });
    }
  }
}

main();
