"use strict";

(function attach(root) {
  function attachActions(target, messages, origin) {
    if (!target || !root.AriadnePersonalMemory || !root.AriadneTruthPersistence) return;
    const elements = target.querySelectorAll(".v1-conversation-message");
    messages.forEach((message, index) => {
      if (message.role !== "USER" || !elements[index]) return;
      const button = document.createElement("button");
      button.type = "button"; button.className = "personal-memory-bridge";
      button.textContent = "整理为个人补充";
      button.addEventListener("click", async () => {
        button.disabled = true; let database;
        try {
          const Memory = root.AriadnePersonalMemory;
          const content = Memory.text(message.content ?? message.text, 6000);
          database = await root.AriadneTruthPersistence.openDatabase();
          const draft = { turn_id: Memory.id("personal-intake"), kind: "INTAKE", status: "DRAFT", created_at: Memory.now(), human_message: content,
            origin: { ...origin, message_id: message.message_id || null }, output: null };
          await Memory.write(database, "personal_conversation_turns", draft);
          const destination = `/personal-understanding.html?draft=${encodeURIComponent(draft.turn_id)}&embed=1`;
          if (root.parent !== root) {
            root.parent.postMessage({ type: "ariadne-open-personal-supplement", destination }, root.location.origin);
          } else {
            root.document.body.classList.add("v1-route-leaving");
            root.setTimeout(() => root.location.assign(destination.replace("&embed=1", "")), 320);
          }
        } catch (_error) { button.textContent = "暂时无法打开个人补充，请重试"; button.disabled = false; }
        finally { database?.close(); }
      });
      elements[index].append(button);
    });
  }
  root.AriadnePersonalMemoryBridge = Object.freeze({ attachActions });
}(window));
