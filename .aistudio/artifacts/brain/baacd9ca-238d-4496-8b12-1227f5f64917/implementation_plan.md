# Plano Atualizado: Domínio Próprio com Conta Cloudflare + Persistência Permanente do Histórico

## 1. Domínio Fixo Personalizado via Conta Cloudflare (Cloudflare Zero Trust Tunnel)
Como você já possui uma conta na Cloudflare e deseja acessar por um endereço fixo (como `uvdownloader.com` ou `uv.seudominio.com`) sem nunca digitar IP e sem o link mudar ao reiniciar:

- **Integração no `docker-compose.yml` com `TUNNEL_TOKEN`:**
  - Configuraremos o serviço oficial `cloudflared` no `docker-compose.yml` no modo **Zero Trust Named Tunnel** (`tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}`).
  - Criaremos o suporte ao arquivo `.env` (e `.env.example`) onde você cola o `CLOUDFLARE_TUNNEL_TOKEN` da sua conta Cloudflare e o seu `PUBLIC_DOMAIN` (ex.: `https://uvdownloader.com`).
- **Aba "Domínio & Cloudflare" no Modal Configurar Homelab (`HomelabModal.tsx`):**
  - Exibirá o seu endereço fixo configurado (com **QR Code** para escanear com o celular e botão de copiar).
  - Incluirá o passo a passo direto de **3 passos no painel Cloudflare Zero Trust** (`Networks -> Tunnels`) apontando o seu domínio para `http://uv-downloader:3000` (nome do container na rede interna do Docker).
  - Permitirá salvar/atualizar o endereço do seu domínio personalizado diretamente pela interface para ficar salvo no seu painel.

---

## 2. Persistência Permanente do Histórico de Downloads (`./data/history.json`)
Você tem toda razão: o histórico **deve persistir para sempre** entre sessões, reinicializações do PC e atualizações do container.

- **Por que houve conflito antes:**
  - O arquivo `data/history.json` estava sendo rastreado pelo Git como se fosse um arquivo de código. Por isso, quando você baixava vídeos no seu PC (alterando o seu `data/history.json` local) e tentava dar `git pull`, o Git dava erro de conflito ou sobrescrevia o seu histórico com o arquivo do GitHub.
- **Como vamos resolver definitivamente:**
  - **Persistência no Volume Docker (`./data:/app/data`):** O `server.ts` continuará salvando todos os vídeos baixados em `./data/history.json` no disco do seu CachyOS, mantendo seu histórico intacto mesmo se você fechar o navegador, reiniciar o container ou desligar o PC.
  - **Proteção no `.gitignore`:** Colocaremos `data/history.json` e `data/settings.json` no `.gitignore` (assim como já fizemos com `data/cookies.txt`). Dessa forma, o seu histórico local **nunca será apagado ou sobrescrito** quando você atualizar o código pelo GitHub (`git pull`).
  - Se o arquivo `data/history.json` ainda não existir na primeira vez que o servidor iniciar, o `server.ts` o criará automaticamente sem tocar nos itens que você já baixou.

---

## Arquivos que Serão Atualizados
1. `docker-compose.yml` e `.env.example`: Adição do container `cloudflared` conectado à rede interna do `uv-downloader` usando o token da sua conta Cloudflare.
2. `server.ts` e `src/types.ts`: Persistência garantida de `/app/data/history.json` e `/app/data/settings.json` (para lembrar o domínio personalizado do seu Homelab) e exposição do status no `/api/server-info`.
3. `src/components/HomelabModal.tsx`: Nova aba/seção para o seu **Domínio Cloudflare Zero Trust** com guia passo a passo de vinculação a `http://uv-downloader:3000`, link clicável e QR Code para o celular.
4. `.gitignore`: Proteção de `data/history.json` e `data/settings.json` para que atualizações do Git nunca apaguem seu histórico salvo.
