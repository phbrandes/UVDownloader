FROM node:22-alpine

# Instalar ffmpeg, python3, yt-dlp[default] e cloudflared oficial para túnel HTTPS e domínio personalizado
RUN apk add --no-cache ffmpeg python3 py3-pip curl libc6-compat && \
    pip3 install --no-cache-dir --break-system-packages -U "yt-dlp[default]" && \
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código-fonte do projeto
COPY . .

# Compilar o frontend React/Vite para produção (pasta dist/)
RUN npm run build

# Criar pasta persistente para o histórico
RUN mkdir -p /app/data

# Definir variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Iniciar o servidor Express servindo o frontend compilado e as rotas da API
CMD ["npx", "tsx", "server.ts"]
