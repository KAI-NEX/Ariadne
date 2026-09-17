import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('public/entry-navigation.js', 'utf8');
function visit(href) {
  let next;
  const location = new URL(href);
  location.replace = url => { next = url; };
  vm.runInNewContext(source, { location, URL });
  return next;
}
assert.equal(visit('http://127.0.0.1:8000/'), undefined);
assert.equal(visit('http://localhost:8000/'), 'http://127.0.0.1:8000/');
assert.equal(visit('http://localhost:8000/?entry=launch#model'), 'http://127.0.0.1:8000/?entry=launch#model');
assert.equal(visit('https://web.example/'), undefined);
assert.equal(visit('http://127.0.0.1:8000/index.html'), undefined);
assert.equal(visit('http://127.0.0.1:8000/workspace.html'), undefined);
const html = fs.readFileSync('public/index.html', 'utf8');
assert.doesNotMatch(html, /返回工作空间|href="\/workspace\.html"/);
assert.match(html, /id="runtime-selector"/);
assert.match(html, /id="runtime-action"/);
console.log('PASS entry: runtime selection first, no workspace shortcut, stable origin');
