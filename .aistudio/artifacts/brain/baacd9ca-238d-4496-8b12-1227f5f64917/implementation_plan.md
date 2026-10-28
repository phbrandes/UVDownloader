# OmniSnap — Self-Hosted Universal Media Downloader

Ferramenta self-hosted inspirada no SnapInsta para extração e download de mídias em alta qualidade e sem marca d'água de múltiplas redes sociais (Instagram, TikTok, YouTube e Pinterest), com detecção automática de links, seletor de formato/qualidade, proxy de download integrado para homelab e histórico persistente categorizado por plataforma.

### Decisões do Usuário & Definições Confirmadas

> [!IMPORTANT]
> Decisões chave alinhadas com as respostas do usuário:
> - **Mecanismo de Extração**: Backend integrado no Node/Express com extração direta de metadados, fallbacks resilientes e streaming de download por proxy (evitando problemas de CORS, tokens expirados ou bloqueios de navegador).
> - **Seleção de Qualidade e Formatos**: Modal/card com múltiplas opções para o usuário escolher antes de baixar (ex: 1080p Full HD, 720p HD, MP4 sem marca d'água, MP3 / Áudio isolado em alta taxa de bits, imagem original em alta resolução).
> - **Histórico no Homelab**: Armazenamento persistente de histórico com prévia em miniatura, metadados da mídia, data, filtros por rede social e ação de re-download imediato via proxy.

---

### 1. Visão Geral & Conceito do Produto

O **OmniSnap** é uma aplicação completa para ambientes de homelab e servidores locais que atua como uma central unificada de download de mídias de redes sociais:
- **Detecção Automática Inteligente**: Ao colar uma URL no campo principal ou clicar em "Colar da Área de Transferência", o sistema identifica instantaneamente o serviço de origem (Instagram Reels/Posts/Stories/Carrossel, TikTok Videos sem marca d'água, YouTube Vídeos/Shorts, e imagens/vídeos de Pins do Pinterest).
- **Sem Marca d'Água & Máxima Qualidade**: Extrai os fluxos diretos limpos de vídeo e imagens na resolução máxima disponível no provedor.
- **Seletor de Formato & Conversão**: Exibe grade com pré-visualização (título, autor, duração, miniatura) e cartões de download dedicados (Vídeo MP4 HD/FHD, Áudio MP3, Carrossel de Fotos).
- **Proxy de Stream Homelab**: O backend Node.js realiza o streaming do arquivo com cabeçalhos apropriados de `Content-Disposition: attachment`, garantindo que o download inicie diretamente no dispositivo sem redirecionamento para URLs externas com expiração rápida.
- **Histórico Persistente por Plataforma**: Aba dedicada para visualização de downloads anteriores, permitindo filtrar por rede social (Instagram, TikTok, YouTube, Pinterest), buscar por título/autor e rebaixar arquivos.

---

### 2. Experiência do Usuário & Design Visual

Seguindo as diretrizes de design para utilitários de alta produtividade (SaaS & Ferramentas Utilitárias):

- **Paleta de Cores e Atmosfera**:
  - **Fundo Neutro**: Fundo escuro contemporâneo (`slate-950` e `slate-900`) com superfícies limpas (`slate-900/80` com bordas sutis `border-slate-800`), transmitindo solidez de software self-hosted para homelab.
  - **Destaques por Plataforma**: Identidade visual refinada para cada rede social sem saturação excessiva (Instagram magenta/coral, TikTok ciano/vermelho, YouTube vermelho clássico, Pinterest escarlate).
  - **Contraste & Acessibilidade**: Ícones funcionais com a biblioteca Lucide, foco visível e tipografia legível (`Plus Jakarta Sans` para display e `DM Sans` para leitura, com números em `tabular-nums`).

- **Fluxo do Usuário**:
  1. **Barra de Captura Principal**: Campo de busca proeminente com botão de auto-colagem ("Colar link"), botão "Processar" com feedback de carregamento suave e botões de filtro rápido para cada plataforma.
  2. **Card de Prévia e Opções de Download**:
     - Visualização do thumbnail, título, autor/canal, avatar e duração.
     - Grade de botões de qualidade: "Vídeo MP4 1080p", "Vídeo MP4 720p", "Apenas Áudio MP3", "Imagem Original HD".
     - Barra de progresso de download e status do stream.
  3. **Painel de Histórico Organizado**:
     - Filtros em abas: "Todos", "Instagram", "TikTok", "YouTube", "Pinterest".
     - Busca em tempo real por título ou URL.
     - Cartões de histórico com miniatura, tag da plataforma, data/hora formatada, tamanho aproximado e botão de download rápido direto.
     - Ações de limpar histórico ou remover itens individuais.
  4. **Modo Homelab & Configurações**:
     - Indicador de status do servidor local (armazenamento, downloads ativos e versão do extrator).
     - Informações úteis para execução em Docker / servidor pessoal.

---

### 3. Principais Decisões Técnicas & Trade-Offs

- **Backend Express Full-Stack (`server.ts`)**:
  - *Abordagem*: Implementar rotas de API em `/api/extract` (analisa e resolve as fontes de mídia) e `/api/download` (atua como proxy de streaming direto com suporte a Range requests e `Content-Disposition`).
  - *Por que*: Evita bloqueios de CORS nos navegadores ao tentar baixar mídias diretamente de CDNs de redes sociais como Instagram e TikTok, além de contornar cabeçalhos `Referer` que barram downloads diretos.
- **Estratégia de Resolução Multi-Plataforma**:
  - *Instagram*: Extração de Reels, Posts e Carrosséis identificando URLs diretas de CDN do Graph/Post endpoints.
  - *TikTok*: Resolução de URLs de vídeo limpas sem marca d'água (`hd_play_url` / direct mp4 link).
  - *YouTube*: Extração de streams de áudio/vídeo em qualidades disponíveis (1080p, 720p, áudio m4a/mp3).
  - *Pinterest*: Resolução do link de pin para a versão máxima da imagem/vídeo original (`originals/` CDN do Pinterest).
- **Persistência do Histórico**:
  - Armazenamento sincronizado entre backend (arquivo JSON persistente no servidor homelab `data/history.json`) e cliente (armazenamento local com fallback), garantindo que os registros fiquem salvos mesmo reiniciando o navegador.

---

### 4. Arquitetura do Sistema & Diagrama de Componentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                        OmniSnap Web Interface                          │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ TopBar: Logo OmniSnap • Status Homelab • Seletor Tema        │     │
│   └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ Hero & Input: URL Input + Clipboard Paste + Auto Detection   │     │
│   └────────────────────────────────┬─────────────────────────────┘     │
│                                    │ (URL Submit / Auto-detect)        │
│                                    ▼                                   │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ Media Preview & Download Card                                │     │
│   │ • Thumbnail / Player Preview                                 │     │
│   │ • Title, Author, Platform Badge                              │     │
│   │ • Quality Matrix (1080p, 720p, 480p, MP3 Audio, HD Image)    │     │
│   │ • Download Action (Trigger stream proxy via /api/download)   │     │
│   └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ History & Archive Dashboard                                  │     │
│   │ • Platform Tabs: [Todos] [Instagram] [TikTok] [YouTube] [Pin]│     │
│   │ • Search bar & Stats (Total baixado, Itens salvos)           │     │
│   │ • History Grid: Miniaturas, Metadata, Botão Re-download      │     │
│   └──────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Fetch / Stream Proxy
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Express Backend Server (server.ts)                  │
│                                                                        │
│  • POST /api/extract ───▶ Platform Resolver Engine (YT, IG, TT, Pin)   │
│  • GET  /api/download ──▶ Media Stream Proxy (Streams MP4/MP3/JPG)     │
│  • GET/POST /api/history ▶ Persistent Storage (data/history.json)      │
│  • GET  /api/server-info ▶ Homelab Server Metrics & Health             │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Roteiro de Execução

1. **Configuração de Metadados e Servidor**:
   - Atualizar `metadata.json` e `<head>` em `index.html` com o nome e descrição do OmniSnap.
   - Configurar o backend Express em `server.ts` com suporte à extração de mídias e proxy de streaming.
2. **Mecanismo de Resolução Multi-Plataforma**:
   - Implementar detecção automática de domínio (`instagram.com`, `tiktok.com`, `youtube.com`/`youtu.be`, `pinterest.com`).
   - Mapear metadados (título, autor, duração, thumbnail) e formatos de download correspondentes (MP4 HD, MP4 SD, MP3 Áudio, Imagem Full HD).
3. **Interface do Usuário (UI)**:
   - Componente de captura rápida com botão "Colar da área de transferência".
   - Card interativo de resultado com visualizador e grade de seleção de qualidade/formato.
   - Painel de histórico filtrável por plataforma com opção de baixar novamente ou excluir.
   - Modal com instruções para rodar no Docker / Homelab local.
4. **Validação & Testes**:
   - Compilação do applet via `compile_applet` e verificação de tipagem completa em TypeScript.
