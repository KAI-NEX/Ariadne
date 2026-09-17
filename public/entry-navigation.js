"use strict";
// Keep /index.html as connection settings and preserve the local launcher's
// exact-file readiness check. Daily entry uses the same origin/workspace.
if (location.pathname === "/") {
  const destination = new URL(location.href);
  destination.pathname = "/workspace.html";
  if (destination.hostname === "localhost") destination.hostname = "127.0.0.1";
  location.replace(destination.href);
}
