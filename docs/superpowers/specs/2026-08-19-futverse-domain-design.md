# Design: domínio completo inspirado no Futverse v2

## Objetivo

Portar estrutura de domínio do Futverse v2 para Dreamfut em PostgreSQL/Drizzle. Entregar schema e migrations aplicáveis, preservando `usuarios` como identidade única de jogador.

## Decisões

- `usuarios` é o jogador. Não haverá tabela `players` ou duplicação de identidade Discord.
- Saldo, preços, recompensas e custos usam moedas inteiras.
- Ativos visuais são URLs opcionais; upload e storage não pertencem a este escopo.
- IDs de entidades de domínio são UUIDs. Tabelas de associação usam chaves compostas quando a identidade for formada pelas duas FKs.
- Nomes, títulos e descrições traduzíveis usam modelo multilíngue completo: texto base mais traduções por locale.
- Migrations não criam conteúdo administrativo ou dados iniciais.
- Migração de domínio não cria endpoints, comandos Discord, renderização de cards, compra de packs, mercado, trading ou automações.

## Modelo de localização

### `localized_texts`

Representa um texto sem idioma fixo.

### `localized_text_translations`

Guarda uma tradução por par `(localized_text_id, locale)`, com locale BCP-47 e conteúdo obrigatório. Coleções, itens, missões e divisões que exibem texto configurável usam esse modelo.

## Migração 1: catálogo, jogador e posse

### Jogador

`usuarios` recebe:

- `xp`, inteiro não negativo;
- `level`, inteiro positivo;
- `language`, locale BCP-47;
- `booster` e `banned`, booleanos.

`saldo` permanece inteiro.

### Catálogo de cards

Tabelas:

- `nationalities`: nome, emoji, cor e URL de imagem;
- `teams`: nome, emoji, cor e URL de imagem;
- `collections`: nome traduzível, emoji, cores primária/secundária, URLs de imagem/overlay/faixa e bloqueio de contrato;
- `card_backgrounds`: nome, cor e URL de imagem;
- `card_stats`: passe, domínio, marcação, velocidade, drible e finalização, todos positivos;
- `cards`: nome, FKs para coleção/time/nacionalidade/estatísticas/fundo, posição primária, posições secundárias normalizadas, ataque, defesa, criação, overall entre 60 e 100, URLs e bloqueio de contrato;
- `card_price_configs`: preço inteiro único por overall;
- `card_market_config`: configuração singleton de multiplicadores de mercado expressos como base points, não float.

`card_secondary_positions` normaliza posições secundárias e impede repetição por card.

### Posse e elenco

`user_cards` liga `usuarios` a `cards` e registra:

- origem (`pack`, `redeem`, `mission`, `hire`);
- gols, assistências, partidas, cartões amarelos/vermelhos;
- favorito, capitão, titular e posição de titular;
- data de aquisição.

Uma carta em posse pode ser removida com o jogador; Card canônico não pode ser removido enquanto existir posse.

## Migração 2: formação, campo e packs

### Formações e campos

Tabelas:

- `formations`;
- `formation_slots`, com posição e coordenadas;
- `user_formations`, uma seleção de formação por jogador;
- `soccer_fields`, com nome traduzível, cor e URL de imagem;
- `user_soccer_fields`, posse de campo por jogador.

### Packs

Tabelas:

- `pack_probabilities`, peso positivo por overall;
- `pack_configs`, com overall mínimo/máximo e filtros;
- `packs`, com nome, preço inteiro, quantidade de cards, disponibilidade, limite por jogador, cor, emoji e URL;
- associações de filtros inclusivos e exclusivos para posições, coleções, cards e times;
- `pack_probability_links`, associação entre Pack e probabilidades;
- `user_packs`, quantidade não negativa e unicidade `(user_id, pack_id)`.

Filtros são tabelas de junção, nunca arrays de IDs. Todo Pack possui uma configuração; uma configuração pode pertencer a um Pack.

## Migração 3: economia, progressão e operações

### Itens, missões e XP

Tabelas:

- `items`, com tipo (`card`, `pack`, `balance`, `field`, `premium`) e referência validada por regras de aplicação;
- `missions`, `mission_rewards` e `user_missions`;
- `command_xp_configs` e `level_rewards`;
- configurações de tiers de missão por jogador.

### Mercado e operações

Tabelas:

- `trades`, ligando ofertante, recebedor e cartas negociadas;
- `transaction_history`, com jogador, tipo, valor inteiro e referência de origem;
- `redeems`, `redeem_claims` e código único;
- `divisions`, com pontuação e apresentação traduzível;
- `premiums` e configurações de packs/campos premium;
- `rooms` para partidas entre jogador mandante e visitante;
- `profit_configs`;
- `generic_cooldown_configs` e `generic_cooldowns` para recursos sem comando;
- configurações e histórico TopGG.

`command_config` e `user_cooldown` existentes permanecem a fonte de verdade do cooldown de comandos. Cooldowns genéricos não substituem nem duplicam esse fluxo.

## Integridade e deleção

- FKs de catálogo são `restrict` quando a remoção invalidaria Cards existentes.
- Relações pertencentes ao jogador usam `cascade` ao excluir jogador.
- Associações têm índices nas FKs e constraints de unicidade para impedir duplicações.
- Valores de XP, saldo, quantidade, probabilidades, posições e preços possuem checks compatíveis com suas regras.
- Campos de enumeração são constrained por checks PostgreSQL ou tabelas de referência; não dependem só de validação TypeScript.

## Fluxos futuros

Esta entrega deixa dados prontos para:

1. administrar catálogo de Cards;
2. conceder Card ao jogador via Pack, missão ou resgate;
3. escalar Cards em formações;
4. negociar e registrar movimentos de moedas;
5. progredir XP, divisões e premium.

Nenhum desses fluxos é implementado nesta entrega.

## Verificação

- Gerar migration Drizzle para cada fase, sem editar SQL gerado exceto quando Drizzle não representar constraint declarada no schema.
- Aplicar migrations em PostgreSQL vazio.
- Executar `pnpm check`.
- Adicionar testes de persistência para constraints e relações novas que não sejam garantidas diretamente pelo banco.

## Critérios de aceite

- Banco vazio aplica as três migrations sem intervenção manual.
- `usuarios` continua compatível com `/lucro` e armazena progresso adicional.
- Card canônico, Card do jogador, Coleção, Time, Nacionalidade e atributos possuem relações e constraints descritas.
- Packs filtram catálogo por associações normalizadas e inventário não duplica par jogador/pack.
- Formações e campos pertencem ao jogador sem duplicar catálogo.
- Itens, missões, XP, mercado, resgate, premium, divisão, sala, lucro, histórico e cooldown genérico possuem schema relacional.
- Nenhuma migration inclui valores seed, credenciais ou URLs obrigatórias.
