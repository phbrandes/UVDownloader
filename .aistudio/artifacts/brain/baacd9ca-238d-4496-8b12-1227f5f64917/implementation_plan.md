# Correção do Erro `Requested format is not available` no YouTube (MP4 + Cookies Inteligentes)

Este plano resolve o erro `ERROR: [youtube] YIow9ta6GiM: Requested format is not available` ao baixar vídeos do YouTube, mantendo o funcionamento perfeito já alcançado no Instagram e no TikTok.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> O diagnóstico abaixo explica exatamente por que o erro aconteceu no YouTube após as últimas mudanças e como o motor será ajustado para nunca falhar.

- **Causa Raiz 1 — Conflito de Clientes do YouTube ao Forçar Cookies em Vídeos Públicos**:
  Quando o `yt-dlp` recebe `--cookies` em um vídeo público comum do YouTube (`YIow9ta6GiM`), ele **desativa automaticamente os clientes móveis internos (`ios`, `android_vr`)** — que são os clientes que fornecem todos os streams MP4 sem bloqueio — e força o uso apenas do cliente `web`. Sem um interpretador JS configurado para resolver o desafio `n-sig` da sessão logada, o YouTube retorna apenas imagens de storyboard e oculta os fluxos de vídeo, causando o erro `Requested format is not available`.
- **Causa Raiz 2 — Filtro Rígido `-f bestvideo[height<=...]` vs. Ordenação Flexível `-S`**:
  Usar filtros rígidos como `bestvideo[height<=720]` falha quando um vídeo é vertical (onde a altura é 1920 e a largura é 1080) ou quando o YouTube disponibiliza apenas fluxos pré-mesclados. Substituir o filtro rígido por `-f "bv*+ba/b"` combinado com ordenação `-S "res:1080,ext:mp4:m4a,vcodec:h264,acodec:aac"` garante que o `yt-dlp` sempre encontre o melhor formato `.mp4` disponível sem jamais abortar com erro.

---

### 1. Overview & Core Concept

- **O Que Esta Correção Faz**:
  1. **Seleção Resiliente de Formato MP4 (`-f "bv*+ba/b" -S "res:...,ext:mp4:m4a"`)**: Em vez de exigir um filtro estrito que pode falhar, instrui o `yt-dlp` a ordenar os formatos priorizando streams nativos `.mp4` (H.264 + AAC/M4A) na resolução escolhida (`1080p`, `720p`, `480p`) e empacotar tudo em `.mp4` via FFmpeg.
  2. **Estratégia Inteligente de Cookies (Tentativa Direta + Fallback com Cookies + Runtime Node)**:
     - No **Instagram**: Continua usando `cookies.txt` diretamente (pois o Instagram exige sessão na maioria dos Reels).
     - No **YouTube**: Tenta primeiro a extração padrão (que libera os clientes de alta velocidade `ios`/`android_vr` sem bloqueio) e, caso o vídeo exija login ou verificação de idade (+18), reexecuta automaticamente passando `--cookies /app/data/cookies.txt` para concluir o download.
  3. **Limpeza Automática de Anexos Temporários**: Remove os novos prints salvos automaticamente em `/public/assets` para manter o repositório limpo.

---

### 2. User Experience & Visual Design

- **Fluxo Transparente**:
  1. O usuário cola qualquer link do YouTube (`youtu.be/YIow9ta6GiM` ou vídeos com restrição de idade) e clica em **Baixar** em `1080p`, `720p`, `480p` ou `MP3`.
  2. O backend seleciona o melhor stream compatível e entrega o arquivo `.mp4` (ou `.mp3`) sem exibir o erro `Requested format is not available`.
  3. Caso um vídeo do YouTube seja restrito (+18), o fallback com `cookies.txt` entra em ação automaticamente nos bastidores, sem que o usuário precise clicar duas vezes.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Usar `-S` (Format Sorting) em vez de Filtros Estritos `[height<=...]`**
  - *Abordagem Escolhida*: `-f "bv*+ba/b" -S "res:${quality},ext:mp4:m4a,vcodec:h264,acodec:aac" --merge-output-format mp4`.
  - *Por quê*: Garante 100% de compatibilidade com vídeos horizontais, verticais (Shorts) e vídeos antigos que não possuam streams separados, entregando sempre um arquivo `.mp4` válido.
- **Decisão 2: Fallback Automático de Cookies no YouTube**
  - *Abordagem Escolhida*: Para YouTube, executar a tentativa primária sem cookies (aproveitando os clientes móveis nativos do `yt-dlp`) e, se retornar erro de autenticação/idade, executar imediatamente a segunda tentativa com `--cookies /app/data/cookies.txt`. Para Instagram, manter o uso imediato dos cookies.
  - *Por quê*: Evita que o YouTube bloqueie os formatos em vídeos públicos por causa de restrições do cliente `web` autenticado, ao mesmo tempo em que garante o download de vídeos +18 usando a sua conta.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     Rota GET /api/download (Backend)                     │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼ (Instagram)                                           ▼ (YouTube)
┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│ • Executa yt-dlp COM cookies    │             │ 1ª Tentativa (Rápida / Pública) │
│ • -f "bv*+ba/b"                 │             │ • Clientes nativos (sem bloqueio│
│ • -S "ext:mp4:m4a,vcodec:h264"  │             │   de formato do cliente web)    │
│ • --merge-output-format mp4     │             │ • -f "bv*+ba/b" -S "res:1080,   │
└────────────────┬────────────────┘             │   ext:mp4:m4a,vcodec:h264"      │
                 │                              └────────────────┬────────────────┘
                 │                                               │ Se exigir login/+18
                 │                                               ▼
                 │                              ┌─────────────────────────────────┐
                 │                              │ 2ª Tentativa Automática         │
                 │                              │ • Reexecuta COM cookies.txt     │
                 │                              │ • Clientes web/tv_embedded      │
                 └───────────────────┬──────────┴────────────────┬────────────────┘
                                     ▼                           ▼
                        ┌──────────────────────────────────────────────┐
                        │  Arquivo .MP4 / .MP3 transmitido ao Browser  │
                        └──────────────────────────────────────────────┘
```
