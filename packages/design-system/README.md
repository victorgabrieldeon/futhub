# Dream Fut Design System

Fundacao visual compartilhada para os produtos Dream Fut. O sistema parte da marca: verde-lima energetico, superficies verde-escuras e tipografia direta, de alto contraste.

## Uso

Importe a fundacao no layout raiz de cada aplicacao:

```css
@import '@dreamfut/design-system/primitives.css';
```

Use somente tokens semanticos, em vez de cores ou espacamentos literais:

```css
.example {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text);
  padding: var(--space-4);
}
```

## Regras

- `--color-brand` e suas variacoes representam a acao primaria. Nao use verde-lima em texto corrido ou superficies grandes.
- `--color-canvas` e `--color-surface` definem profundidade. Prefira bordas sutis a sombras para separar blocos.
- Use `--font-sans` para interface e `--font-mono` somente em dimensoes, IDs e dados tecnicos.
- A escala e baseada em multiplos de 4 px, de `--space-1` a `--space-8`.
- Use `--radius-sm` em controles e `--radius-md` em superficies. O produto evita cantos excessivamente arredondados.
- Estados de foco devem continuar visiveis por teclado com a cor de marca.

## Primitivas

- `.ds-button`: acao primaria.
- `.ds-field`: campo de formulario.
- `.ds-eyebrow`: rotulo contextual em caixa alta.
- `.ds-note`: aviso ou contexto secundario.

Primitivas devem cobrir padroes repetidos. Componentes de dominio, como uma carta de jogador, permanecem no app que os utiliza.
