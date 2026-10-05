/**
 * dockview-core 8.x builds dist/styles/dockview.css but leaves it out of the
 * published npm package; only the UMD bundle (dist/dockview-core.js) carries
 * the stylesheet, inlined as a string it injects at load time. The designer
 * uses the ESM build, so this script lifts that string out into
 * src/vendor/dockview.css. Re-run after upgrading dockview-core:
 *
 *   node scripts/extract-dockview-css.mjs
 */
import fs from 'fs';
import path from 'path';
import {createRequire} from 'module';
import {fileURLToPath} from 'url';

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve('dockview-core/package.json'));
const {version} = require('dockview-core/package.json');
const bundle = fs.readFileSync(path.join(pkgDir, 'dist', 'dockview-core.js'), 'utf8');

const marker = bundle.indexOf('dist/styles/dockview.css');
const assign = 's.textContent = ';
const start = bundle.indexOf(assign, marker);
if (marker < 0 || start < 0) {
    throw new Error(`could not find the inlined stylesheet in dockview-core ${version}`);
}
// the value is a double-quoted JS string literal: scan to its closing quote
let i = start + assign.length;
if (bundle[i] !== '"') throw new Error('unexpected stylesheet literal format');
let end = i + 1;
while (bundle[end] !== '"') end += bundle[end] === '\\' ? 2 : 1;
const css = JSON.parse(bundle.slice(i, end + 1));

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'vendor', 'dockview.css');
fs.writeFileSync(out, `/* dockview-core ${version} stylesheet, extracted by scripts/extract-dockview-css.mjs - do not edit */\n${css}`);
console.log(`wrote ${path.relative(process.cwd(), out)} (${css.length} chars, dockview-core ${version})`);
