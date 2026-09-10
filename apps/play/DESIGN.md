# FutHub Play Design System

## 0. Research Log

- Embedded refs: shortlisted `playstation.md`, `nike.md`, `kraken.md` → picked `taste-skill.md` + `playstation.md`; jogo competitivo pede contraste escuro, energia azul e navegação de console.
- Lazyweb: skipped — sem ferramenta de browser de pesquisa disponível nesta sessão.
- Imagen drafts: skipped — ilustração CSS vetorial mantém primeira carga leve e editável.

## 1. Atmosphere & Identity

Sala de jogo noturna, elétrica e focada. Assinatura: gramado luminoso recortado por faixas táticas azuis, como estádio visto antes do apito inicial.

## 2. Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Canvas | `--canvas` | `#08111d` | Fundo |
| Surface | `--surface` | `#101d2d` | Cards |
| Elevated | `--elevated` | `#172940` | Painéis ativos |
| Text | `--ink` | `#f4f8ff` | Texto principal |
| Muted | `--muted` | `#9dafc8` | Metadados |
| Accent | `--blue` | `#3f8cff` | CTA, foco |
| Accent bright | `--cyan` | `#69deff` | Destaque |
| Success | `--lime` | `#b9f768` | Progresso |
| Border | `--line` | `rgba(165, 202, 255, .16)` | Separação |

Accent só marca ação ou estado interativo. Contraste mínimo WCAG AA.

## 3. Typography

- Primary: `Inter, ui-sans-serif, system-ui, sans-serif`
- Display: `Arial Black, Inter, sans-serif`, clamp(2.25rem, 6vw, 5.5rem), 900, tracking -0.07em
- Title: 1.25rem, 800, tracking -0.04em
- Body: 1rem, 500, line-height 1.5
- Meta: .75rem, 800, uppercase, tracking .12em

## 4. Spacing & Layout

Base 4px. Conteúdo máximo 1200px. Desktop usa grid 12 colunas; mobile vira coluna única abaixo de 760px. Nav fica em linha única até 760px, depois reduz para marca e sessão.

## 5. Primitives & States

- `button`: 14px radius, 44px mínimo, azul sólido; hover sobe 2px; foco tem anel cyan 3px.
- `surface`: 20px radius, gradiente escuro, borda `--line`, sombra azul suave.
- `stat`: label uppercase, número forte, barra de progresso lime.
- `avatar`: círculo 40px com borda blue.
- Login tem CTA único Discord. Dashboard tem card de partida e cards de estado.

## 6. Motion

Transform e opacity somente. Transição padrão 180ms cubic-bezier(.2,.8,.2,1). Campo possui brilho estático; `prefers-reduced-motion` remove flutuação e transições.

## 7. Accessibility

Landmarks semânticos, foco sempre visível, botões com rótulos, cores nunca são único canal de estado. Alvos interativos mínimos 44px. Contraste AA.

## 8. Accepted Debt

- Dashboard mostra estado inicial local após OAuth; conectar ranking, elenco e mercado quando endpoints autenticados existirem.
