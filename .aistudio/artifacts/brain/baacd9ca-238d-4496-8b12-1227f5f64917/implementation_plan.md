# Correção do Extrator e Downloader do Instagram (Reels em .MP4, Imagens em .JPEG e Miniaturas)

Este plano detalha a atualização do motor de extração e download do Instagram no **UV Downloader** para resolver o problema onde Reels eram baixados como imagens `.jpeg` e as miniaturas (thumbnails) dos vídeos não eram exibidas.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo refletem suas escolhas confirmadas para o funcionamento do extrator do Instagram no seu Homelab.

- **Decisão Confirmada 1 (Formatos Suportados)**: Suporte completo para download de Reels e vídeos do Instagram em formato **`.mp4`** legítimo (via `yt-dlp` + `FFmpeg`) e download de imagens/capas em formato **`.jpeg`** de alta resolução.
- **Decisão Confirmada 2 (Autenticação via Cookies)**: Integração automática do arquivo **`cookies.txt`** (`--cookies /app/data/cookies.txt`) tanto na etapa de leitura de metadados/thumbnail quanto na etapa de download do vídeo com o `yt-dlp`, garantindo acesso mesmo quando o Instagram exigir conta logada.
- **Decisão Técnica Adicional (Proxy de Thumbnail Anti-CORS)**: Os servidores CDN do Instagram (`scontent.cdninstagram.com`) enviam o cabeçalho de segurança `Cross-Origin-Resource-Policy: same-origin`, que impede navegadores de exibirem a miniatura diretamente na tag `<img>`. Para corrigir isso, a miniatura será roteada automaticamente pelo proxy local do backend.

---

### 1. Overview & Core Concept

- **Causa Raiz do Problema Atual**:
  1. **Por que baixava `.jpeg` em vez de `.mp4`**: O extrator do Instagram tentava consultar a antiga API pública `oEmbed` da Meta (que hoje bloqueia chamadas sem token). Quando falhava, a variável `videoUrl` ficava vazia e o link de download apontava para a imagem de fallback. Além disso, o bloco do `yt-dlp` na rota de download estava restrito apenas a URLs do YouTube (`isYouTubeUrl`), ignorando links do Instagram.
  2. **Por que a miniatura do vídeo não aparecia**: Sem o `yt-dlp` na etapa de extração de metadados, o sistema não obtinha a URL real da capa do Reel, e mesmo quando obtida, o navegador bloqueava a imagem por restrição de CORS da CDN do Instagram.
- **O Que Esta Atualização Entrega**:
  - Extração real de metadados (título, autor, duração e URL da miniatura original) executando `yt-dlp --dump-single-json` com suporte a `cookies.txt`.
  - Exibição garantida da miniatura do Reel através do proxy de imagem do próprio servidor.
  - Download real de Reels e vídeos em **`.mp4`** (H.264/AAC remuxado via FFmpeg) e fotos/capas em **`.jpeg`**.

---

### 2. User Experience & Visual Design

- **Fluxo do Usuário**:
  1. O usuário cola o link de um Reel ou Post do Instagram (mesmo contendo parâmetros como `?igsh=...`).
  2. O backend sanitiza a URL, aciona o `yt-dlp` com os cookies configurados no Homelab e retorna os dados reais da publicação.
  3. O card de resultado exibe imediatamente a **miniatura original do Reel** (servida via proxy para evitar bloqueio de CORS), o `@autor`, a duração em fonte monoespaçada (`tabular-nums`) e as opções claras de download:
     - **Vídeo Reel Sem Marca d'Água (`.mp4`)**
     - **Áudio Extraído (`.mp3`)**
     - **Imagem / Capa em Alta Resolução (`.jpeg`)**
  4. Ao clicar em **Baixar** no vídeo, o `yt-dlp` baixa e empacota o fluxo em `.mp4` real e envia para o navegador com barra de progresso precisa.
- **Identidade Visual & Tema**:
  - Mantém a estética escura utilitária do **UV Downloader** (`#0F172A` / Slate-900), tipografia `Plus Jakarta Sans` + `JetBrains Mono` para métricas e tamanhos de arquivo, sem elementos visuais desnecessários.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Extração de Metadados do Instagram com `yt-dlp --dump-single-json`**
  - *Abordagem Escolhida*: Consultar o `yt-dlp` diretamente no backend durante o `POST /api/extract` para links do Instagram, passando `--cookies /app/data/cookies.txt` se o arquivo existir.
  - *Por quê*: Garante que o título real, nome do criador, duração e miniatura oficial do Reel sejam extraídos com precisão, usando a mesma sessão autenticada que fará o download.
  - *Alternativa Descartada*: Usar scrapers HTML simples com regex, pois o Instagram oculta os dados de vídeo atrás de desafios de login.
- **Decisão 2: Unificação do Motor `yt-dlp` + `FFmpeg` para YouTube, Instagram e TikTok**
  - *Abordagem Escolhida*: Expandir o processador `yt-dlp` na rota `GET /api/download` para atender links do Instagram (`instagram.com/reel/`, `/p/`, `/tv/`), aplicando `--merge-output-format mp4` e `--remux-video mp4`.
  - *Por quê*: Garante que todo Reel seja entregue como um arquivo `.mp4` legítimo e compatível com qualquer celular ou player, nunca como `.jpeg` ou `.webm`.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### Diagrama de Arquitetura e Fluxo de Dados (Instagram)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                        UV Downloader Frontend (React)                    │
│  [Input URL Instagram] ──► [Card de Resultado (Thumbnail via Proxy)]     │
└───────────────┬──────────────────────────────────────────┬───────────────┘
                │ 1. POST /api/extract                     │ 2. GET /api/download
                ▼                                          ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────┐
│     Extrator Instagram (Backend)      │  │   Motor de Download (Backend) │
│  • Limpa URL (?igsh=...)              │  │  • Detecta tipo:              │
│  • Executa: yt-dlp --dump-single-json │  │    ├─ Vídeo (.mp4):           │
│    + --cookies /app/data/cookies.txt  │  │    │   yt-dlp + ffmpeg remux  │
│  • Extrai:                            │  │    │   + cookies.txt ──► .mp4 │
│    - Título, @autor, duração          │  │    ├─ Áudio (.mp3):           │
│    - Thumbnail (encapsulada em proxy) │  │    │   yt-dlp -x ──► .mp3     │
│    - Opções (.mp4, .mp3, .jpeg)       │  │    └─ Imagem (.jpeg):         │
└───────────────────────────────────────┘  │        Proxy CDN ──► .jpeg    │
                                           └───────────────────────────────┘
```

#### Mapeamento de Estados e Tratamento de Erros
- **Extração com Cookies (`extractInstagram`)**:
  - Executa `yt-dlp --dump-single-json --no-warnings --no-playlist` (com `--cookies` quando `./data/cookies.txt` estiver presente).
  - Extrai `thumbnail` do JSON retornado pelo `yt-dlp` e gera uma URL de proxy local (`/api/download?url=<encoded_thumb>&filename=thumbnail.jpeg&platform=instagram`) para que o navegador carregue a imagem no card sem bloqueio de CORS.
  - Define a URL da opção de vídeo apontando para a URL limpa do Reel com `format=mp4`, e a opção de imagem apontando para a URL de alta resolução da imagem/capa com extensão `.jpeg`.
- **Download e Conversão (`GET /api/download`)**:
  - Verifica se a URL é do Instagram (`instagram.com` / `instagr.am`).
  - Se o formato solicitado for vídeo (`.mp4`) ou áudio (`.mp3`), executa o `yt-dlp` com `--cookies`, `--merge-output-format mp4` e `--remux-video mp4`, salvando em arquivo temporário no `/tmp`, enviando o `Content-Length` exato e removendo o arquivo temporário ao concluir.
  - Se o formato solicitado for imagem (`.jpeg` / `.jpg`), faz o proxy direto da imagem de alta resolução na CDN do Instagram (`scontent.cdninstagram.com`) com cabeçalho `Content-Type: image/jpeg`.
