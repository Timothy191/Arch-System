import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";

const ROOT = process.cwd();

// Helper to ensure directory exists
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Helper to move file/directory recursively
function move(src, dest) {
  if (existsSync(src)) {
    ensureDir(dirname(dest));
    renameSync(src, dest);
    console.log(`Moved: ${relative(ROOT, src)} -> ${relative(ROOT, dest)}`);
  } else {
    console.log(`Skipped (not found): ${relative(ROOT, src)}`);
  }
}

// 1. Create target directories
ensureDir(join(ROOT, "config/tools"));
ensureDir(join(ROOT, "infra/docker"));
ensureDir(join(ROOT, "infra/redis"));
ensureDir(join(ROOT, "infra/systemd"));
ensureDir(join(ROOT, "infra/monitoring"));
ensureDir(join(ROOT, "docs/reports"));
ensureDir(join(ROOT, ".memory/data"));
ensureDir(join(ROOT, ".memory/config"));

// 2. Move config files from config/ to config/tools/
const configMoves = {
  "config/tools/.fallowrc.json": "config/tools/.fallowrc.json",
  "config/tools/.gitleaks.toml": "config/tools/.gitleaks.toml",
  "config/tools/.lintstagedrc.mjs": "config/tools/.lintstagedrc.mjs",
  "config/tools/.markdownlint.json": "config/tools/.markdownlint.json",
  "config/tools/mcp.json": "config/tools/mcp.json", // no leading dot as per user spec
  ".memory/config/.memoryignore": ".memory/.memory/config/.memoryignore",
  "config/tools/.secretlintignore": "config/tools/.secretlintignore",
  "config/tools/.secretlintrc.json": "config/tools/.secretlintrc.json",
  "config/tools/.syncpackrc.js": "config/tools/.syncpackrc.js",
  "config/tools/commitlint.config.mjs": "config/tools/commitlint.config.mjs",
  "config/tools/eslint.boundaries.cjs": "config/tools/eslint.boundaries.cjs",
  "config/tools/knip.json": "config/tools/knip.json",
  "config/tools/lighthouserc.json": "config/tools/lighthouserc.json",
};

for (const [src, dest] of Object.entries(configMoves)) {
  move(join(ROOT, src), join(ROOT, dest));
}

// 3. Move docker-compose files and drop prefix or restructure
const dockerMoves = {
  "infra/docker/compose.portal.yml": "infra/docker/compose.portal.yml",
  "infra/docker/compose.production.yml": "infra/docker/compose.production.yml",
  "infra/docker/compose.redis.yml": "infra/docker/compose.redis.yml",
  "infra/docker/compose.security.yml": "infra/docker/compose.security.yml",
  "infra/docker/compose.tools.yml": "infra/docker/compose.tools.yml",
  "infra/monitoring/docker-compose.yml": "infra/monitoring/docker-compose.yml",
};

for (const [src, dest] of Object.entries(dockerMoves)) {
  move(join(ROOT, src), join(ROOT, dest));
}

// 4. Move infra/redis/ to infra/redis/
const redisTopologyDir = join(ROOT, "redis-topology");
if (existsSync(redisTopologyDir)) {
  const files = readdirSync(redisTopologyDir);
  for (const file of files) {
    move(join(redisTopologyDir, file), join(ROOT, "infra/redis", file));
  }
}

// 5. Move infra/systemd/ to infra/infra/systemd/
const systemdDir = join(ROOT, "systemd");
if (existsSync(systemdDir)) {
  const files = readdirSync(systemdDir);
  for (const file of files) {
    move(join(systemdDir, file), join(ROOT, "infra/systemd", file));
  }
}

// 6. Merge docs/wiki/ into docs/wiki/
const wikiDir = join(ROOT, "wiki");
if (existsSync(wikiDir)) {
  const files = readdirSync(wikiDir);
  for (const file of files) {
    move(join(wikiDir, file), join(ROOT, "docs/wiki", file));
  }
}

// 7. Move docs/reports/ to docs/reports/
const reportDir = join(ROOT, "report");
if (existsSync(reportDir)) {
  const files = readdirSync(reportDir);
  for (const file of files) {
    move(join(reportDir, file), join(ROOT, "docs/reports", file));
  }
}

// 8. Consolidate AI memory: memory/ and .memory/data/ltm/ to .memory/data/
move(join(ROOT, ".memory/data/decisions.md"), join(ROOT, ".memory/data/decisions.md"));
move(join(ROOT, "ltm"), join(ROOT, ".memory/data/ltm"));

// 9. Remove empty directories
const dirsToRemove = ["docker", "redis-topology", "systemd", "wiki", "report", "memory", "ltm"];
for (const dir of dirsToRemove) {
  const dirPath = join(ROOT, dir);
  if (existsSync(dirPath)) {
    try {
      rmSync(dirPath, { recursive: true, force: true });
      console.log(`Removed directory: ${dir}`);
    } catch (err) {
      console.warn(`Failed to remove directory ${dir}: ${err.message}`);
    }
  }
}

// 10. Update file references
console.log("Updating file references...");
const pkgJsonPath = join(ROOT, "package.json");
if (existsSync(pkgJsonPath)) {
  let content = readFileSync(pkgJsonPath, "utf8");
  content = content.replace(
    /"config":\s*"config\/knip\.json"/g,
    '"config": "config/tools/knip.json"',
  );
  content = content.replace(
    /"config":\s*"config\/\.markdownlint\.json"/g,
    '"config": "config/tools/.markdownlint.json"',
  );
  content = content.replace(
    /"config":\s*"config\/\.lintstagedrc\.mjs"/g,
    '"config": "config/tools/.lintstagedrc.mjs"',
  );
  content = content.replace(
    /"config":\s*"config\/\.syncpackrc\.js"/g,
    '"config": "config/tools/.syncpackrc.js"',
  );
  content = content.replace(
    /"extends":\s*\[\s*"\.\/config\/commitlint\.config\.mjs"\s*\]/g,
    '"extends": ["./config/tools/commitlint.config.mjs"]',
  );
  content = content.replace(
    /docker\/docker-compose\.monitoring\.yml/g,
    "infra/monitoring/docker-compose.yml",
  );

  writeFileSync(pkgJsonPath, content, "utf8");
  console.log("Updated package.json");
}

function updateFileContent(filePath, replacer) {
  if (existsSync(filePath)) {
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      const files = readdirSync(filePath);
      for (const file of files) {
        updateFileContent(join(filePath, file), replacer);
      }
    } else if (stats.isFile()) {
      if (
        filePath.includes("node_modules") ||
        filePath.includes(".git") ||
        filePath.includes(".nx") ||
        filePath.endsWith(".png") ||
        filePath.endsWith(".mp4") ||
        filePath.endsWith(".jpg")
      ) {
        return;
      }
      let content;
      try {
        content = readFileSync(filePath, "utf8");
      } catch {
        return;
      }
      const newContent = replacer(content, filePath);
      if (newContent !== content) {
        writeFileSync(filePath, newContent, "utf8");
        console.log(`Updated references in: ${relative(ROOT, filePath)}`);
      }
    }
  }
}

function referenceReplacer(content, filePath) {
  let updated = content;

  updated = updated.replace(/config\/\.fallowrc\.json/g, "config/tools/.fallowrc.json");
  updated = updated.replace(/config\/\.gitleaks\.toml/g, "config/tools/.gitleaks.toml");
  updated = updated.replace(/config\/\.lintstagedrc\.mjs/g, "config/tools/.lintstagedrc.mjs");
  updated = updated.replace(/config\/\.markdownlint\.json/g, "config/tools/.markdownlint.json");
  updated = updated.replace(/config\/\.mcp\.json/g, "config/tools/mcp.json");
  updated = updated.replace(/config\/\.secretlintignore/g, "config/tools/.secretlintignore");
  updated = updated.replace(/config\/\.secretlintrc\.json/g, "config/tools/.secretlintrc.json");
  updated = updated.replace(/config\/\.syncpackrc\.js/g, "config/tools/.syncpackrc.js");
  updated = updated.replace(
    /config\/commitlint\.config\.mjs/g,
    "config/tools/commitlint.config.mjs",
  );
  updated = updated.replace(
    /config\/eslint\.boundaries\.cjs/g,
    "config/tools/eslint.boundaries.cjs",
  );
  updated = updated.replace(/config\/knip\.json/g, "config/tools/knip.json");
  updated = updated.replace(/config\/lighthouserc\.json/g, "config/tools/lighthouserc.json");
  updated = updated.replace(/config\/\.memoryignore/g, ".memory/.memory/config/.memoryignore");

  updated = updated.replace(
    /docker\/docker-compose\.portal\.yml/g,
    "infra/docker/compose.portal.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.production\.yml/g,
    "infra/docker/compose.production.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.redis\.yml/g,
    "infra/docker/compose.redis.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.security\.yml/g,
    "infra/docker/compose.security.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.tools\.yml/g,
    "infra/docker/compose.tools.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.monitoring\.yml/g,
    "infra/monitoring/docker-compose.yml",
  );

  updated = updated.replace(/redis-topology\//g, "infra/redis/");
  updated = updated.replace(/systemd\//g, "infra/infra/systemd/");

  updated = updated.replace(/(?<!docs\/)wiki\//g, "docs/wiki/");
  updated = updated.replace(/report\//g, "docs/reports/");

  updated = updated.replace(/ltm\//g, ".memory/data/.memory/data/ltm/");
  updated = updated.replace(/memory\/decisions\.md/g, ".memory/data/decisions.md");

  return updated;
}

const filesAndDirsToUpdate = [
  "Makefile",
  "scripts",
  ".github",
  "docs",
  ".kiro",
  ".claude",
  "tools",
];

for (const path of filesAndDirsToUpdate) {
  updateFileContent(join(ROOT, path), referenceReplacer);
}

const movedDockerFiles = [
  "infra/docker/compose.portal.yml",
  "infra/docker/compose.production.yml",
  "infra/docker/compose.redis.yml",
  "infra/docker/compose.security.yml",
  "infra/docker/compose.tools.yml",
];

for (const file of movedDockerFiles) {
  const filePath = join(ROOT, file);
  if (existsSync(filePath)) {
    let content = readFileSync(filePath, "utf8");
    content = content.replace(/context:\s*\./g, "context: ../../");
    content = content.replace(/env_file:\s*\.env\.tools/g, "env_file: ../../.env.tools");
    content = content.replace(
      /env_file:\s*apps\/portal\/\.env/g,
      "env_file: ../../apps/portal/.env",
    );
    content = content.replace(/\.\/config\/nginx\.conf/g, "../../config/nginx.conf");
    content = content.replace(/\.\/certs/g, "../../certs");
    content = content.replace(/\.\/test-results/g, "../../test-results");

    writeFileSync(filePath, content, "utf8");
    console.log(`Adjusted relative paths in moved compose file: ${file}`);
  }
}

const monitoringCompose = join(ROOT, "infra/monitoring/docker-compose.yml");
if (existsSync(monitoringCompose)) {
  let content = readFileSync(monitoringCompose, "utf8");
  content = content.replace(/\.\/monitoring\/prometheus\.yml/g, "./prometheus.yml");
  writeFileSync(monitoringCompose, content, "utf8");
  console.log(`Adjusted relative paths in: ${monitoringCompose}`);
}
