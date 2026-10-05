# Rádio Player Online 📻 — v3.4

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
própria, aberta pelo 🔍 da barra superior. HTML/CSS/JS puro, sem build e sem framework. É um
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
| `radioData.js` | Estatísticas de uso — classe `RadioAnalytics`, isolada, grava em IndexedDB. `window.radioData`. |
| `wakeLock.js` | Screen Wake Lock. Expõe `window.RadioWakeLock`; o `app.js` chama `request()`/`release()` ao tocar/parar. |
| `sw.js` | Service Worker: cacheia o app shell (rede primeiro, cache como fallback offline); nunca cacheia áudio nem a API. Bump em `CACHE_NAME` a cada release. |
| `manifest.json` | Metadados do PWA. |
| `cloudflare-worker/nowplaying.js` | Worker opcional (deploy separado, fora do app shell) que lê o metadado ICY do stream pra mostrar capa/faixa na barra fixa e no Modo Carro. Ver seção abaixo. |

## Onde ficam os dados

Tudo local, nada vai para servidor.

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
| "Voltar" fecha a busca/Modo Carro em vez de sair do app | ✅ | n/a |

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

## Versionamento

Cada versão é uma **cópia completa** da pasta, nomeada por versão
(`MinhaRadio2.03.02` → `MinhaRadio3.0`). Não há git neste diretório; para uma
nova versão, copie a pasta atual e trabalhe na cópia.

## Licença

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — livre para
compartilhar e adaptar, com atribuição e para uso não comercial.

## Ideias para próximas versões

- Reconexão automática do stream em quedas de conexão
- Agregador de podcasts
- Sincronização opcional de estatísticas entre dispositivos
