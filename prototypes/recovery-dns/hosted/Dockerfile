# Immutable official Linux/amd64 images resolved 18 October2026.
# Build/run and live deployment remain separate verification gates. Context: repo root.
FROM adguard/dnsproxy@sha256:29a27f0a695fa0ae97c56e61343bb7fb820b555e7069b87562a0d5b6fabaea6f AS engine
FROM node@sha256:8607a9064d4a571140998ae9e52a3b3fcf9cff361d04642d5971e6cd76d39e27 AS build
WORKDIR /build/prototypes/recovery-dns/hosted
COPY prototypes/recovery-dns/hosted/package.json prototypes/recovery-dns/hosted/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY functions/src/ /build/functions/src/
RUN npm run build:control-plane && npm prune --omit=dev --ignore-scripts --no-audit --no-fund
FROM node@sha256:8607a9064d4a571140998ae9e52a3b3fcf9cff361d04642d5971e6cd76d39e27
WORKDIR /opt/recovery-dns
COPY --from=engine /opt/dnsproxy/dnsproxy /opt/dnsproxy/dnsproxy
# Go TLS uses the OS trust bundle; Node's built-in roots alone are insufficient.
COPY --from=engine /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /build/prototypes/recovery-dns/hosted/node_modules ./node_modules
COPY --from=build /build/prototypes/recovery-dns/hosted/control-plane ./control-plane
COPY prototypes/recovery-dns/hosted/package.json ./
COPY prototypes/recovery-dns/hosted/src/ ./src/
ENV GCLOUD_PROJECT=freed-7d5ee INSTALLATION_ADAPTER_MODULE=/opt/recovery-dns/src/firebase-installations.js
USER node
EXPOSE 8080
CMD ["node", "src/main.js"]
