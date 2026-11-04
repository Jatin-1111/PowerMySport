#!/bin/bash
# Installs the Ping Pilott host agent on this instance (CPU/memory/disk/network).
# Opt-in: does nothing unless PINGPILOT_TOKEN is set as an EB environment property.
# Never fails a deploy: monitoring must not be able to block a release.

TOKEN="$(/opt/elasticbeanstalk/bin/get-config environment -k PINGPILOT_TOKEN 2>/dev/null)"

if [ -z "$TOKEN" ]; then
  echo "pingpilot-agent: PINGPILOT_TOKEN not set, skipping"
  exit 0
fi

if systemctl is-active --quiet pingpilot-agent; then
  echo "pingpilot-agent: already running, skipping"
  exit 0
fi

curl -fsSL --proto '=https' --tlsv1.2 --retry 3 --connect-timeout 15 \
  https://raw.githubusercontent.com/Jatin-1111/pingpilot-agent/main/install.sh -o /tmp/pingpilot-install.sh \
  && PINGPILOT_TOKEN="$TOKEN" sh /tmp/pingpilot-install.sh \
  || echo "pingpilot-agent: install failed (deploy continues)"

rm -f /tmp/pingpilot-install.sh
exit 0
