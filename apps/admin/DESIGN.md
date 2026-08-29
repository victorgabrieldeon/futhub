# FutHub Admin Design System

## 1. Atmosphere & Identity

Painel operacional sóbrio, com catálogo esportivo expresso por capas de identidade. Assinatura: superfícies claras, detalhes violeta e capas coloridas para entidades do acervo.

## 2. Color

| Papel | Token | Uso |
| --- | --- | --- |
| Canvas | `--canvas` | Fundo da aplicação |
| Superfície | `--surface-card` | Cards, campos, diálogos |
| Texto | `--ink` | Títulos e conteúdo principal |
| Texto secundário | `--body` | Contexto e metadados |
| Borda | `--hairline-strong` | Separação de superfícies |
| Acento | `--accent` / `--futhub-violet` | Ações e estado ativo |
| Sucesso | `--success` | Estado disponível |
| Erro | `--error` | Estado destrutivo |

## 3. Typography

- Interface: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Metadados numéricos: `JetBrains Mono, Fira Code, monospace`.
- Títulos de página: 36px. Títulos de catálogo: 22px. Texto de apoio: 14–16px. Labels: 10–11px, maiúsculas.

## 4. Spacing & Layout

- Unidade base: 4px.
- Páginas usam `command-header` e `cards-panel`.
- Catálogos usam grids com tiles de largura mínima 280px e espaço de 20px.

## 5. Components

- `collection-tile`: identidade visual de coleção, time ou pack; capa alta, símbolo, estado e ação no rodapé.
- `command-tabs`: filtro horizontal com sublinhado violeta no estado ativo.
- `ops-button accent`: ação primária de criação ou publicação.
- `pack-canvas`: embalagem 600 × 800 construída por vetores Canvas. Replica moldura escura, foil, lacre, malha geométrica e bola da referência sem usar raster no preview. Título, subtítulo, cores, efeito e textura são camadas editáveis.

## 6. States & Interaction

- Tiles elevam 4px no hover; `prefers-reduced-motion` remove transições.
- Foco visível usa anel de alto contraste.
- Estados indisponíveis mantêm conteúdo legível com opacidade reduzida.

## 7. Accessibility

- Todo botão tem texto ou `aria-label`.
- Arte decorativa usa `alt=""`.
- Filtros usam `role="tablist"` e `role="tab"`.
- A arte do pack usa título acessível com nome e quantidade; detalhes visuais ficam dentro do SVG.

## 8. Accepted Debt

- Tokens ainda vivem em `globals.css`; migrar para arquivo dedicado somente se houver mais de um app consumindo mesmos tokens.
