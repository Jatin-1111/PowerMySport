#!/bin/sh
set -e

# The app's own code (SSR fetches to NEXT_PUBLIC_API_URL, the /community
# rewrite in next.config.ts) hardcodes "localhost" for dev, assuming it runs
# on the same host as the API/community servers. Inside this container,
# "localhost" is the container itself — so forward those ports to whatever
# is actually listening on the host, without touching any app source files.
# Alpine's /etc/hosts resolves "localhost" to ::1 first. A plain IPv6
# wildcard listener also accepts IPv4 (Linux net.ipv6.bindv6only=0 default),
# so one TCP6-LISTEN per port covers both — binding TCP4+TCP6 separately
# fails with "Address in use" since the v6 wildcard already claims the port.
socat TCP6-LISTEN:5000,fork,reuseaddr TCP:host.docker.internal:5000 &
socat TCP6-LISTEN:3002,fork,reuseaddr TCP:host.docker.internal:3002 &

exec npm run dev
