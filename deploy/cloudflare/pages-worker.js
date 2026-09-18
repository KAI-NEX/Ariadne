// Only API paths reach this Worker. All UI assets stay on free Pages hosting.
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/") || path === "/healthz") {
      if (!env.ARIADNE_API) return Response.json({error: "WEB_API_BINDING_REQUIRED", network_call_made: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
      return env.ARIADNE_API.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
