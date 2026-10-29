import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

interface SecretPattern {
  name: string;
  regex: RegExp;
  validate?: (match: string) => boolean;
}

const KNOWN_PLACEHOLDERS = [
  'your-',
  'placeholder',
  'test_placeholder',
  'your-service-role-key',
  'your-anon-key',
  'your-bunny',
  'dummy',
  'fake',
  'xxx',
  'example',
  'mock-',
  'mock_',
  'test-',
  'test_',
  'sk-ant-api03-...',
];

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return KNOWN_PLACEHOLDERS.some((p) => lower.includes(p));
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return '***';
  }
  return secret.slice(0, 4) + '***' + secret.slice(-4);
}

const PATTERNS: SecretPattern[] = [
  {
    name: 'Private Cryptographic Key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  },
  {
    name: 'Kobara Live Secret Key',
    regex: /kobara_sk_live_[a-zA-Z0-9_]{16,}/,
    validate: (match) => !isPlaceholder(match),
  },
  {
    name: 'Anthropic Live API Key',
    regex: /sk-ant-api03-[a-zA-Z0-9_\-]{30,}/,
    validate: (match) => !isPlaceholder(match),
  },
  {
    name: 'OpenAI Secret Key',
    regex: /sk-[a-zA-Z0-9]{32,}/,
    validate: (match) => !isPlaceholder(match),
  },
  {
    name: 'Supabase Service Role JWT',
    regex: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/,
    validate: (match) => {
      try {
        const parts = match.split('.');
        if (parts.length < 2) return false;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        return payload.role === 'service_role';
      } catch {
        return false;
      }
    },
  },
  {
    name: 'High-Entropy Secret in Assignment',
    regex: /(?:SUPABASE_SERVICE_ROLE_KEY|KOBARA_API_KEY|KOBARA_SECRET_KEY|BUNNY_STREAM_API_KEY|BUNNY_STORAGE_API_KEY|CRON_SECRET)\s*[:=]\s*["']([^"'\r\n]{16,})["']/,
    validate: (match) => {
      const val = match.split(/[:=]/)[1]?.trim().replace(/^["']|["']$/g, '') || '';
      return !isPlaceholder(val);
    },
  },
];

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  '.open-next',
  '.wrangler',
  'coverage',
  '.lighthouse-reports',
]);

const IGNORED_FILES = new Set([
  '.env.example',
  'docs/ENVIRONMENT.md',
  'scripts/secret-scan.ts',
]);

interface Finding {
  file: string;
  line: number;
  patternName: string;
  maskedSnippet: string;
}

function scanFile(filePath: string, relativePath: string): Finding[] {
  if (IGNORED_FILES.has(relativePath.replace(/\\/g, '/'))) {
    return [];
  }

  // Skip binary files
  const ext = path.extname(filePath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.eot', '.zip', '.tar', '.gz'].includes(ext)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of PATTERNS) {
      const match = line.match(pattern.regex);
      if (match) {
        const matchedText = match[0];
        if (!pattern.validate || pattern.validate(matchedText)) {
          findings.push({
            file: relativePath,
            line: i + 1,
            patternName: pattern.name,
            maskedSnippet: maskSecret(matchedText),
          });
        }
      }
    }
  }

  return findings;
}

function walkDir(dir: string, baseDir: string): Finding[] {
  let findings: Finding[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      findings = findings.concat(walkDir(fullPath, baseDir));
    } else if (entry.isFile()) {
      findings = findings.concat(scanFile(fullPath, relPath));
    }
  }

  return findings;
}

function scanGitHistory(): Finding[] {
  const findings: Finding[] = [];
  try {
    // Check past commit diffs (limit to last 50 commits)
    const logDiff = execSync('git log -p -n 50 -- . ":!.env.example" ":!docs/ENVIRONMENT.md"', {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    const lines = logDiff.split('\n');
    let currentCommit = 'unknown';
    let currentFile = 'unknown';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('commit ')) {
        currentCommit = line.slice(7, 15);
      } else if (line.startsWith('+++ b/')) {
        currentFile = line.slice(6);
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        for (const pattern of PATTERNS) {
          const match = line.match(pattern.regex);
          if (match) {
            const matchedText = match[0];
            if (!pattern.validate || pattern.validate(matchedText)) {
              findings.push({
                file: `[git:${currentCommit}] ${currentFile}`,
                line: i,
                patternName: pattern.name,
                maskedSnippet: maskSecret(matchedText),
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Note: Git history scan skipped or encountered an error:', (err as Error).message);
  }
  return findings;
}

function main() {
  const baseDir = process.cwd();
  console.log('🔒 Starting Faro School Secret Scan...');
  console.log(`Directory: ${baseDir}\n`);

  console.log('1. Scanning working tree...');
  const workingTreeFindings = walkDir(baseDir, baseDir);

  console.log('2. Scanning git history (last 50 commits)...');
  const historyFindings = scanGitHistory();

  const allFindings = [...workingTreeFindings, ...historyFindings];

  console.log('\n--- Secret Scan Results ---');
  if (allFindings.length === 0) {
    console.log('✅ Clean: No exposed credentials or private keys detected.\n');
    process.exit(0);
  } else {
    console.error(`❌ FAILED: ${allFindings.length} potential secrets found!\n`);
    for (const f of allFindings) {
      console.error(`  - ${f.file}:${f.line} [${f.patternName}] -> Match: ${f.maskedSnippet}`);
    }
    console.error('\nPlease remove all credentials before proceeding.');
    process.exit(1);
  }
}

main();
