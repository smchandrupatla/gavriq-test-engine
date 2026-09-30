// Scratch check (not part of the suite): every SIT-backed catalogue case must still
// point at a test that exists in its case file. Reads "key|script" lines on stdin.
import fs from 'node:fs';

const lines = fs.readFileSync(0, 'utf8').split(/\r?\n/).filter((l) => l.includes('|'));
let bad = 0;
for (const line of lines) {
  const [key, script] = [line.slice(0, line.indexOf('|')), line.slice(line.indexOf('|') + 1)];
  const [file, ...rest] = script.split('::');
  const name = rest.join('::');
  if (!fs.existsSync(file)) { console.log(`MISSING FILE  ${key}  ${file}`); bad++; continue; }
  if (!name) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes(name)) { console.log(`NO SUCH TEST  ${key}\n              ${script}`); bad++; }
}
console.log(`${lines.length} SIT-backed cases checked, ${bad} stale`);
