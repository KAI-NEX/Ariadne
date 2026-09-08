"use strict";

(function attachGeminiBrowserRuntime(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.JobRadarGeminiBrowserRuntime = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createGeminiBrowserRuntime() {
  const PROVIDER = "gemini";
  const PROTOCOL = "GEMINI_REST_GENERATE_CONTENT";
  const MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
  const KNOWN_MULTIMODAL_MODELS = [
    "gemini-3.1-flash-lite",
  ];
  const SMOKE_INSTRUCTION = "Read the text in this image. Reply only with the text you see.";
  const SMOKE_EXPECTED_TEXT = "JOB RADAR TEST";

  function modelId(item) {
    return String(item?.name || "").replace(/^models\//, "").trim();
  }

  function supportsGenerateContent(item) {
    return Array.isArray(item?.supportedGenerationMethods) && item.supportedGenerationMethods.includes("generateContent");
  }

  function knownMultimodalCandidates(listing) {
    return (listing?.models || []).filter((item) => {
      return KNOWN_MULTIMODAL_MODELS.includes(modelId(item)) && supportsGenerateContent(item);
    });
  }

  function selectConnectionModel(listing) {
    const candidates = knownMultimodalCandidates(listing);
    for (const preferred of KNOWN_MULTIMODAL_MODELS) {
      const selected = candidates.find((item) => modelId(item) === preferred);
      if (selected) return modelId(selected);
    }
    return candidates.map(modelId).sort()[0] || null;
  }

  function endpointFor(model) {
    return `${MODELS_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;
  }

  function buildConnectionRequest(model, imageDataUrl) {
    if (!KNOWN_MULTIMODAL_MODELS.includes(model)) throw new Error("model_image_pdf_capability_unverified");
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(String(imageDataUrl || ""));
    if (!match) throw new Error("invalid_synthetic_multimodal_image");
    return {
      provider: PROVIDER,
      model,
      protocol: PROTOCOL,
      endpoint: endpointFor(model),
      body: {
        contents: [{ role: "user", parts: [
          { text: SMOKE_INSTRUCTION },
          { inlineData: { mimeType: match[1], data: match[2] } },
        ] }],
        generationConfig: { maxOutputTokens: 32 },
      },
    };
  }

  function normalizeConnectionResponse(payload) {
    const text = (payload?.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => typeof part?.text === "string" ? part.text.trim() : "")
      .filter(Boolean)
      .join("\n");
    if (!text) return { ok: false, failure_layer: "EMPTY_RESPONSE", text: "" };
    if (text.toUpperCase().replace(/\s+/g, " ").trim() !== SMOKE_EXPECTED_TEXT) return { ok: false, failure_layer: "SMOKE_MISMATCH", text };
    return { ok: true, text };
  }

  function failureLayer(status, payload, stage) {
    if (status === 401 || status === 403) return "AUTH";
    if (stage === "model_discovery" && status === 400) return "AUTH";
    if (status === 404) return "MODEL";
    if (status === 400) return "REQUEST";
    return "PROVIDER";
  }

  return Object.freeze({ PROVIDER, PROTOCOL, MODELS_ENDPOINT, SMOKE_INSTRUCTION, SMOKE_EXPECTED_TEXT, knownMultimodalCandidates, selectConnectionModel, buildConnectionRequest, normalizeConnectionResponse, failureLayer });
}));
