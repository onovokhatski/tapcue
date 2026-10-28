// Build: compile Tailwind, resolve includes, inject token JSON, emit
//   dist/<page>.html            standalone (links tapcue.css)
//   dist/artifact/<page>.html   single file for claude.ai artifact (no skeleton, CSS inlined)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const page = process.argv[2] || 'design-system';
fs.mkdirSync('dist/artifact', { recursive: true });
execSync('npx tailwindcss -c tailwind.config.js -i src/app.css -o dist/tapcue.css --minify', { stdio: 'inherit' });
fs.copyFileSync('src/tokens.css', 'dist/tokens.css');
fs.copyFileSync('tailwind.config.js', 'dist/tailwind.config.js');

const include = (html) => html.replace(/<!-- include:([\w.-]+) -->/g, (_, f) => include(fs.readFileSync(`src/${f}`, 'utf8')))
  .replace(/<script src="([\w.-]+\.js)"><\/script>/g, (m, f) => fs.existsSync(`src/${f}`) ? `<script>\n${fs.readFileSync(`src/${f}`, 'utf8')}</script>` : m);
const tokensCss = fs.readFileSync('src/tokens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = [...tokensCss.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => ({ name, value: value.trim() }));
let html = include(fs.readFileSync(`src/${page}.html`, 'utf8')).replace('/* build:tokens */', JSON.stringify(tokens))
  .replace('__TOKENS_CSS__', fs.readFileSync('src/tokens.css', 'utf8').replace(/&/g, '&amp;').replace(/</g, '&lt;'));
// artwork: inline as data URIs so pages are self-contained
html = html.replace(/art\/([\w-]+)\.svg/g, (m, n) => 'data:image/svg+xml;base64,' + fs.readFileSync(`src/art/${n}.svg`).toString('base64'));
fs.writeFileSync(`dist/${page}.html`, html);

const css = fs.readFileSync('dist/tapcue.css', 'utf8');
let art = html
  .replace(/<!-- build:css -->[\s\S]*?<!-- \/build:css -->/, `<style>${css}</style>`)
  .replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/, '').replace(/<\/html>\s*/, '')
  .replace(/<head>\s*/, '').replace(/<\/head>\s*/, '').replace(/<body[^>]*>\s*/, '').replace(/<\/body>\s*/, '')
  .replace(/<meta charset="utf-8">\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
fs.writeFileSync(`dist/artifact/${page}.html`, art);
console.log(page, 'html', html.length, 'artifact', art.length, 'css', css.length);
