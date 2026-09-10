# FutHub

Sistema de futebol para criar times e disputar ligas.

> Documentação: [victorgabrieldeon.github.io/futhub](https://victorgabrieldeon.github.io/futhub/)

## Stack

- Node.js 22 + TypeScript strict
- pnpm workspaces + Turborepo
- Fastify para API e proxy do painel
- Vite + React Router DOM para painel administrativo
- Discord.js para bot
- PostgreSQL + Drizzle ORM
- Biome para formatação e lint
- Vitest para testes

## Estrutura

```text
apps/
  api/          API HTTP
  admin/        Painel administrativo
  discord-bot/  Bot Discord
packages/
  config/       Configurações TypeScript compartilhadas
  database/     Schema, migrations e cliente Drizzle
  design-system/ Tokens e primitivas visuais compartilhadas
```

## Desenvolvimento local

Pré-requisitos: Docker, um cluster Kubernetes local e [DevSpace](https://www.devspace.sh/docs/getting-started/installation). No Docker Desktop, habilite Kubernetes nas configurações. Node.js e dependências JavaScript ficam dentro da imagem de desenvolvimento; não é preciso executar `pnpm install` para subir ambiente.

```bash
corepack enable
pnpm dev:devspace
```

`devspace.yaml` cria `.env` a partir de `.env.example` quando necessário, gera tokens locais, constrói imagem de desenvolvimento e aplica manifests Kubernetes com Kustomize. PostgreSQL e MinIO usam volumes persistentes. Mudanças em `apps/` e `packages/` são sincronizadas nos pods; API e painel recompilam em modo watch.

PostgreSQL, API, painel e MinIO não publicam portas próprias. DevSpace encaminha Caddy para `localhost:8080`:

```bash
http://admin.futhub.localhost:8080
http://api.futhub.localhost:8080
http://db.futhub.localhost:8080
http://s3.futhub.localhost:8080
http://s3console.futhub.localhost:8080
```

pgAdmin abre sem login e já vem com PostgreSQL `FutHub` registrado.

DevSpace exibe logs e estado dos pods no terminal. Para incluir `discord-bot`, preencha `DISCORD_TOKEN` e `DISCORD_CLIENT_ID` em `.env` e use `pnpm dev:devspace:discord`.

Para encerrar:

```bash
pnpm dev:devspace:down
```

## Comandos

```bash
pnpm dev:devspace
pnpm dev:devspace:discord
pnpm dev:devspace:down
pnpm check
pnpm format
pnpm build
pnpm test
pnpm --filter @futhub/database db:generate
pnpm --filter @futhub/database db:migrate
```

## Assistente IA administrativo

No painel, abra **Assistente IA** (`/app/assistente`). Acesso usa autenticação administrativa existente.

1. Escolha protocolo OpenAI-compatible ou Anthropic-compatible e informe URL base HTTPS pública e API key.
2. Selecione modelo descoberto ou digite identificador manualmente quando listagem não estiver disponível. Modelo deve aceitar function tools; trocar modelo exige nova sessão.
3. Converse para consultar catálogo e propor Times, Coleções, Cards ou Packs. Revise todos os argumentos e confirme ou rejeite cada proposta. Mensagens no chat nunca substituem confirmação.

Integração usa tools internas, não MCP. Imagens continuam no editor existente. Nova mensagem substitui propostas pendentes; ações concluídas não são executadas novamente por repetir confirmação na mesma sessão.

Respostas aparecem em streaming. Interromper a exibição não cancela uma criação já aprovada. Após falha de conexão, atualize o estado antes de enviar novamente; a interface não repete mensagens ou aprovações automaticamente.

O histórico de sessões fica no PostgreSQL e pode ser consultado após desconexão, recarga da página ou reinício da API. Conversas arquivadas são somente leitura: propostas antigas não podem ser executadas pelo histórico. Sessões ativas continuam em memória e expiram após 30 minutos de inatividade.

Provedor, Base URL, modelos descobertos e último modelo ficam salvos no servidor. A API key é cifrada com AES-256-GCM, nunca retorna ao navegador e só pode ser reutilizada com o mesmo provedor e Base URL. Uma nova conexão pode atualizar a configuração. A chave de cifra deriva de `ADMIN_API_TOKEN`; sua rotação exige configurar novamente a conexão e muda o acesso ao histórico associado ao token anterior. Não há credenciais no storage do navegador.

Mensagens e dados consultados são enviados ao provedor escolhido e podem gerar cobrança nele. A tool `web_search` consulta Brave Search sem API key. Resultados exibem fontes, mas não garantem elenco completo ou atualizado. O assistente prioriza fontes oficiais e diferencia fatos pesquisados de atributos de jogo estimados, que continuam sujeitos à aprovação.

Antes de iniciar a API atualizada, execute `pnpm --filter @futhub/database db:migrate` para criar histórico e configuração (`0016` e `0017`). As rotas JSON existentes continuam disponíveis; rotas POST com sufixo `/stream` retornam SSE (`text`, `state`, `error`, `done`). O estado final é autoritativo; fim de conexão sem `done` exige consulta GET antes de outra ação.

URLs locais/privadas, HTTP e redirecionamentos são recusados. Cada chamada tem limite de 30 segundos. Sessões pertencem a um processo da API; múltiplas réplicas exigem afinidade de sessão ou futura implementação de armazenamento compartilhado criptografado. Após resposta perdida, consulte estado antes de tentar outra ação; nunca repita criação sem conferir catálogo.

## Em público

- [Roadmap](ROADMAP.md): direção e prioridades atuais.
- [Contribuir](CONTRIBUTING.md): ambiente local, testes e pull requests.
- [Código de conduta](CODE_OF_CONDUCT.md): espaço respeitoso para comunidade.
- [Segurança](SECURITY.md): reporte privado de vulnerabilidades.

## Licença

[MIT](LICENSE).
