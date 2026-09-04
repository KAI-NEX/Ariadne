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
    edit: Object.freeze({
      shell: "v1-edit-form",
      field: "v1-edit-field",
      actions: "v1-edit-actions",
      cancel: "[data-edit-cancel]",
      preview: "[data-edit-preview]",
      destructive: "[data-edit-destructive]",
      preview_panel: "v1-patch-card",
      preview_actions: "[data-edit-preview-actions]",
      apply: "[data-edit-apply]",
      back: "[data-edit-back]",
    }),
    conversation: Object.freeze({
      messages: "v1-conversation-messages",
      thread: "v1-conversation-thread",
      human_bubble: "v1-conversation-message user",
      assistant_bubble: "v1-conversation-message assistant",
      composer: "v1-conversation-form",
      field: "v1-composer-field",
      input: "textarea",
      send: 'button[type="submit"]',
    }),
  });

  const panelTimers = new WeakMap();
  const conversationAdapters = new WeakMap();

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

  function dispatchRuntimeImport(gate, { local, model }) {
    const mode = gate?.authority?.runtime?.mode;
    if (mode === "local" && typeof local === "function") return local();
    if (mode === "model" && typeof model === "function") return model();
    throw new Error("product_runtime_import_unavailable");
  }

  function setFeedback(target, { state = "IDLE", copy = "" } = {}) {
    if (!target) return;
    target.textContent = copy;
    target.dataset.feedbackState = state;
    target.classList.add("v1-feedback");
    target.classList.toggle("error", state === "FAILURE");
  }

  function bindConversation({ messages, form, status = null }) {
    requireClass(messages, CONTRACT.conversation.messages, "product_conversation_messages_missing");
    requireClass(messages, CONTRACT.conversation.thread, "product_conversation_thread_missing");
    requireClass(form, CONTRACT.conversation.composer, "product_conversation_composer_missing");
    const field = requireClass(form.querySelector(`.${CONTRACT.conversation.field}`), CONTRACT.conversation.field, "product_conversation_field_missing");
    const input = requireElement(form.querySelector(CONTRACT.conversation.input), "product_conversation_input_missing");
    const send = requireElement(form.querySelector(CONTRACT.conversation.send), "product_conversation_send_missing");
    return Object.freeze({ messages, form, field, input, send, status });
  }

  function bindConversationAdapter(binding, adapter) {
    const form = requireClass(binding?.form, CONTRACT.conversation.composer, "product_conversation_composer_missing");
    const input = requireElement(binding.input, "product_conversation_input_missing");
    if (!adapter || typeof adapter.domain !== "string" || typeof adapter.operation !== "string" || typeof adapter.submit !== "function") {
      throw new Error("product_conversation_adapter_invalid");
    }
    conversationAdapters.set(form, adapter);
    form.dataset.ariadneConversationDomain = adapter.domain;
    form.dataset.ariadneConversationOperation = adapter.operation;
    if (form.dataset.ariadneConversationBound === "true") return binding;
    form.dataset.ariadneConversationBound = "true";
    form.dataset.ariadneSubmitEvent = "idle";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      form.dataset.ariadneSubmitEvent = "fired";
      const activeAdapter = conversationAdapters.get(form);
      const content = String(input.value || "").trim();
      const available = typeof activeAdapter?.isAvailable === "function" ? activeAdapter.isAvailable() : true;
      const target = typeof activeAdapter?.resolveTarget === "function" ? activeAdapter.resolveTarget() : Object.freeze({});
      if (!content || !available || !target) return;
      input.value = "";
      await activeAdapter.submit(Object.freeze({ content, target, binding }));
    });
    return binding;
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
              panel.scrollIntoView({ behavior: "smooth", block: "start" });
              firstVisibleEditableControl(panel, windowObject)?.focus({ preventScroll: false });
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

  function bindDetailEditShell({ trigger, form, preview }) {
    const shell = requireClass(form, CONTRACT.edit.shell, "product_detail_edit_shell_missing");
    const fields = [...shell.querySelectorAll(`.${CONTRACT.edit.field}`)];
    if (!fields.length) throw new Error("product_detail_edit_fields_missing");
    const actions = requireClass(shell.querySelector(`.${CONTRACT.edit.actions}`), CONTRACT.edit.actions, "product_detail_edit_actions_missing");
    const cancel = requireElement(actions.querySelector(CONTRACT.edit.cancel), "product_detail_edit_cancel_missing");
    const previewAction = requireElement(actions.querySelector(CONTRACT.edit.preview), "product_detail_edit_preview_missing");
    const destructive = actions.querySelector(CONTRACT.edit.destructive);
    const previewPanel = requireClass(preview, CONTRACT.edit.preview_panel, "product_detail_edit_preview_panel_missing");
    const previewActions = requireElement(previewPanel.querySelector(CONTRACT.edit.preview_actions), "product_detail_edit_preview_actions_missing");
    const apply = requireElement(previewActions.querySelector(CONTRACT.edit.apply), "product_detail_edit_apply_missing");
    const back = requireElement(previewActions.querySelector(CONTRACT.edit.back), "product_detail_edit_back_missing");
    return Object.freeze({ trigger, shell, fields: Object.freeze(fields), actions, cancel, previewAction, destructive, previewPanel, previewActions, apply, back });
  }

  function createDetailEditController({ trigger, form, preview, window: windowObject, populate }) {
    const binding = bindDetailEditShell({ trigger, form, preview });
    const panels = createDetailPanelController({ trigger, stages: { edit: binding.shell }, window: windowObject });
    const open = ({ focusFirst = true, resetPreview = true } = {}) => {
      populate?.();
      if (resetPreview) binding.previewPanel.classList.add("hidden");
      panels.show("edit", { focusFirst });
    };
    const close = () => panels.show("closed");
    const toggle = () => panels.current() === "closed" ? open() : close();
    const showPreview = () => {
      close();
      binding.previewPanel.classList.remove("hidden");
      binding.previewPanel.scrollIntoView?.({ behavior: "smooth", block: "center" });
    };
    const backToEdit = () => {
      binding.previewPanel.classList.add("hidden");
      open({ resetPreview: false });
    };
    const complete = () => {
      binding.previewPanel.classList.add("hidden");
      close();
    };
    binding.trigger.addEventListener("click", toggle);
    binding.cancel.addEventListener("click", close);
    binding.back.addEventListener("click", backToEdit);
    return Object.freeze({ ...binding, open, close, toggle, showPreview, backToEdit, complete, current: panels.current });
  }

  return Object.freeze({ CONTRACT, bindImportShell, dispatchRuntimeImport, setFeedback, bindWorkspaceShell, bindDetailShell, bindConversation, bindConversationAdapter, bindDetailEditShell, setWorkspaceView, showWorkspace, hideWorkspace, applyDetailRuntime, createDetailPanelController, createDetailEditController });
}));
