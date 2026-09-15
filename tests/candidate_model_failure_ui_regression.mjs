import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/v1-pages.js', import.meta.url), 'utf8');
const extract = (name, next) => source.slice(source.indexOf(`  function ${name}(`), source.indexOf(`  function ${next}(`));
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { textContent: '', open: false, classList: { add() {}, remove() {} }, showModal() { this.open = true; } });
  return elements.get(id);
};
const context = vm.createContext({
  window: {}, byId: element, candidateSelectionVersion: 7, candidateProcessingInProgress: true,
  candidateExecutionState: 'PROCESSING', refreshes: 0,
  refreshCandidateImportGate() { context.refreshes += 1; },
});
vm.runInContext(extract('personalErrorCopy', 'jobErrorCopy') + extract('showPersonalError', 'createDeletePopover'), context);

context.showPersonalError({ code: 'codex_timeout', candidateModelExecution: true });
const copy = element('candidate-model-failure-copy');
assert.match(copy.textContent, /超过等待时限/);
assert.match(copy.textContent, /原件已保留.*未保存任何模型提案.*无需重新上传/);
assert.equal(element('candidate-model-failure-dialog').open, true);
assert.equal(context.candidateExecutionState, 'READY');
assert.equal(context.candidateProcessingInProgress, false);
assert.equal(context.refreshes, 1);
// A second error replaces the old explanation; untrusted details never reach DOM.
context.showPersonalError({ code: 'deepseek_response_malformed', message: 'PRIVATE_PROVIDER_TEXT', candidateModelExecution: true });
assert.match(copy.textContent, /无法解析/);
assert.doesNotMatch(copy.textContent, /等待时限|PRIVATE_PROVIDER_TEXT/);
context.showPersonalError({ code: 'PRIVATE_UNKNOWN_CODE', candidateModelExecution: true });
assert.equal(copy.textContent, '操作未完成，请重试。');
context.showPersonalError({ code: 'codex_timeout', candidateModelExecution: true }, 6);
assert.equal(copy.textContent, '操作未完成，请重试。', 'stale execution cannot replace the current error');
console.log('Candidate error copy, retry state, stale result and private detail boundaries PASS');
