"use strict";
// Every launch starts with runtime selection. Preserve the canonical local
// origin and the local launcher's exact-file readiness check.
if (location.pathname === "/" && location.hostname === "localhost") {
  const destination = new URL(location.href);
  destination.hostname = "127.0.0.1";
  location.replace(destination.href);
}
