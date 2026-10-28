FROM node:22-alpine

# Instalar ffmpeg, python3 e yt-dlp[default] (inclui yt-dlp-ejs para desafios JS do YouTube com cookies)
RUN apk add --no-cache ffmpeg python3 py3-pip curl && \
    pip3 install --no-cache-dir --break-system-packages -U "yt-dlp[default]"

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
