import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface EmojiMap {
  [code: string]: string;
}

interface NameMap {
  [code: string]: string;
}

interface FlagEntry {
  code: string;
  emoji: string;
  name: string;
}

const emojiSource = 'https://raw.githubusercontent.com/annexare/Countries/master/dist/minimal/countries.emoji.min.json';
const namesSource = 'https://raw.githubusercontent.com/annexare/Countries/master/dist/minimal/countries.en.min.json';

const execFileAsync = promisify(execFile);

async function fetchJson<T>(url: string): Promise<T> {
  const { stdout } = await execFileAsync('curl', ['-L', '--fail', '--silent', url]);
  return JSON.parse(stdout) as T;
}

async function buildLookup(): Promise<FlagEntry[]> {
  const [emojiMap, nameMap] = await Promise.all<[
    EmojiMap,
    NameMap
  ]>([fetchJson<EmojiMap>(emojiSource), fetchJson<NameMap>(namesSource)]);

  const entries: FlagEntry[] = Object.entries(emojiMap)
    .map(([code, emoji]) => {
      const name = nameMap[code];
      if (!name) {
        return null;
      }
      return { code, emoji, name } satisfies FlagEntry;
    })
    .filter((item): item is FlagEntry => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries;
}

async function saveLookup(flags: FlagEntry[]): Promise<void> {
  await mkdir('data', { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    count: flags.length,
    flags
  };
  const outputPath = resolve('data', 'flags.json');
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Saved ${flags.length} flag entries to ${outputPath}`);
}

(async () => {
  const flags = await buildLookup();
  await saveLookup(flags);
})();
