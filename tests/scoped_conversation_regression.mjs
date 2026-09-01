import assert from "node:assert/strict";
import Conversation from "../public/scoped-conversation-domain.js";
import Candidate from "../public/candidate-context-domain.js";

const now = new Date("2026-08-26T09:30:00.000Z");
const cardA = { item_id: "project-job-radar", title: "Job Radar" };
const cardB = { item_id: "project-good-art", title: "Good Art" };
const sessionA = Conversation.createSession({ scope_type: "CANDIDATE_ITEM", scope_id: cardA.item_id }, now);
const sessionB = Conversation.createSession({ scope_type: "CANDIDATE_ITEM", scope_id: cardB.item_id }, now);
assert.notEqual(sessionA.conversation_id, sessionB.conversation_id);
assert.deepEqual(Conversation.validateSession(sessionA), []);
assert.equal(Conversation.createSession({ scope_type: "CANDIDATE_ITEM", scope_id: cardA.item_id }, now).conversation_id, sessionA.conversation_id);

const userA = Conversation.createUserMessage({ message_id: "msg-a-user", conversation_id: sessionA.conversation_id, content: "这里理解错了。" }, now);
const userB = Conversation.createUserMessage({ message_id: "msg-b-user", conversation_id: sessionB.conversation_id, content: "这张卡片需要澄清。" }, now);
const assistantA = Conversation.createAssistantMessage({
  message_id: "msg-a-ai", conversation_id: sessionA.conversation_id,
  result: { text: "我会只讨论当前项目。", provider: "deepseek", model: "deepseek-v4-flash", protocol: "OPENAI_RESPONSES", usage: { input_tokens: 12 }, warnings: [] },
}, now);
const assistantASwitched = Conversation.createAssistantMessage({
  message_id: "msg-a-ai-2", conversation_id: sessionA.conversation_id,
  result: { text: "同一会话可保留模型 provenance。", provider: "claude", model: "example-future-model", protocol: "ANTHROPIC_MESSAGES", usage: { input_tokens: 9 } },
}, new Date("2026-08-26T09:31:00.000Z"));
assert.deepEqual(Conversation.validateMessage(assistantA), []);
assert.equal(assistantASwitched.conversation_id, sessionA.conversation_id);
assert.equal(assistantASwitched.provider, "claude");
assert.throws(() => Conversation.createAssistantMessage({ message_id: "bad", conversation_id: sessionA.conversation_id, result: { text: "" } }, now), /invalid_model_result_text/);

const history = [userB, userA, assistantA, assistantASwitched];
for (let index = 0; index < 10; index += 1) history.push(Conversation.createUserMessage({ message_id: `msg-a-${index}`, conversation_id: sessionA.conversation_id, content: `turn ${index}` }, new Date(`2026-08-26T09:${32 + index}:00.000Z`)));
const compiled = Conversation.compileContext({ session: sessionA, candidate_item: cardA, messages: history, user_message: userA, relevant_source: { source_ref_id: "source-a", excerpt: "Relevant source only" } });
assert.equal(compiled.scope.id, cardA.item_id);
assert.equal(compiled.recent_messages.length, 8);
assert.equal(compiled.recent_messages.some((message) => message.conversation_id === sessionB.conversation_id), false);
assert.equal(compiled.current_candidate_item.item_id, cardA.item_id);
assert.equal(compiled.current_candidate_item.items, undefined);
assert.equal(compiled.current_user_message.content, userA.content);
assert.equal(compiled.current_candidate_context, undefined);
assert.equal(compiled.relevant_source_image, null);
const imageRelevant = Conversation.compileContext({ session: sessionA, candidate_item: cardA, messages: history, user_message: userA, relevant_source: { source_ref_id: "source-a" }, relevant_source_image: { source_ref_id: "source-a", image_data_url: "data:image/jpeg;base64,fixture" } });
assert.equal(imageRelevant.relevant_source_image.source_ref_id, "source-a");
assert.throws(() => Conversation.compileContext({ session: sessionA, candidate_item: cardA, messages: history, user_message: userA, relevant_source_image: { source_ref_id: "source-a" } }), /conversation_image_requires_relevant_source/);

const failure = Conversation.createConversationError("TIMEOUT", { retryable: true, message: "Timed out" });
assert.deepEqual(failure, { code: "TIMEOUT", retryable: true, message: "Timed out" });
assert.throws(() => Conversation.createConversationError("HTTP_500"), /invalid_conversation_error_code/);

const confirmedItem = { item_id: "project-job-radar", item_type: "PROJECT", title: "Job Radar", subtitle: null, time: null, summary: "A", facts: [], ownership: null, source_refs: [{ source_ref_id: "r", source_document_id: "s", location: "p.1", excerpt_or_reference: "x", support_relation: "EXPLICIT_SOURCE" }], uncertainties: [], review_status: "CONFIRMED", item_version: 1 };
const context = { context_id: "context-1", current_version: 1, source_document_ids: ["s"], items: [confirmedItem] };
assert.deepEqual(Candidate.validateCandidateContext(context), []);
Conversation.compileContext({ session: sessionA, candidate_item: confirmedItem, messages: [userA, assistantA], user_message: userA });
assert.deepEqual(Candidate.validateCandidateContext(context), []);
assert.throws(() => Conversation.compileContext({ session: sessionA, candidate_item: cardB, messages: [], user_message: userA }), /conversation_scope_candidate_mismatch/);

console.log("scoped_conversation_contract=pass");
