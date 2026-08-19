# Liga ranked e simulação de partidas

## Objetivo

Adicionar liga ranked entre jogadores Discord. Jogadores entram em fila por divisão, disputam partidas simuladas de forma determinística e recebem progresso persistido. REST controla fila e consulta. SSE entrega lances já persistidos.

## Limites

- Sem Redis, worker, Gemini ou outra dependência externa.
- Sem atraso artificial no stream. Cliente decide ritmo de reprodução.
- Apenas ranked 1x1. Sem temporadas, Elo, recompensas, desistência ou matchmaking entre divisões.

## Domínio persistido

### Divisões

`league_divisions` contém nome, mínimo de pontos, cor, emoji e imagem opcional. A migration cria:

| Divisão | Mínimo de pontos |
| --- | ---: |
| Bronze | 0 |
| Prata | 30 |
| Ouro | 75 |
| Platina | 135 |
| Diamante | 210 |

A divisão atual de um jogador é a maior divisão cujo mínimo seja menor ou igual aos pontos atuais.

### Classificação do jogador

`user_league_standings` possui uma linha por jogador: pontos, vitórias, empates, derrotas e divisão atual. A classificação é criada quando jogador participa do ranked.

### Fila e partidas

`ranked_queue` possui no máximo uma linha por jogador. Estado é `waiting` ou `matched`; linhas pareadas retêm `match_id` para jogador que entrou primeiro consultar resultado.

`league_matches` registra jogadores mandante e visitante, seed de simulação, placar, data e estado concluído. `league_match_events` registra eventos ordenados, minuto, tipo, card do jogador opcional, descrição e placar acumulado.

## Fila, escalação e resultado

1. `POST /v1/ranked/queue` recebe identidade Discord protegida por `InternalAuthGuard`.
2. Serviço cria ou atualiza jogador, garante classificação e valida escalação: exatamente 11 cards titulares; para cada posição, quantidade de cards é igual à quantidade de slots dessa posição na formação; posições primária ou secundária são compatíveis.
3. Transação bloqueia pareamento da divisão. Se não houver oponente esperando, cria ou mantém estado `waiting`.
4. Caso exista oponente na mesma divisão, transação cria partida e marca ambos como `matched` com mesmo `match_id`.
5. A transação gera todos eventos, grava partida concluída, incrementa estatísticas dos cards e atualiza classificação de ambos.
6. Vitória concede 3 pontos; empate concede 1; derrota concede 0. Divisão é recalculada por mínimo de pontos.

Não há atualização posterior ou processamento assíncrono. Persistência da partida e efeitos são atômicos.

## Simulação determinística

Simulador é função pura, com escalações válidas e seed persistida.

- Titulares são ordenados por ID antes dos cálculos.
- Força de cada equipe deriva de soma de ataque, criação e defesa dos 11 cards.
- Seed gera quantidade, ordem e minuto dos lances. Chance de ataque usa ataque e criação contra defesa adversária.
- Gol seleciona artilheiro ponderado por `finishing` e ataque; assistência por `passing` e controle; cartões só selecionam titular.
- Eventos mantêm placar acumulado e terminam em evento final.
- Estatísticas existentes de `user_cards` recebem uma partida para cada titular e gols, assistências, amarelos ou vermelhos para envolvidos.

## API

Todos endpoints são internos, protegidos por `InternalAuthGuard`.

- `POST /v1/ranked/queue`: entra ou consulta entrada atual da fila; retorna `waiting` ou `matched` com `matchId`.
- `GET /v1/ranked/status/:discordUserId`: devolve estado de fila e `matchId` quando pareado.
- `GET /v1/league/:discordUserId`: devolve pontos, divisão, vitórias, empates, derrotas e estado de fila.
- `GET /v1/matches/:matchId`: devolve placar e eventos persistidos.
- `GET /v1/matches/:matchId/events`: SSE que transmite eventos ordenados e encerra.

Erros de escalação retornam 400 sem persistência parcial. Jogador, divisão ou partida inexistente retorna 404.

## Estrutura na API

Novo `LeagueModule` agrega controllers de liga e partidas, caso de uso da fila, simulador puro, repositório Drizzle e DTOs tipados. `AppModule` importa módulo. Migração Drizzle acompanha todo novo esquema.

## Verificação

- Teste unitário de simulador: mesma seed gera mesmos eventos; placar é consistente; eventos referenciam titulares.
- Teste unitário de validação: escalação incompleta, quantidade errada por posição e posição incompatível são rejeitadas.
- Integração: dois jogadores da mesma divisão pareiam uma vez, resultados atualizam estatísticas e +3/+1/0 dentro da mesma transação.
- E2E via `app.inject`: fila, status, consulta de liga, partida e stream SSE expõem contratos previstos.
