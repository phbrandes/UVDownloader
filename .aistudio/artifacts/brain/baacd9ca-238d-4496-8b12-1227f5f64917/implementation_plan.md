# UVDownloader — Otimização Global de Código, Cache Inteligente e Inicialização

Revisão e enxugamento completo da base de código do **UVDownloader** para reduzir ainda mais o tamanho do projeto, eliminar código duplicado no frontend, acelerar o boot no Docker e entregar downloads repetidos ou compartilhados em **0,01 segundo** por meio de cache temporário com limpeza automática.

## Revisão e Decisões Confirmadas

> [!IMPORTANT]
> **Todas as decisões foram confirmadas para máxima performance e código enxuto:**
> - **Cache Temporário de Mídia e Metadados (10 min)**: Quando você ou um familiar colar um link já analisado ou clicar para baixar novamente um vídeo (ou re-baixar pelo Histórico), o servidor entregará o arquivo já processado instantaneamente a partir do `/tmp`, limpando automaticamente os arquivos após 10 minutos para não ocupar disco.
> - **Unificação e Limpeza do Frontend + Docker**: A função de disparo de download nativo (que estava duplicada entre o card de resultado e o painel de histórico) será centralizada, as chamadas iniciais de inicialização serão paralelizadas com `Promise.all`, importações e estados mortos serão removidos, e o container Docker iniciará diretamente o binário local sem a sobrecarga do `npx`.

---

## 1. Visão Geral & Conceito Central

- **O Que Faz**: Refina toda a arquitetura do UVDownloader para que tanto a análise de links quanto o download de vídeos e áudios operem na velocidade máxima da rede, com menor consumo de CPU/RAM e uma base de código mais limpa e fácil de manter.
- **Público / Uso**: Uso pessoal e compartilhado com familiares/amigos via túnel Cloudflare no seu servidor Homelab CachyOS.
- **Valor Principal**: Zero retrabalho do `yt-dlp`/`ffmpeg` em links repetidos nos últimos 10 minutos, carregamento inicial mais rápido da interface e redução de linhas desnecessárias em todo o projeto.

---

## 2. Experiência do Usuário & Design Visual

- **Fluxo de Uso Otimizado**:
  1. **Abertura Instantânea**: Ao abrir o painel, o histórico persistente e o status do túnel Cloudflare são carregados simultaneamente em paralelo (`Promise.all`).
  2. **Extração com Cache em Memória**: Se o mesmo link for consultado novamente dentro de 10 minutos (por exemplo, ao testar diferentes formatos ou compartilhar o link com outra pessoa), os metadados aparecem instantaneamente sem nova requisição externa.
  3. **Download com Cache de Arquivo (`/tmp`)**: O primeiro download usa 8 conexões paralelas (`-N 8`) e mesclagem única; se o mesmo vídeo e resolução forem solicitados novamente em até 10 minutos (ou baixados de novo pela aba Histórico), a transferência começa imediatamente na velocidade máxima do túnel.
- **Identidade Visual & Tema**:
  - *Direção Estética*: Utilitário Dark Homelab (`#07090E` background, `#0D111A` cards, `#10B981` emerald e `#0EA5E9` sky accents), mantendo 100% da interface limpa e responsiva.
  - *Tipografia & Hierarquia*: `Space Grotesk` para títulos, `Plus Jakarta Sans` para leitura fluida e `JetBrains Mono` para indicadores técnicos e links do túnel.

---

## 3. Decisões Técnicas & Trade-Offs

- **Decisão 1: Cache Temporário de 10 Minutos com Auto-Expiração (TTL)**
  - *Abordagem Escolhida*: Mapear chaves normalizadas `(url + qualidade)` para arquivos temporários em `/tmp` e metadados em memória, com um coletor periódico (`setInterval`) que remove arquivos expirados após 10 minutos.
  - *Por quê*: Evita que o `yt-dlp` e o `ffmpeg` tenham que baixar e unir novamente o mesmo vídeo quando o usuário clica duas vezes, compartilha com alguém ou usa o botão de re-download no Histórico, sem acumular lixo no SSD do Homelab.
- **Decisão 2: Centralização do Utilitário de Download e Limpeza de Código Morto**
  - *Abordagem Escolhida*: Mover a lógica de detecção de ambiente (iframe vs. Homelab/Cloudflare) e disparo de download para uma única função compartilhada na camada de serviço da API, removendo estados obsoletos de progresso simulado e ícones não utilizados nos componentes React.
  - *Por quê*: Elimina dezenas de linhas repetidas no frontend e reduz o bundle final compilado pelo Vite.
- **Decisão 3: Execução Direta no Container Docker**
  - *Abordagem Escolhida*: Substituir `npx tsx server.ts` pela execução direta do binário instalado em `node_modules/.bin/tsx` e construir o frontend em etapa enxuta.
  - *Por quê*: Corta o tempo de resolução de pacotes do `npx` toda vez que o container reinicia no CachyOS.

---

## 4. Arquitetura Técnica & Estratégia de Dados

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND REACT (Inicialização Paralela)              │
│                                                                          │
│  ┌────────────────────┐   ┌────────────────────┐   ┌──────────────────┐  │
│  │    HeroCapture     │   │  MediaResultCard   │   │ HistoryDashboard │  │
│  └─────────┬──────────┘   └─────────┬──────────┘   └────────┬─────────┘  │
│            │                        └───────────┬───────────┘            │
│            ▼                                    ▼                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │         Camada Unificada de API + triggerBrowserDownload()         │  │
│  └─────────┬────────────────────────────────────┬─────────────────────┘  │
└────────────┼────────────────────────────────────┼────────────────────────┘
             │ POST /api/extract                  │ GET /api/proxy-download
             ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     SERVIDOR EXPRESS (Homelab / Docker)                  │
│                                                                          │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ Cache de Metadados (RAM, 10 min) │  │ Cache de Mídia (/tmp, 10 min)│  │
│  │  • Hit: Retorno em < 1ms         │  │  • Hit: Stream imediato      │  │
│  │  • Miss: Extrator + Salva Cache  │  │  • Miss: yt-dlp -N 8 -> /tmp │  │
│  └──────────────────────────────────┘  └──────────────┬───────────────┘  │
│                                                       │                  │
│                                                       ▼                  │
│                                        ┌──────────────────────────────┐  │
│                                        │ Limpeza Automática (GC 60s)  │  │
│                                        │ Remove arquivos > 10 min     │  │
│                                        └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mapeamento de Estado e Ciclo de Vida
- **Normalização de Chave de Cache**: Links do YouTube (`youtu.be/ID?is=...` e `youtube.com/watch?v=ID`) geram a mesma chave canônica, garantindo que mesmo links com parâmetros de compartilhamento diferentes aproveitem o cache de metadados e de vídeo.
- **Deduplicação de Downloads Simultâneos**: Se dois dispositivos clicarem para baixar o mesmo vídeo ao mesmo tempo, ou se o arquivo já estiver no cache de 10 minutos em `/tmp`, o servidor envia o arquivo pronto via stream HTTP com suporte a `Content-Length` sem apagar o arquivo até que o TTL de 10 minutos expire.
