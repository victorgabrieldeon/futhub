# Contribuindo para FutHub

FutHub é construído em público. Bugs, ideias, documentação e código são contribuições válidas.

## Antes de abrir issue

- Bug reproduzível: use template de bug.
- Ideia ou melhoria: use template de funcionalidade e descreva problema antes de solução.
- Dúvida de uso: abra issue com contexto suficiente para outra pessoa reproduzir cenário.
- Vulnerabilidade: siga [SECURITY.md](SECURITY.md); não publique detalhes em issue.

## Ambiente local

Pré-requisitos: Docker, cluster Kubernetes local, DevSpace 6.3.21+, Node.js 22 e Corepack.

```bash
corepack enable
pnpm dev:devspace
```

DevSpace constrói imagem local, aplica manifests Kubernetes, inicia PostgreSQL e MinIO, aplica migrations e conecta sync/logs dos pods. Para encerrar:

```bash
pnpm dev:devspace:down
```

## Mudanças de código

1. Abra issue para mudança que altera jogo, API ou arquitetura.
2. Mantenha PR pequeno e com um objetivo único.
3. Atualize documentação quando mudar comportamento público.
4. Cubra contrato observável de mudança permanente com teste existente ou novo teste necessário.
5. Antes de enviar PR, execute:

   ```bash
   pnpm check
   pnpm build
   ```

## Pull requests

Explique problema, solução e como validar. Não inclua tokens, dados de jogadores ou conteúdo de `.env`. Um mantenedor revisa compatibilidade, comportamento e qualidade antes de merge.

## Conduta

Ao participar, siga [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
