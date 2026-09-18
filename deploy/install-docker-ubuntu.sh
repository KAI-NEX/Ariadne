#!/bin/sh
# Run on a fresh Ubuntu 24.04 server: sudo sh deploy/install-docker-ubuntu.sh
# Based on https://docs.docker.com/engine/install/ubuntu/ (2026-09-18).
set -eu
if [ "$(id -u)" -ne 0 ]; then
    echo "Run with sudo on your server." >&2
    exit 1
fi
if [ ! -r /etc/os-release ]; then
    echo "Ubuntu 24.04 is required; this script is not for your Mac." >&2
    exit 1
fi
. /etc/os-release
if [ "$ID" != ubuntu ] || [ "$VERSION_ID" != 24.04 ]; then
    echo "This installer supports Ubuntu 24.04 only." >&2
    exit 1
fi
if command -v docker >/dev/null 2>&1; then
    docker compose version
    echo "Docker already exists. No packages changed."
    exit 0
fi
# Do not remove or replace packages on a machine that already runs containers.
for ariadne_package in docker.io docker-compose docker-compose-v2 containerd runc podman-docker; do
    if dpkg-query -W -f='${Status}' "$ariadne_package" 2>/dev/null | grep -q 'install ok installed'; then
        echo "Existing container package found: $ariadne_package. Follow the official Docker installation guide." >&2
        exit 1
    fi
done
if [ -e /etc/apt/sources.list.d/docker.sources ] || [ -e /etc/apt/keyrings/docker.asc ]; then
    echo "Existing Docker repository configuration found; review it before installing." >&2
    exit 1
fi
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker compose version
