/* 把网页资源同步到 www/，供 Capacitor 打包安卓 APK 使用（webDir = 'www'）。
   线上 Vercel 部署仍走项目根目录，本脚本不影响部署。 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'www');

/* 需要打进 APK 的内容：页面、样式、脚本、图标、提示词存档、manifest、sw */
const INCLUDE_DIRS = ['css', 'js', 'icons', 'data'];
const INCLUDE_FILES = ['manifest.webmanifest', 'sw.js'];

/* 明确排除：仓库文档、决策日志、售卖说明、部署配置、构建产物 */
const EXCLUDE_TOP = new Set([
  '.git', '.github', 'node_modules', 'www', 'android', 'ios', 'scripts',
  'history', 'sell', 'dist', 'README.md', 'vercel.json', '.gitignore', '.DS_Store',
  'package.json', 'package-lock.json', 'capacitor.config.ts', 'capacitor.config.json',
]);

/* 仓库里保留、但不打进 APK 的文件（当前为空，出现零引用孤儿模块时往这里加） */
const EXCLUDE_FILES = new Set();

const noJunk = (src) => !src.endsWith('.DS_Store') && !EXCLUDE_FILES.has(relative(ROOT, src));

function htmlFiles() {
  return readdirSync(ROOT)
    .filter((n) => n.endsWith('.html') && !EXCLUDE_TOP.has(n))
    .sort();
}

function walk(dir, base = dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!noJunk(full)) continue;
    if (statSync(full).isDirectory()) walk(full, base, acc);
    else acc.push(full);
  }
  return acc;
}

/* www/ 是纯生成物（已 gitignore），每次运行先清空再复制，保证与根目录一致 */
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const f of htmlFiles()) {
  cpSync(join(ROOT, f), join(OUT, f), { filter: noJunk });
}
for (const f of INCLUDE_FILES) {
  const src = join(ROOT, f);
  if (!existsSync(src)) {
    console.warn(`⚠️  缺少 ${f}，已跳过`);
    continue;
  }
  cpSync(src, join(OUT, f), { filter: noJunk });
}
for (const d of INCLUDE_DIRS) {
  const src = join(ROOT, d);
  if (!existsSync(src)) {
    console.warn(`⚠️  缺少目录 ${d}/，已跳过`);
    continue;
  }
  cpSync(src, join(OUT, d), { recursive: true, filter: noJunk });
}

/* 产物清单核对 */
const files = walk(OUT).sort();
let total = 0;
const rows = files.map((f) => {
  const size = statSync(f).size;
  total += size;
  return { path: relative(OUT, f), kb: (size / 1024).toFixed(1) };
});

const pages = rows.filter((r) => r.path.endsWith('.html')).map((r) => r.path);
const leaked = rows.filter((r) => EXCLUDE_TOP.has(r.path.split('/')[0]));

console.log(`\n📦 www/ 共 ${rows.length} 个文件，${(total / 1024).toFixed(1)} KB\n`);
for (const r of rows) console.log(`   ${r.kb.padStart(8)} KB  ${r.path}`);
console.log(`\n页面 ${pages.length} 个: ${pages.join(', ')}`);
console.log(leaked.length ? `❌ 排除项泄漏进 www/: ${leaked.map((r) => r.path).join(', ')}` : '✅ 无排除项泄漏（history/ sell/ README.md vercel.json 均未打包）');
console.log(pages.length === 9 ? '✅ 9 个页面齐全' : `❌ 页面数应为 9，实际 ${pages.length}`);
console.log(existsSync(join(ROOT, 'node_modules')) && rows.some((r) => r.path.startsWith('node_modules'))
  ? '❌ node_modules 被复制进来了'
  : '✅ 未包含 node_modules');
if (EXCLUDE_FILES.size) {
  const leakedFiles = [...EXCLUDE_FILES].filter((f) => rows.some((r) => r.path === f));
  console.log(leakedFiles.length ? `❌ 排除文件仍被复制: ${leakedFiles.join(', ')}` : `✅ 排除文件未打包（${[...EXCLUDE_FILES].join(', ')}）`);
}
