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
assert.equal(visit('http://127.0.0.1:8000/'), 'http://127.0.0.1:8000/workspace.html');
assert.equal(visit('http://localhost:8000/'), 'http://127.0.0.1:8000/workspace.html');
assert.equal(visit('https://web.example/'), 'https://web.example/workspace.html');
assert.equal(visit('http://127.0.0.1:8000/index.html'), undefined);
assert.equal(visit('http://127.0.0.1:8000/workspace.html'), undefined);
console.log('PASS entry: workspace default, explicit connection settings, stable origin, no settings loop');
