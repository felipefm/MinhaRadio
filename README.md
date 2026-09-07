# Rádio Player Online 📻 — v3.0

No silêncio que por vezes nos cerca, a busca por uma melodia, uma voz ou uma
notícia se faz presente. Este projeto nasce como um humilde portal para esse
universo sonoro: um Rádio Player Online, desenhado para ser simples, direto e
sempre à mão.

## O que é

App web de player de rádios online: busca (API Radio Browser), favoritos por
categoria, estatísticas de uso e player com sleep timer. HTML/CSS/JS puro, sem
build e sem framework. É um **PWA** — instalável e com o "casco" funcionando
offline.

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
| `app.js` | Tudo o mais: player (HLS.js + `<audio>`), busca e filtros, favoritos e categorias, recentes, sleep timer, modais in-app, tema, PWA. |
| `radioData.js` | Estatísticas de uso — classe `RadioAnalytics`, isolada, grava em IndexedDB. `window.radioData`. |
| `wakeLock.js` | Screen Wake Lock. Expõe `window.RadioWakeLock`; o `app.js` chama `request()`/`release()` ao tocar/parar. |
| `sw.js` | Service Worker: cacheia o app shell (cache-first); nunca cacheia áudio nem a API. Bump em `CACHE_NAME` a cada release. |
| `manifest.json` | Metadados do PWA. |

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
- Nome da música tocando não é exibido: streams ICY não expõem metadata ao
  JavaScript, e a API Radio Browser não fornece "now playing".

## Versionamento

Cada versão é uma **cópia completa** da pasta, nomeada por versão
(`MinhaRadio2.03.02` → `MinhaRadio3.0`). Não há git neste diretório; para uma
nova versão, copie a pasta atual e trabalhe na cópia.

## Licença

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — livre para
compartilhar e adaptar, com atribuição e para uso não comercial.

## Ideias para próximas versões

- Media Session API (controles na tela de bloqueio / bluetooth)
- Reconexão automática do stream em quedas de conexão
- Agregador de podcasts
- Sincronização opcional de estatísticas entre dispositivos
