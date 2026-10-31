# Rádio Player Online 📻 — v3.7.0

No silêncio que por vezes nos cerca, a busca por uma melodia, uma voz ou uma
notícia se faz presente. Este projeto nasce como um humilde portal para esse
universo sonoro: um Rádio Player Online, desenhado para ser simples, direto e
sempre à mão.

## O que é

App web de player de rádios online: busca (API Radio Browser), favoritos por
categoria, estatísticas de uso, player com sleep timer e um Modo Carro (tela
cheia, botões grandes, presets das rádios mais ouvidas) para usar com o
celular preso no carro. A tela inicial fica com favoritos, recentes e mais
ouvidas; busca e "adicionar manualmente" (uso eventual) ficam numa tela
própria, aberta pelo 🔍 da barra superior. Opcionalmente toca também as
músicas de um servidor **Jellyfin** pessoal (ver "Minha biblioteca"). HTML/CSS/JS puro, sem build e sem framework. É um
**PWA** — instalável e com o "casco" funcionando offline.

## Como publicar

Servir a pasta em qualquer host estático (GitHub Pages, incl. subpasta de
repositório). Todos os caminhos são **relativos** — não há nada para editar.
Para desenvolver, qualquer servidor local serve (`python -m http.server`), já
que o Service Worker não registra em `file://`.

## Mapa dos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Estrutura e marcação de todas as seções. |
| `style.css` | Estilos. Design tokens (espaçamento, raios, cores, sombras) em `:root`; tema escuro e cores de destaque sobrescrevem tokens em `body.dark-theme` / `body.title-color-*`. |
| `app.js` | Tudo o mais: player (HLS.js + `<audio>`), Media Session, busca e filtros, favoritos e categorias, recentes, Modo Carro, sleep timer, modais in-app, tema, PWA. |
| `jellyfin.js` | Cliente do Jellyfin (login, listagens, URLs de áudio e capa) — `window.Jellyfin`. Fila e telas da biblioteca ficam no `app.js`. |
| `radioData.js` | Estatísticas de uso — classe `RadioAnalytics`, isolada, grava em IndexedDB. `window.radioData`. |
| `wakeLock.js` | Screen Wake Lock. Expõe `window.RadioWakeLock`; o `app.js` chama `request()`/`release()` ao tocar/parar. |
| `screensaver.js` | Descanso de tela (barras estilo Winamp, capa, relógio) e o visualizador sincronizado experimental. `window.RadioScreensaver`. |
| `presence.js` | Contador anônimo de ouvintes: manda o sinal enquanto toca e lê o painel do dono. `window.RadioPresence`. |
| `sw.js` | Service Worker: cacheia o app shell (rede primeiro, cache como fallback offline); nunca cacheia áudio nem a API. Bump em `CACHE_NAME` a cada release. |
| `manifest.json` | Metadados do PWA. |
| `cloudflare-worker/nowplaying.js` | Worker opcional (deploy separado, fora do app shell) que lê o metadado ICY do stream pra mostrar capa/faixa na barra fixa e no Modo Carro. Ver seção abaixo. |
| `cloudflare-worker/presence/` | Worker opcional do contador de ouvintes (Durable Object). Ver "Ouvintes". |

## Onde ficam os dados

Tudo local. As exceções são opcionais e descritas nas seções próprias: o
"tocando agora" das rádios (Worker), a biblioteca (seu Jellyfin) e o
contador anônimo de ouvintes (Worker, dá pra desligar).

**`localStorage`**

| Chave | Conteúdo |
|---|---|
| `radioFavorites` | `{ categoria: [estações] }` |
| `categoryOrder` | ordem das categorias |
| `radioRecents` | últimas 25 rádios tocadas |
| `radioTheme` | `"light"` / `"dark"` (ausente = segue o sistema) |
| `radioTitleColor` | cor de destaque |
| `radioSearchFilters` | último país/tag/idioma usados |
| `radioVolume` | último volume |
| `radioJellyfin` | endereço do Jellyfin, usuário, token da sessão e qualidade. A senha nunca é salva. |
| `radioJellyfinPlayed` | ids das últimas ~400 faixas tocadas (o "tocar tudo no aleatório" evita repetir) |
| `radioVisualizer` | `"1"` = descanso de tela sincronizado com a música (experimental) |
| `radioPresenceId` | código aleatório deste aparelho no contador de ouvintes |
| `radioPresenceOff` | `"1"` = não enviar o sinal anônimo |
| `radioPresenceToken` | chave do painel de ouvintes (só no aparelho do dono; também o marca como "seu") |

**IndexedDB** — banco `radioAnalyticsDB`, store `analytics`: clicks e tempo de
escuta por estação. Alimenta "Estatísticas" e "Top mais ouvidas".

O "Exportar favoritos" cobre só `radioFavorites`. O "Exportar dados" (em
Estatísticas) cobre só o IndexedDB. Não há backup unificado.

## Limitações conhecidas

- Stream só disponível em `http://` não toca em página servida por `https://`
  (bloqueio de conteúdo misto do navegador) — comum em rádios pequenas. O player
  tenta automaticamente a versão `https://` e a URL alternativa da estação antes
  de desistir, então isso só afeta rádios sem HTTPS de verdade.
- Áudio e streams HLS sempre exigem rede; offline entrega apenas a interface.
- Estatísticas, favoritos e configurações são **por navegador/dispositivo** —
  não sincronizam. Migre com exportar/importar.
- Nome da música tocando não é exibido por padrão: streams ICY não expõem
  metadata ao JavaScript, e a API Radio Browser não fornece "now playing".
  O app pode mostrar isso (ver seção abaixo), mas requer um Worker à parte —
  não é algo que o app faça sozinho, sem configuração.

## Plataforma-alvo: Android

O app é feito e testado para o **Chrome no Android**. Alguns recursos dependem
de APIs que outros navegadores não têm ou limitam — nesses casos o recurso
simplesmente não aparece, sem quebrar o resto:

| Recurso | Android (Chrome) | iPhone (Safari) |
|---|---|---|
| Modo Carro em tela cheia (esconde barra de status/navegação) | ✅ Fullscreen API | ❌ Safari só permite tela cheia em vídeo; as barras continuam visíveis |
| Capa/faixa na notificação e tela de bloqueio | ✅ Media Session | ⚠️ parcial |
| Capa/faixa no painel do carro (Bluetooth) | ✅ se o carro suportar (ver abaixo) | ⚠️ parcial |
| Botões do volante (play/stop, próxima/anterior) | ✅ | ⚠️ parcial |
| "Voltar" fecha a busca/biblioteca/Modo Carro em vez de sair do app | ✅ | n/a |

## Bluetooth do carro (Media Session)

O app publica o que está tocando pela Media Session API — o Android repassa
isso para a notificação, para a tela de bloqueio e, via Bluetooth (AVRCP), para
o painel do carro:

- **Título/artista**: "Faixa" e "Artista" quando há metadado (ver seção
  abaixo); senão, nome da estação e país/codec.
- **Capa**: capa do álbum → logo da estação → ícone do app, nessa ordem.
  Texto aparece em praticamente qualquer carro; **a capa só aparece se a
  central do carro suportar capa via Bluetooth (AVRCP 1.6+)** — muitas mostram
  só texto, e isso não tem como ser contornado pelo app.
- **Botões do volante/central**: ▶ reconecta na última rádio, ⏸/■ param (rádio
  ao vivo não tem pausa de verdade), ⏭/⏮ trocam entre os presets do Modo Carro
  (as mais ouvidas por tempo), mesmo com o Modo Carro fechado.

O Modo Carro pede tela cheia ao abrir e de novo a cada toque nele — o Android
sai da tela cheia ao alternar para outro app (GPS, por exemplo), e o navegador
só permite voltar a ela a partir de um toque.

## Capa e faixa tocando (opcional)

Por padrão o player mostra só nome da estação, país/codec/bitrate (na barra
fixa) e tempo de escuta (no Modo Carro). Pra mostrar também "Artista — Faixa"
e a capa do álbum — na barra fixa **e** no Modo Carro — é preciso um pequeno
proxy, porque o navegador não consegue ler o metadado ICY que o Shoutcast/
Icecast intercala dentro do áudio bruto — isso só dá pra ler no servidor.

1. Publique `cloudflare-worker/nowplaying.js` como um Worker no Cloudflare
   (dashboard → Workers & Pages → Create application → Create Worker, cole o
   arquivo, publique).
2. Ajuste `ALLOWED_ORIGINS` no topo do arquivo para o(s) domínio(s) reais do
   app antes de publicar.
3. Copie a URL do Worker publicado e cole em `NOWPLAYING_WORKER_URL`, no topo
   de `app.js`.

Sem isso configurado (valor padrão: string vazia), o app funciona
normalmente, só sem capa/faixa — nada quebra. Quando a estação não manda
metadado (rádio falada, por exemplo) ou não dá pra achar a capa, o app
também cai de volta no comportamento padrão silenciosamente. A busca de capa
usa a API pública da iTunes (sem chave, sem custo) como alternativa para
estações que não mandam a própria arte junto do metadado.

## Minha biblioteca (Jellyfin)

Toca as músicas de um servidor Jellyfin pessoal dentro do app: playlists,
álbuns, artistas, busca, "tocar tudo no aleatório" e "mix parecido" (o
Instant Mix do Jellyfin). Fica invisível até ser conectada: o botão 🎵 da
barra superior só aparece depois de conectar em **Configurações → Minha
biblioteca**.

**Por que o Tailscale Serve:** o app é servido em HTTPS, e o navegador
bloqueia áudio e chamadas HTTP numa página HTTPS — então
`http://ip-do-servidor:8096` não funciona. O Tailscale Serve dá ao servidor
um endereço `https://<máquina>.<tailnet>.ts.net` com certificado válido,
acessível só de dentro da tailnet (nada fica exposto na internet). Em casa o
Tailscale conecta direto pela rede local, então não há perda de velocidade.

Configuração (uma vez só):

1. No painel do Tailscale (admin → DNS), ligar **MagicDNS** e **HTTPS
   Certificates**.
2. No servidor, publicar a porta do Jellyfin. Com o Tailscale num container
   em modo `host` (app da BigBear no CasaOS), a regra precisa ficar **no
   arquivo** que o container lê ao subir (`TS_SERVE_CONFIG=/config/serve-config.json`).
   Um `tailscale serve` feito à mão só vale até o container reiniciar: com o
   arquivo ausente, ele sobe sem regra nenhuma. Crie a regra e grave-a no
   arquivo:
   ```bash
   sudo docker exec big-bear-tailscale tailscale serve --bg 8096
   F=/DATA/AppData/big-bear-tailscale/config/serve-config.json
   sudo docker exec big-bear-tailscale tailscale serve status --json | sudo tee "$F"
   ```
   Para conferir que sobrevive a um reinício:
   ```bash
   sudo docker restart big-bear-tailscale
   sleep 15
   sudo docker exec big-bear-tailscale tailscale serve status
   ```
   Deve mostrar `https://<máquina>.<tailnet>.ts.net` → `proxy http://127.0.0.1:8096`.

   **Sintoma de regra perdida:** o Jellyfin funciona na rede de casa, mas o
   app não conecta nem toca, `serve status` diz "No serve config" e o log do
   container (`docker logs big-bear-tailscale`) mostra
   `could not connect to local backend server at 127.0.0.1:443`. Refaça os
   comandos acima.

   **Ao renomear a máquina no Tailscale**, rode `tailscale serve reset` e os
   comandos acima de novo — a regra (e o arquivo) guardam o nome antigo
   (sintoma: "404 not found" no endereço novo).
3. No app: ⚙️ → Minha biblioteca → Conectar servidor, com o endereço `https://`
   do passo 2, usuário e senha do Jellyfin. O celular precisa estar com o
   Tailscale ligado (no Android, "VPN sempre ativa" evita esquecer).

Detalhes:

- **Qualidade:** "original" toca o arquivo como está (FLAC, MP3, AAC, Opus);
  "economizar dados" pede ao servidor MP3 192 kbps — útil no 4G.
- **Player:** faixa tem pausa de verdade (▶/❚❚), ⏭ na barra, e ⏮/■ no painel
  expandido, mais barra de tempo arrastável com tempo decorrido/duração (no
  Modo Carro também, em tamanho grande). Na notificação e no Bluetooth do
  carro, ⏭/⏮ seguem a fila. O Modo Carro também segue a fila.
- **Favoritas (❤):** usa o favorito do próprio Jellyfin — marcar no app
  aparece nos outros clientes e vice-versa. ❤ no player, no Modo Carro e em
  cada faixa das listas; a aba "❤ Favoritas" lista todas.
- **Mix parecido / do artista:** abre a lista montada pelo servidor (o
  InstantMix do Jellyfin) e já começa a tocar.
- **Aleatório sem repetir:** a fila tira faixas repetidas (inclusive a mesma
  música em álbuns diferentes, no mix e no "tocar tudo"). O "Tocar tudo no
  aleatório" evita as ~400 últimas faixas tocadas (`radioJellyfinPlayed`) e
  para no fim do lote.
- **Separado das rádios:** faixas não entram em estatísticas, recentes,
  "Top mais ouvidas" nem nos presets do Modo Carro.
- **Segurança:** o token da sessão fica no `localStorage` deste aparelho e vai
  na URL do áudio (o `<audio>` não manda headers). Ele vale só pro seu
  servidor e pode ser revogado no Jellyfin (Painel → Dispositivos) ou com
  "Desconectar" no app.
- O Service Worker não intercepta nada do Jellyfin (outro domínio).
- **Buffer:** enquanto uma faixa toca, a seguinte é baixada inteira pra
  memória (sem passar pelo cache HTTP) e a troca toca dela, sem depender da
  rede naquele instante. Download parado por 20 s é refeito (até 3 vezes); se
  não ficar pronta, a troca pede ao servidor como antes. O painel (▴) mostra
  "próxima pronta ✓". A URL do áudio leva o `Etag` do item (`v=`), pra que um
  arquivo corrigido no servidor não seja misturado com pedaços antigos no
  cache do Chrome.

### Problemas conhecidos e diagnóstico

- **FLAC "não suportado" que toca convertido:** capa embutida com defeito
  (`ffprobe` mostra `Could not read mimetype from an attached picture`). O
  Chrome recusa o arquivo inteiro. Correção no servidor, sem reconverter o
  áudio: `ffmpeg -i in.flac -map 0:a -c copy -map_metadata 0 out.flac`. O app
  não contorna isso de propósito — mostra o erro com o detalhe do navegador
  pra que o arquivo seja corrigido.
- **Músicas travando na troca (em observação):** em 26/10 e 31/10 a faixa
  seguinte não começava no Wi-Fi de casa; trocando pro 5G voltou ao normal, e
  depois o Wi-Fi também. Nos logs do Tailscale (horário em UTC, 3 h à frente
  de Brasília), o mesmo período mostra a conexão alternando a cada 1–2 min
  entre IPv4 da rede local e IPv6 (`now using …`) e linhas
  `derp-11 does not know about peer`. Hipóteses: troca automática de banda
  2,4/5 GHz do modem e o modo `TS_USERSPACE=true` do container, que lida mal
  com essas trocas. O buffer da próxima faixa (acima) reduz o efeito; ainda
  não há proteção pra uma queda no meio da faixa atual. No momento do
  travamento, rodar:
  ```bash
  sudo docker exec big-bear-tailscale tailscale status
  sudo docker logs --since 5m big-bear-tailscale 2>&1 | grep -iE "proxy|timed out|error|derp|now using"
  ```
  `relay` em vez de `direct`, ou muitas linhas `now using`/`derp`, confirmam
  que é a conexão. Próximos passos possíveis, se continuar: detector de
  travamento com reconexão visível na faixa atual, buffer de 2 faixas, e
  tirar o modo `userspace` do Tailscale no servidor.

## Descanso de tela

Botão 🌌 no Modo Carro e no painel do player (▴). Tela cheia preta com barras
estilo Winamp (com "picos" que caem devagar), capa, nome do que toca e
relógio; o bloco de informações muda de lugar a cada 20 s pra não marcar a
tela. Toque na tela (ou "voltar") pra sair. Mantém a tela ligada enquanto
aberto.

- **Animação (padrão):** as barras se mexem, mas não seguem a música.
- **Sincronizado com a música (experimental, Configurações → Descanso de
  tela):** só nas faixas da biblioteca. O arquivo da faixa é decodificado à
  parte (`OfflineAudioContext`) e o espectro (FFT de 2048 pontos, 32 faixas
  de 40 Hz a 16 kHz) e a onda são calculados no ponto em que o player está.
  O `<audio>` que toca **não** é ligado ao Web Audio: isso deixaria mudas as
  rádios sem CORS e poderia atrapalhar tocar com a tela desligada. Custo: se
  a faixa não estiver na memória (buffer), ela é baixada de novo; a análise
  ocupa ~40 MB por faixa de 4 min (liberados ao sair). Faixas com mais de
  15 min ficam na animação.
- Rádios ficam sempre na animação: a maioria não manda CORS, então a página
  não pode ler o áudio delas.

## Ouvintes (quem está usando o player)

O app é público: qualquer pessoa com o link ouve as rádios (a biblioteca
depende do seu Tailscale e login). Dois jeitos de saber se há mais gente:

**1. Cloudflare Web Analytics (visitas por dia, país, aparelho).** O site já
passa pela Cloudflare, então não precisa mexer no código: no painel da
Cloudflare → *Analytics & Logs* → *Web Analytics* → *Add a site* →
`radio.felipefm.com` → modo **automático** (a Cloudflare injeta o script).
Não usa cookies.

**2. "Ouvindo agora" no app (Configurações → 👥 Ouvintes).** Enquanto algo
toca, o app manda a cada 2 min um sinal anônimo pro Worker
`cloudflare-worker/presence`: um código aleatório do aparelho, o nome da
rádio (faixas da biblioteca aparecem só como "Minha biblioteca"), o tipo de
aparelho e se é um aparelho do dono. A Cloudflare acrescenta país e cidade
aproximados. Ao parar ou fechar, o app avisa que saiu; sem sinal por 5 min, o
aparelho some da lista. Por dia, o Worker guarda só os códigos dos aparelhos
que usaram (60 dias), pra contagem. O aviso aparece nas Configurações e dá pra
desligar o envio ali.

Só quem tem a **chave do painel** vê a lista (quem está ouvindo, de onde e há
quanto tempo, e aparelhos por dia). Ter a chave no aparelho também o marca
como "seu" na contagem.

Deploy do Worker (uma vez só, na pasta `cloudflare-worker/presence`):
```bash
npx wrangler login
npx wrangler deploy
npx wrangler secret put READ_TOKEN   # invente uma chave longa
```
Depois: cole a URL do Worker em `PRESENCE_WORKER_URL` no topo do `app.js`,
publique, e no app vá em ⚙️ → 👥 Ouvintes → "Tenho a chave do painel". Com a
URL em branco, o app não manda nada e a seção diz que não está configurado.
Usa Durable Object com SQLite, disponível no plano gratuito.

## Licença

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — livre para
compartilhar e adaptar, com atribuição e para uso não comercial.

## Ideias para próximas versões

- Playlists do Jellyfin como presets do Modo Carro
- Reconexão automática do stream em quedas de conexão (rádios e faixa atual da biblioteca)
- Agregador de podcasts
- Sincronização opcional de estatísticas entre dispositivos
