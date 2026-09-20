// Inline the stylesheet and the ES modules into one index.html that runs from disk.
import { readFileSync, writeFileSync } from 'node:fs';

const ORDER = ['rng', 'coder', 'channel', 'metric', 'fano', 'stats', 'treeStore', 'facility', 'display', 'tour', 'app'];
const src = f => readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const js = ORDER.map(m => `// ---- ${m}.js ----\n` + src(m + '.js')
  .replace(/^import .*;\s*$/gm, '')
  .replace(/^export /gm, '')).join('\n');
const html = src('index.template.html')
  .replace('/*__CSS__*/', () => src('style.css'))
  .replace('/*__JS__*/', () => `(() => {\n'use strict';\n${js}\n})();`);
writeFileSync(new URL('./index.html', import.meta.url), html);
console.log('index.html', (html.length / 1024).toFixed(1) + ' kB');
