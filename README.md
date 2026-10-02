# Rádio Player Online 📻 — v3.2

No silêncio que por vezes nos cerca, a busca por uma melodia, uma voz ou uma
notícia se faz presente. Este projeto nasce como um humilde portal para esse
universo sonoro: um Rádio Player Online, desenhado para ser simples, direto e
sempre à mão.

## O que é

App web de player de rádios online: busca (API Radio Browser), favoritos por
categoria, estatísticas de uso, player com sleep timer e um Modo Carro (tela
cheia, botões grandes, presets das rádios mais ouvidas) para usar com o
celular preso no carro. HTML/CSS/JS puro, sem build e sem framework. É um
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
| `app.js` | Tudo o mais: player (HLS.js + `<audio>`), busca e filtros, favoritos e categorias, recentes, sleep timer, modais in-app, tema, PWA. |
| `radioData.js` | Estatísticas de uso — classe `RadioAnalytics`, isolada, grava em IndexedDB. `window.radioData`. |
| `wakeLock.js` | Screen Wake Lock. Expõe `window.RadioWakeLock`; o `app.js` chama `request()`/`release()` ao tocar/parar. |
| `sw.js` | Service Worker: cacheia o app shell (rede primeiro, cache como fallback offline); nunca cacheia áudio nem a API. Bump em `CACHE_NAME` a cada release. |
| `manifest.json` | Metadados do PWA. |
| `cloudflare-worker/nowplaying.js` | Worker opcional (deploy separado, fora do app shell) que lê o metadado ICY do stream pra mostrar capa/faixa no Modo Carro. Ver seção abaixo. |

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
  O Modo Carro pode mostrar isso (ver seção abaixo), mas requer um Worker
  à parte — não é algo que o app faça sozinho, sem configuração.

## Modo Carro: capa e faixa tocando (opcional)

Por padrão o Modo Carro mostra só nome da estação e tempo de escuta. Pra
mostrar também "Artista — Faixa" e a capa do álbum, é preciso um pequeno
proxy, porque o navegador não consegue ler o metadado ICY que o Shoutcast/
Icecast intercala dentro do áudio bruto — isso só dá pra ler no servidor.

1. Publique `cloudflare-worker/nowplaying.js` como um Worker no Cloudflare
   (dashboard → Workers & Pages → Create application → Create Worker, cole o
   arquivo, publique).
2. Ajuste `ALLOWED_ORIGINS` no topo do arquivo para o(s) domínio(s) reais do
   app antes de publicar.
3. Copie a URL do Worker publicado e cole em `NOWPLAYING_WORKER_URL`, no topo
   de `app.js`.

Sem isso configurado (valor padrão: string vazia), o Modo Carro funciona
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

- Media Session API (controles na tela de bloqueio / bluetooth)
- Reconexão automática do stream em quedas de conexão
- Agregador de podcasts
- Sincronização opcional de estatísticas entre dispositivos
