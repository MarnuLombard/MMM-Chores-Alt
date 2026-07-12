# Smoke-test image: MagicMirror with MMM-Chores-Alt runtime deps
# pre-installed for the container's Linux + Node 24 runtime. compose.yaml
# bind-mounts the compiled .js / .js.map / .css / package.json over the
# module dir at runtime, so host-side `npm run build` is picked up
# without rebuilding the image. node_modules stays inside the image
# layer (and the named volume populated from it) - never on the host.

FROM karsten13/magicmirror:latest

USER root
RUN mkdir -p /opt/magic_mirror/modules/MMM-Chores-Alt \
 && chown -R node:node /opt/magic_mirror/modules/MMM-Chores-Alt
USER node

WORKDIR /opt/magic_mirror/modules/MMM-Chores-Alt
COPY --chown=node:node package.json ./
# node:sqlite is built into Node, so there are no native modules to
# compile or rebuild - a plain production install is all the runtime needs.
RUN npm install --omit=dev --no-package-lock

WORKDIR /opt/magic_mirror
