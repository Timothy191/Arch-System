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
ensureDir(join(ROOT, "07_toolchain_configuration/tools"));
ensureDir(join(ROOT, "10_infrastructure_as_code/docker"));
ensureDir(join(ROOT, "10_infrastructure_as_code/redis"));
ensureDir(join(ROOT, "10_infrastructure_as_code/systemd"));
ensureDir(join(ROOT, "10_infrastructure_as_code/monitoring"));
ensureDir(join(ROOT, "06_technical_documentation/reports"));
ensureDir(join(ROOT, ".memory/data"));
ensureDir(join(ROOT, ".memory/config"));

// 2. Move config files from 07_toolchain_configuration/ to 07_toolchain_configuration/08_developer_tooling/
const configMoves = {
  "07_toolchain_configuration/08_developer_tooling/.fallowrc.json": "07_toolchain_configuration/08_developer_tooling/.fallowrc.json",
  "07_toolchain_configuration/08_developer_tooling/.gitleaks.toml": "07_toolchain_configuration/08_developer_tooling/.gitleaks.toml",
  "07_toolchain_configuration/08_developer_tooling/.lintstagedrc.mjs": "07_toolchain_configuration/08_developer_tooling/.lintstagedrc.mjs",
  "07_toolchain_configuration/08_developer_tooling/.markdownlint.json": "07_toolchain_configuration/08_developer_tooling/.markdownlint.json",
  "07_toolchain_configuration/08_developer_tooling/mcp.json": "07_toolchain_configuration/08_developer_tooling/mcp.json", // no leading dot as per user spec
  ".memory/07_toolchain_configuration/.memoryignore": ".memory/.memory/07_toolchain_configuration/.memoryignore",
  "07_toolchain_configuration/08_developer_tooling/.secretlintignore": "07_toolchain_configuration/08_developer_tooling/.secretlintignore",
  "07_toolchain_configuration/08_developer_tooling/.secretlintrc.json": "07_toolchain_configuration/08_developer_tooling/.secretlintrc.json",
  "07_toolchain_configuration/08_developer_tooling/.syncpackrc.js": "07_toolchain_configuration/08_developer_tooling/.syncpackrc.js",
  "07_toolchain_configuration/08_developer_tooling/commitlint.config.mjs": "07_toolchain_configuration/08_developer_tooling/commitlint.config.mjs",
  "07_toolchain_configuration/08_developer_tooling/eslint.boundaries.cjs": "07_toolchain_configuration/08_developer_tooling/eslint.boundaries.cjs",
  "07_toolchain_configuration/08_developer_tooling/knip.json": "07_toolchain_configuration/08_developer_tooling/knip.json",
  "07_toolchain_configuration/08_developer_tooling/lighthouserc.json": "07_toolchain_configuration/08_developer_tooling/lighthouserc.json",
};

for (const [src, dest] of Object.entries(configMoves)) {
  move(join(ROOT, src), join(ROOT, dest));
}

// 3. Move docker-compose files and drop prefix or restructure
const dockerMoves = {
  "10_infrastructure_as_code/docker/compose.portal.yml": "10_infrastructure_as_code/docker/compose.portal.yml",
  "10_infrastructure_as_code/docker/compose.production.yml": "10_infrastructure_as_code/docker/compose.production.yml",
  "10_infrastructure_as_code/docker/compose.redis.yml": "10_infrastructure_as_code/docker/compose.redis.yml",
  "10_infrastructure_as_code/docker/compose.security.yml": "10_infrastructure_as_code/docker/compose.security.yml",
  "10_infrastructure_as_code/docker/compose.tools.yml": "10_infrastructure_as_code/docker/compose.tools.yml",
  "10_infrastructure_as_code/14_observability_configuration/docker-compose.yml": "10_infrastructure_as_code/14_observability_configuration/docker-compose.yml",
};

for (const [src, dest] of Object.entries(dockerMoves)) {
  move(join(ROOT, src), join(ROOT, dest));
}

// 4. Move 10_infrastructure_as_code/12_distributed_cache_runtime/ to 10_infrastructure_as_code/12_distributed_cache_runtime/
const redisTopologyDir = join(ROOT, "redis-topology");
if (existsSync(redisTopologyDir)) {
  const files = readdirSync(redisTopologyDir);
  for (const file of files) {
    move(join(redisTopologyDir, file), join(ROOT, "10_infrastructure_as_code/redis", file));
  }
}

// 5. Move 10_infrastructure_as_code/systemd/ to 10_infrastructure_as_code/10_infrastructure_as_code/systemd/
const systemdDir = join(ROOT, "systemd");
if (existsSync(systemdDir)) {
  const files = readdirSync(systemdDir);
  for (const file of files) {
    move(join(systemdDir, file), join(ROOT, "10_infrastructure_as_code/systemd", file));
  }
}

// 6. Merge 06_technical_documentation/wiki/ into 06_technical_documentation/wiki/
const wikiDir = join(ROOT, "wiki");
if (existsSync(wikiDir)) {
  const files = readdirSync(wikiDir);
  for (const file of files) {
    move(join(wikiDir, file), join(ROOT, "06_technical_documentation/wiki", file));
  }
}

// 7. Move 06_technical_documentation/reports/ to 06_technical_documentation/reports/
const reportDir = join(ROOT, "report");
if (existsSync(reportDir)) {
  const files = readdirSync(reportDir);
  for (const file of files) {
    move(join(reportDir, file), join(ROOT, "06_technical_documentation/reports", file));
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
    '"config": "07_toolchain_configuration/08_developer_tooling/knip.json"',
  );
  content = content.replace(
    /"config":\s*"config\/\.markdownlint\.json"/g,
    '"config": "07_toolchain_configuration/08_developer_tooling/.markdownlint.json"',
  );
  content = content.replace(
    /"config":\s*"config\/\.lintstagedrc\.mjs"/g,
    '"config": "07_toolchain_configuration/08_developer_tooling/.lintstagedrc.mjs"',
  );
  content = content.replace(
    /"config":\s*"config\/\.syncpackrc\.js"/g,
    '"config": "07_toolchain_configuration/08_developer_tooling/.syncpackrc.js"',
  );
  content = content.replace(
    /"extends":\s*\[\s*"\.\/config\/commitlint\.config\.mjs"\s*\]/g,
    '"extends": ["./07_toolchain_configuration/08_developer_tooling/commitlint.config.mjs"]',
  );
  content = content.replace(
    /docker\/docker-compose\.monitoring\.yml/g,
    "10_infrastructure_as_code/14_observability_configuration/docker-compose.yml",
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

  updated = updated.replace(/config\/\.fallowrc\.json/g, "07_toolchain_configuration/08_developer_tooling/.fallowrc.json");
  updated = updated.replace(/config\/\.gitleaks\.toml/g, "07_toolchain_configuration/08_developer_tooling/.gitleaks.toml");
  updated = updated.replace(/config\/\.lintstagedrc\.mjs/g, "07_toolchain_configuration/08_developer_tooling/.lintstagedrc.mjs");
  updated = updated.replace(/config\/\.markdownlint\.json/g, "07_toolchain_configuration/08_developer_tooling/.markdownlint.json");
  updated = updated.replace(/config\/\.mcp\.json/g, "07_toolchain_configuration/08_developer_tooling/mcp.json");
  updated = updated.replace(/config\/\.secretlintignore/g, "07_toolchain_configuration/08_developer_tooling/.secretlintignore");
  updated = updated.replace(/config\/\.secretlintrc\.json/g, "07_toolchain_configuration/08_developer_tooling/.secretlintrc.json");
  updated = updated.replace(/config\/\.syncpackrc\.js/g, "07_toolchain_configuration/08_developer_tooling/.syncpackrc.js");
  updated = updated.replace(
    /config\/commitlint\.config\.mjs/g,
    "07_toolchain_configuration/08_developer_tooling/commitlint.config.mjs",
  );
  updated = updated.replace(
    /config\/eslint\.boundaries\.cjs/g,
    "07_toolchain_configuration/08_developer_tooling/eslint.boundaries.cjs",
  );
  updated = updated.replace(/config\/knip\.json/g, "07_toolchain_configuration/08_developer_tooling/knip.json");
  updated = updated.replace(/config\/lighthouserc\.json/g, "07_toolchain_configuration/08_developer_tooling/lighthouserc.json");
  updated = updated.replace(/config\/\.memoryignore/g, ".memory/.memory/07_toolchain_configuration/.memoryignore");

  updated = updated.replace(
    /docker\/docker-compose\.portal\.yml/g,
    "10_infrastructure_as_code/docker/compose.portal.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.production\.yml/g,
    "10_infrastructure_as_code/docker/compose.production.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.redis\.yml/g,
    "10_infrastructure_as_code/docker/compose.redis.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.security\.yml/g,
    "10_infrastructure_as_code/docker/compose.security.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.tools\.yml/g,
    "10_infrastructure_as_code/docker/compose.tools.yml",
  );
  updated = updated.replace(
    /docker\/docker-compose\.monitoring\.yml/g,
    "10_infrastructure_as_code/14_observability_configuration/docker-compose.yml",
  );

  updated = updated.replace(/redis-topology\//g, "10_infrastructure_as_code/12_distributed_cache_runtime/");
  updated = updated.replace(/systemd\//g, "10_infrastructure_as_code/10_infrastructure_as_code/systemd/");

  updated = updated.replace(/(?<!docs\/)wiki\//g, "06_technical_documentation/wiki/");
  updated = updated.replace(/report\//g, "06_technical_documentation/reports/");

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
  "10_infrastructure_as_code/docker/compose.portal.yml",
  "10_infrastructure_as_code/docker/compose.production.yml",
  "10_infrastructure_as_code/docker/compose.redis.yml",
  "10_infrastructure_as_code/docker/compose.security.yml",
  "10_infrastructure_as_code/docker/compose.tools.yml",
];

for (const file of movedDockerFiles) {
  const filePath = join(ROOT, file);
  if (existsSync(filePath)) {
    let content = readFileSync(filePath, "utf8");
    content = content.replace(/context:\s*\./g, "context: ../../");
    content = content.replace(/env_file:\s*\.env\.08_developer_tooling/g, "env_file: ../../.env.tools");
    content = content.replace(
      /env_file:\s*apps\/portal\/\.env/g,
      "env_file: ../../00_applications/portal/.env",
    );
    content = content.replace(/\.\/config\/nginx\.conf/g, "../../07_toolchain_configuration/nginx.conf");
    content = content.replace(/\.\/certs/g, "../../certs");
    content = content.replace(/\.\/test-results/g, "../../test-results");

    writeFileSync(filePath, content, "utf8");
    console.log(`Adjusted relative paths in moved compose file: ${file}`);
  }
}

const monitoringCompose = join(ROOT, "10_infrastructure_as_code/14_observability_configuration/docker-compose.yml");
if (existsSync(monitoringCompose)) {
  let content = readFileSync(monitoringCompose, "utf8");
  content = content.replace(/\.\/monitoring\/prometheus\.yml/g, "./prometheus.yml");
  writeFileSync(monitoringCompose, content, "utf8");
  console.log(`Adjusted relative paths in: ${monitoringCompose}`);
}
