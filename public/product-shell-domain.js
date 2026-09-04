"use strict";

(function attachProductShell(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneProductShell = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createProductShell() {
  const CONTRACT = Object.freeze({
    import: Object.freeze({ root: "v1-import-shell", card: "v1-import-card" }),
    workspace: Object.freeze({
      layer: "v1-workspace-layer",
      backdrop: "v1-workspace-backdrop",
      shell: "v1-workspace-shell",
      panels: "v1-workspace-panels",
      content_pane: "v1-workspace-content-pane",
      conversation_pane: "v1-ariadne-pane",
      content_scroll: "v1-workspace-scroll-region",
      conversation_scroll: "v1-workspace-history",
      footer: "v1-workspace-content-footer",
    }),
    detail: Object.freeze({
      root: "v1-detail-shell",
      split: "v1-split-view",
      content_pane: "v1-structured-pane",
      conversation_pane: "v1-conversation-pane",
    }),
    conversation: Object.freeze({
      messages: "v1-conversation-messages",
      thread: "v1-conversation-thread",
      human_bubble: "v1-conversation-message user",
      assistant_bubble: "v1-conversation-message assistant",
      composer: "v1-conversation-form",
      input: "textarea",
      send: 'button[type="submit"]',
    }),
  });

  const panelTimers = new WeakMap();

  function requireElement(value, code) {
    if (!value) throw new Error(code);
    return value;
  }

  function requireClass(element, className, code) {
    requireElement(element, code);
    if (!element.classList.contains(className)) throw new Error(code);
    return element;
  }

  function bindImportShell(documentObject) {
    const shell = requireClass(documentObject?.querySelector("main.v1-import-shell"), CONTRACT.import.root, "product_import_shell_missing");
    const card = requireClass(shell.querySelector(".v1-import-card"), CONTRACT.import.card, "product_import_card_missing");
    return Object.freeze({ shell, card });
  }

  function bindConversation({ messages, form, status = null }) {
    requireClass(messages, CONTRACT.conversation.messages, "product_conversation_messages_missing");
    requireClass(messages, CONTRACT.conversation.thread, "product_conversation_thread_missing");
    requireClass(form, CONTRACT.conversation.composer, "product_conversation_composer_missing");
    const input = requireElement(form.querySelector(CONTRACT.conversation.input), "product_conversation_input_missing");
    const send = requireElement(form.querySelector(CONTRACT.conversation.send), "product_conversation_send_missing");
    return Object.freeze({ messages, form, input, send, status });
  }

  function bindWorkspaceShell(documentObject, ids) {
    const layer = requireClass(documentObject?.getElementById(ids.layer), CONTRACT.workspace.layer, "product_workspace_layer_missing");
    const backdrop = requireClass(layer.querySelector(`.${CONTRACT.workspace.backdrop}`), CONTRACT.workspace.backdrop, "product_workspace_backdrop_missing");
    const shell = requireClass(layer.querySelector(`.${CONTRACT.workspace.shell}`), CONTRACT.workspace.shell, "product_workspace_shell_missing");
    const panels = requireClass(shell.querySelector(`.${CONTRACT.workspace.panels}`), CONTRACT.workspace.panels, "product_workspace_panels_missing");
    const contentPane = requireClass(panels.querySelector(`.${CONTRACT.workspace.content_pane}`), CONTRACT.workspace.content_pane, "product_workspace_content_pane_missing");
    const conversationPane = requireClass(panels.querySelector(`.${CONTRACT.workspace.conversation_pane}`), CONTRACT.workspace.conversation_pane, "product_workspace_conversation_pane_missing");
    const contentScroll = requireClass(contentPane.querySelector(`.${CONTRACT.workspace.content_scroll}`), CONTRACT.workspace.content_scroll, "product_workspace_content_scroll_missing");
    const conversationScroll = requireClass(conversationPane.querySelector(`.${CONTRACT.workspace.conversation_scroll}`), CONTRACT.workspace.conversation_scroll, "product_workspace_conversation_scroll_missing");
    const footer = requireClass(contentPane.querySelector(`.${CONTRACT.workspace.footer}`), CONTRACT.workspace.footer, "product_workspace_footer_missing");
    const source = requireElement(documentObject.getElementById(ids.source), "product_workspace_source_missing");
    const processing = requireElement(documentObject.getElementById(ids.processing), "product_workspace_processing_missing");
    const content = requireElement(documentObject.getElementById(ids.content), "product_workspace_content_missing");
    const save = requireElement(documentObject.getElementById(ids.save), "product_workspace_save_missing");
    const saveStatus = requireElement(documentObject.getElementById(ids.save_status), "product_workspace_save_status_missing");
    const progress = requireElement(documentObject.getElementById(ids.progress), "product_workspace_progress_missing");
    const conversation = bindConversation({
      messages: documentObject.getElementById(ids.messages),
      form: documentObject.getElementById(ids.form),
      status: documentObject.getElementById(ids.conversation_status),
    });
    return Object.freeze({ document: documentObject, layer, backdrop, shell, panels, contentPane, conversationPane, contentScroll, conversationScroll, footer, source, processing, content, save, saveStatus, progress, conversation });
  }

  function setWorkspaceView(documentObject, view, embedded = false) {
    documentObject.body.classList.toggle("v1-workspace-view", view === "workspace");
    const windowObject = documentObject.defaultView;
    if (embedded && windowObject?.parent && windowObject.parent !== windowObject) {
      windowObject.parent.postMessage({ type: "job-radar-v1-import-view-state", view }, windowObject.location.origin);
    }
  }

  function showWorkspace(workspace, { source_name: sourceName, processing = false, model_workspace_ui: modelWorkspaceUi, embedded = false }) {
    const previousFocus = workspace.layer.classList.contains("hidden") ? workspace.document.activeElement : null;
    workspace.source.textContent = sourceName;
    modelWorkspaceUi.setProcessingState({ processing: workspace.processing, content: workspace.content, save: workspace.save, active: processing });
    workspace.save.disabled = true;
    workspace.saveStatus.textContent = "";
    workspace.contentPane.classList.remove("is-detail");
    workspace.layer.classList.remove("hidden");
    setWorkspaceView(workspace.document, "workspace", embedded);
    workspace.document.body.classList.add("v1-workspace-open");
    workspace.document.defaultView.requestAnimationFrame(() => workspace.layer.focus());
    return previousFocus;
  }

  function hideWorkspace(workspace, { embedded = false, restore_focus: restoreFocus = null } = {}) {
    workspace.layer.classList.add("hidden");
    setWorkspaceView(workspace.document, "import", embedded);
    workspace.document.body.classList.remove("v1-workspace-open");
    restoreFocus?.focus?.();
  }

  function bindDetailShell(documentObject, ids) {
    const root = requireClass(documentObject?.querySelector("main.v1-detail-shell"), CONTRACT.detail.root, "product_detail_shell_missing");
    const split = requireClass(root.querySelector(`.${CONTRACT.detail.split}`), CONTRACT.detail.split, "product_detail_split_missing");
    const contentPane = requireClass(split.querySelector(`.${CONTRACT.detail.content_pane}`), CONTRACT.detail.content_pane, "product_detail_content_pane_missing");
    const conversationPane = requireClass(documentObject.getElementById(ids.conversation_pane), CONTRACT.detail.conversation_pane, "product_detail_conversation_pane_missing");
    const edit = requireElement(documentObject.getElementById(ids.edit), "product_detail_edit_missing");
    const runtime = requireElement(documentObject.getElementById(ids.runtime), "product_detail_runtime_missing");
    const conversation = bindConversation({
      messages: documentObject.getElementById(ids.messages),
      form: documentObject.getElementById(ids.form),
      status: documentObject.getElementById(ids.status),
    });
    return Object.freeze({ document: documentObject, root, split, contentPane, conversationPane, edit, runtime, conversation });
  }

  function applyDetailRuntime(shell, { mode, recognition, conversation_allowed: conversationAllowed, runtime_label: runtimeLabel }) {
    shell.document.body.dataset.detailRuntime = mode;
    shell.document.body.dataset.recordRecognition = recognition;
    shell.document.body.classList.toggle("v1-ai-capable", conversationAllowed);
    shell.conversationPane.classList.toggle("hidden", !conversationAllowed);
    shell.conversationPane.setAttribute("aria-hidden", String(!conversationAllowed));
    shell.conversationPane.querySelectorAll("input, textarea, button").forEach((control) => { control.disabled = !conversationAllowed; });
    shell.edit.classList.toggle("hidden", conversationAllowed);
    shell.runtime.textContent = runtimeLabel;
  }

  function firstVisibleEditableControl(form, windowObject) {
    return [...form.querySelectorAll("input, textarea, select, button")].find((control) => {
      if (control.disabled || control.hidden || control.type === "hidden") return false;
      const style = windowObject.getComputedStyle(control);
      return control.offsetParent !== null && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function createDetailPanelController({ trigger, stages, window: windowObject }) {
    let current = "closed";
    const show = (stage, { focusFirst = false } = {}) => {
      current = stage;
      Object.entries(stages).forEach(([name, panel]) => {
        const active = name === stage;
        windowObject.clearTimeout(panelTimers.get(panel));
        panel.setAttribute("aria-hidden", String(!active));
        if (active) {
          panel.classList.remove("hidden");
          windowObject.requestAnimationFrame(() => {
            panel.classList.add("is-active");
            if (focusFirst) {
              panel.scrollIntoView({ behavior: "smooth", block: "center" });
              firstVisibleEditableControl(panel, windowObject)?.focus({ preventScroll: true });
            }
          });
        } else {
          panel.classList.remove("is-active");
          const timer = windowObject.setTimeout(() => panel.classList.add("hidden"), 210);
          panelTimers.set(panel, timer);
        }
      });
      trigger.setAttribute("aria-expanded", String(stage !== "closed"));
    };
    return Object.freeze({ show, current: () => current });
  }

  return Object.freeze({ CONTRACT, bindImportShell, bindWorkspaceShell, bindDetailShell, bindConversation, setWorkspaceView, showWorkspace, hideWorkspace, applyDetailRuntime, createDetailPanelController });
}));
