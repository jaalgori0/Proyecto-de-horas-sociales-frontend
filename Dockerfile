# syntax=docker/dockerfile:1
# =============================================================================
# Frontend (Vite + React) — compilado con Node y servido por Nginx.
#
# VITE_API_URL se incrusta al compilar. Por defecto es RELATIVO (/api/v1):
# Nginx reenvía /api al contenedor del backend (ver nginx.conf), de modo que la
# app funciona igual con localhost, la IP del equipo o un nombre de dominio, sin CORS.
# =============================================================================

# ── Compilación ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ── Servidor estático ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
