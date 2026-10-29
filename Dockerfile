FROM node:22-alpine

# Instalar ffmpeg, python3, yt-dlp[default] e cloudflared oficial para túnel HTTPS e domínio personalizado
RUN apk add --no-cache ffmpeg python3 py3-pip curl libc6-compat && \
    pip3 install --no-cache-dir --break-system-packages -U "yt-dlp[default]" && \
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build && mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Inicializar diretamente via binário local tsx sem overhead de npx
CMD ["./node_modules/.bin/tsx", "server.ts"]
