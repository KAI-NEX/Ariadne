import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const UI = createRequire(import.meta.url)('../public/conversation-ui-domain.js');
function fixture() {
  const listeners = new Map();
  const element = { hidden: true, addEventListener: (event, callback) => listeners.set(event, callback) };
  return { element, intro: UI.createIntro(element), click: selectable => listeners.get('click')({ target: { closest: () => selectable } }) };
}
const fresh = fixture();
assert.equal(fresh.element.hidden, true, 'wait for history before showing introduction');
fresh.intro.update(false);
assert.equal(fresh.element.hidden, false, 'empty conversation shows starter suggestions');
fresh.click(null);
assert.equal(fresh.element.hidden, false, 'clicking explanatory copy does not dismiss it');
fresh.click({});
assert.equal(fresh.element.hidden, true, 'choosing a suggestion or navigation link hides the complete introduction');
fresh.intro.update(false);
assert.equal(fresh.element.hidden, true, 'runtime changes and empty rerenders do not bring it back');
const sending = fixture();
sending.intro.update(false);
sending.intro.update(true);
assert.equal(sending.element.hidden, true, 'optimistic first message dismisses the introduction before the reply');
sending.intro.update(false);
assert.equal(sending.element.hidden, true, 'a failed request keeps the conversation view');
const history = fixture();
history.intro.update(true);
assert.equal(history.element.hidden, true, 'existing history never shows the starter introduction');
console.log('Conversation introduction: initial loading, empty state, choice, first message, failure and history PASS');
