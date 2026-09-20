# FutHub Admin Design System

## 1. Atmosphere & Identity

Álbum editorial noturno. Futebol como cultura de coleção, não como dashboard: atletas em escala monumental, títulos condensados, numeração de capítulos e linhas finas de ficha técnica. Grafite esverdeado, branco de papel e lima de sinalização formam a assinatura FutHub. Modo claro preserva a composição com papel quente. Sem estatísticas inventadas, raridade inferida ou fotografias fixas de demonstração.

Direções consideradas: túnel cinematográfico (navegação sequencial), álbum editorial (navegação por capítulos e composição assimétrica), sala tática (navegação pelo campo). Escolhida: álbum editorial, pela combinação de protagonismo dos atletas com acesso rápido às operações administrativas.

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
- Títulos editoriais: `Barlow Condensed`, com fallback `Impact, sans-serif`. Escala fluida 56–112px; nomes de atletas 40–80px. Sem comprimir texto de campos e formulários.
- Metadados numéricos: `JetBrains Mono, Fira Code, monospace`.
- Títulos de página: 36px. Títulos de catálogo: 22px. Texto de apoio: 14–16px. Labels: 10–11px, maiúsculas.

## 4. Spacing & Layout

- Unidade base: 4px.
- Páginas usam `command-header` e `cards-panel`.
- Catálogos usam grids com tiles de largura mínima 280px e espaço de 20px.
- Navegação horizontal por capítulos: Visão geral, Acervo, Packs, Studio e Operação. Subnavegação contextual mantém todos os destinos existentes. Em telas pequenas, capítulos quebram em linhas; sem esconder acesso atrás de hover. Link de pular navegação e foco visível obrigatórios.
- Entrada `/app`: manifesto curto à esquerda, atleta destacado à direita e seleção manual por nome/OVR abaixo. Acervo recente e índice de coleções completam a composição. Dados reais via API; estados de carregamento, vazio e erro com recuperação explícita.
- Breakpoints 768px e 1100px: hero empilha no celular, sem cortar nomes; detalhes técnicos continuam legíveis. Movimento apenas em hover/foco e mudanças deliberadas, sem autoplay. `prefers-reduced-motion` remove animações.
- Lucro é uma central de economia distinta: terminal grafite-esverdeado, hero com telemetria, controles em módulo escuro e monitor de distribuição lateral. Verde menta comunica valores e ações econômicas; manter interface densa, sem gradients decorativos ou cards genéricos.

## 5. Components

- `login-stadium`: maquete 3D arquitetônica em perspectiva, campo de proporção 105:68, grama com faixas de corte e microtextura, marcações completas, traves tubulares com rede, arquibancadas escalonadas com assentos individuais, corredores, cobertura metálica e quatro torres de refletores. Materiais: grama `#377747`/`#418650`, concreto `#89969e`, base `#25343e`, metal `#c0cbd0`, assentos `#4b5289`/`#6878a8`, pintura e luminárias `#edf3e9`, placas `#223840`. Iluminação quente `#fff1d8`, preenchimento frio `#cbddeb`. Sem card flutuante ou partículas. Render sob demanda, sem animação contínua. Cena decorativa não recebe foco nem eventos; falha WebGL mantém ilustração de campo CSS e formulário funcional. Largura fluida, proporção 1.42, máximo 640px, visível nos três breakpoints. Espaços 16/24/32px; login mantém tipografia e cores existentes.
- `page-title`: cabeçalho compartilhado de tela. Ícone linear de 34px em chip com acento do tema, título condensado e descrição seguem `command-header`; aplica-se a Command Center, Cards, Times, Coleções, Jogadores, Packs e Studio. Lucro usa mesmo ícone na cor menta e Pack Studio usa-o na marca escura.
- `collection-tile`: identidade visual de coleção, time ou pack; capa alta, símbolo, estado e ação no rodapé.
- `player-vault-card`: card de coleção domina área visual. Base recebe spotlight difuso e dois pontos de brilho; tier visual deriva de OVR (`comum` verde, `raro` azul, `épico` lilás, `lendário` dourado). Hover aplica perspectiva 3D curta, avanço de 9px e glow do tier; seleção usa aro de 1px na cor do tier, nunca moldura violeta grossa. `prefers-reduced-motion` remove transforms e preserva contraste de seleção.
- `command-tabs`: filtro horizontal com sublinhado no acento do tema no estado ativo.
- `settings-button`: ação compacta no topo com ícone linear; abre configurações sem competir com capítulos principais. Tela de configurações usa tabs, começando por IA, e mantém credenciais fora do navegador.
- `futhub-chapters`: destinos reais com `aria-current`; número editorial e sublinhado identificam capítulo ativo. `futhub-subnav` mantém contexto de cada operação. Studios preservam seus tokens locais e ferramentas.
- `ops-button accent`: ação primária de criação ou publicação.
- `admin-select`: seleção nativa com chrome FutHub compartilhado: seta geométrica em `currentColor`, superfície e borda herdadas do contexto, hover com aro discreto, foco de alto contraste e estado desabilitado explícito. Preserva teclado, semântica de formulário e menu do sistema operacional; altura e raio continuam definidos por cada módulo.
- `pack-canvas`: modelo GLB colecionável renderizado em 600 × 800 com transparência, exibido no Fabric como imagem. Mantém marca e geometria do modelo. Título, subtítulo, cores, efeito e textura são editáveis pelo painel de propriedades. Fallback SVG sinalizado quando o modelo 3D não está disponível. Exportação aguarda a versão atual da arte.
- `pack-studio-page`: bancada editorial em três painéis: biblioteca de presets e camadas à esquerda (232px), canvas fluido central e inspector à direita (288px). Painéis claros `--studio-panel: #ffffff`, campos `--studio-field: #f4f5f7`, bordas `--studio-rim: #dfe2e8`, texto `--studio-ink: #20232b`, apoio `--studio-muted: #616775`. Canvas neutro `--studio-canvas: #e9ecf0`, pontos de grade `#cbd0d8`, sem glow. Seleção violeta `--studio-selection: #eeebff`, texto `--studio-accent: #5543b5`. Raios 8/12px; espaços 8/12/16/24px; header 72px, título 18px, seções 14px, apoio 12px. Desktop tem altura limitada a 100dvb menos margem do app, header fixo e scroll independente da biblioteca, inspector e área de zoom. Até 980px, documento assume scroll, biblioteca fica acima do canvas e inspector abaixo, sem scrolls internos.
- `pack-studio-layer`: item compacto de camada com símbolo, título e detalhe; seleção usa `--studio-selection` e borda `--studio-accent`. Textos longos têm ellipsis apenas na lista, preservando valor completo no campo.
- `pack-studio-tabs`: `Design`, `Pack` e `Conteúdo`; Design reúne Texto, Cores e Acabamento, com seleção entre título/subtítulo. Pack concentra dados comerciais. Header distingue rascunho local, alterações não publicadas, publicação em andamento e versão publicada, sem prometer salvamento automático.
- `pack-studio-presets`: galeria 2 × 2 com miniaturas 96 × 128 do mesmo modelo 3D usado no canvas. Padrão (azul/foil), Neon (violeta/holográfico), Gold (dourado/foil) e Ice (azul-claro/chrome). Aplicar altera somente sete propriedades visuais, preservando textos e dados comerciais. Seleção usa borda violeta e `aria-pressed`; carregamento e falha têm texto explícito.
- `pack-studio-preview`: modos Edição, Loja e Miniatura mantêm o mesmo canvas montado. Loja apresenta nome, quantidade e preço em moedas, sem ação de compra. Miniatura mostra arte em 96 × 128 CSS px para conferir legibilidade. São simulações de contexto, não reprodução da loja publicada. Toolbar e rodapé ficam fora da área de zoom. Superfícies e texto reutilizam tokens locais do Studio. Espaços 8/12/16/24px, raio 8/12px, título 22px, apoio 14px e labels 11px. Controles novos têm área mínima de 44px e foco de alto contraste.
- Apresentação do pack: carcaça de plástico premium moldado, com costura, lacre serrilhado, trilhos laterais, visor fumê e marca em alto-relevo. Título e kicker ficam sob visor rebaixado, com borda, sombra interna e relevo tipográfico; nunca como texto solto na frente da embalagem. Galeria é amostra fixa; preview usa composição atual.
- `pack-studio-experience`: abertura manual por lacre serrilhado “ABRA AQUI”; rasgo desloca topo do sachê e revela até cinco dorsos de cards. Exportação oferece PNG/WebP em 600×800, 1200×1600 e 1800×2400.
- `image-treatment`: editor de imagem com prévias em comparação e painel lateral. Em superfícies com altura limitada, somente ajustes rolam; ações Baixar PNG e Aplicar permanecem em rodapé visível. Espaços 12/16/22px, separador `--hairline-strong` e controles nativos com foco contrastante.

## 6. States & Interaction

- Card Studio: inspector mantém tokens do admin e agrupa Moldura, Superfície e Identidade. Controles nativos com alvo mínimo 44px, valores visíveis e foco contrastante. Ajustes visuais não alteram dados do atleta; acompanham histórico e rascunhos locais.
- Base do card: composição 600×800 com Brasão, Arena ou Ingresso. Aro metálico chanfrado de 4–12 unidades, metal padrão champagne `#d9bc78`, reflexo `#fff4d6` e sombra `#604521`; preenchimento marinho e ciano existentes. Geometria compartilhada entre SVG e render 3D, luz superior esquerda e preenchimento frio, sem animação contínua.
- Detalhes: gravação diamante ou raios com opacidade máxima .28, trilhos duplos, placa de nome y480–560, atributos y598–685, edição y730 e assinatura y758. Nome esportivo (Arial Narrow/Inter) ou clássico (Georgia), escala 70–115%, ajustado à largura disponível. Símbolo de coleção no topo. Brilho e saturação da foto independentes da paleta.
- Prévia do card: SVG atualizado durante renderização; falha de WebGL mantém arte exportável com aviso explícito. Guias e seleção permanecem visíveis acima da imagem final.

- `player-vault-card` adapta mecanismo de `tilt-card` do beui.dev com CSS nativo: perspectiva fixa no repouso e inclinação curta no hover, sem rastreamento de cursor ou dependência. `prefers-reduced-motion` remove transforms e preserva aro/contraste.
- Demais tiles elevam 4px no hover; `prefers-reduced-motion` remove transições.
- Foco visível usa anel de alto contraste.
- Estados indisponíveis mantêm conteúdo legível com opacidade reduzida.

## 7. Accessibility

- Todo botão tem texto ou `aria-label`.
- Arte decorativa usa `alt=""`.
- Filtros usam `role="tablist"` e `role="tab"`.
- A arte do pack usa título acessível com nome e quantidade; estado de renderização anunciado por `output`.

## 8. Assistente IA administrativo

- Configuração salva contém provedor, URL base, modelos e último modelo; chave é cifrada no servidor e nunca retorna para a UI. Campo de senha vazio reutiliza configuração somente com mesmo provedor e URL; alteração exige nova chave. Histórico permanece separado e sem segredos. Estado autoritativo inclui `model: string | null`; primeiro envio fixa o modelo.

- Rota `/app/assistente`, navegação “Assistente IA”. Composição “Sala de criação”: título editorial, conversa em largura total e configuração em disclosure nativo acima, inicialmente recolhido. Reutilizar tipografia `--fh-display` e tokens atuais do shell, sem redefinir paleta global. Histórico funciona como arquivo separado. Sugestões de Coleção, Card e Pack apenas preenchem rascunho e focam compositor; nunca enviam nem aprovam. Dentro da conversa, somente `.ai-conversation-log` rola; cabeçalho e compositor ficam fora desse scroll, com altura delimitada pelo painel.
- Conexão reúne protocolo OpenAI-compatible ou Anthropic-compatible, Base URL HTTPS pública e API key em campo de senha. Explicar envio de mensagens e dados consultados ao provedor escolhido. Credenciais e sessão não usam localStorage nem sessionStorage; conexão temporária deve oferecer Encerrar sessão.
- Modelos descobertos aparecem em seleção; entrada manual permanece disponível quando descoberta não existe. Modelo fica fixo após primeira mensagem. Falhas de autenticação não devem parecer ausência de modelos.
- Conversa distingue usuário, assistente e resultado de tool por texto, não apenas cor. Conteúdo externo é texto, nunca HTML executável. Textos longos e JSON quebram linha sem ampliar viewport.
- Propostas de criação de Time, Coleção, Card e Pack mostram nome da ação, todos os argumentos exatos e estado pendente, concluído, falhou ou rejeitado. Confirmar e Rejeitar são explícitos; nenhuma alteração ocorre só por enviar mensagem. Ajustar proposta avisa que propostas pendentes serão rejeitadas.
- Durante requisições, impedir envios e confirmações duplicados. Falha de rede após confirmação exige consultar estado da sessão antes de permitir nova tentativa; resultado desconhecido nunca aparece como criação definitivamente falhada.
- Streaming mostra deltas reais por mensagem. Eventos de estado substituem toda a conversa, inclusive texto parcial; sucesso exige estado final seguido de `done`. EOF sem `done`, erro ou interrupção exige reconciliação por GET, nunca reenvio automático. Argumentos parciais e propostas durante streaming não podem ser executados. Interromper cancela a espera no navegador, não garante cancelamento no servidor.
- Histórico é persistido no servidor sem segredos e pode ser consultado após recarregar. Lista paginada informa título, provedor, modelo e data; detalhe exibe “Somente leitura”, sem compositor, aprovação, rejeição ou retomada executável. Voltar à conversa atual preserva apenas a conexão ativa em memória. Encerrar sessão não promete apagar o histórico.
- Consulta web informa verificando, disponível, indisponível ou falha de consulta; indisponibilidade não bloqueia conversa. Resultados fundamentados exibem consulta, títulos e descrições como texto. Somente URLs HTTP(S) sem credenciais viram links, com destino visível e abertura segura; URLs inválidas continuam texto, nunca HTML.
- Histórico reutiliza painéis e botões nativos; lista e detalhe respeitam largura disponível. Conversa mantém scroll próprio e não arrasta quem lê mensagens anteriores. Foco de links é visível. Anúncio de progresso é estável durante deltas, sem leitura repetida de cada token. Validar histórico e streaming nos breakpoints 375/768/1280; evidência visual ausente permanece pendente.
- Layout empilha conexão, conversa e propostas em telas estreitas. Espaços seguem base 4px; controles têm alvo mínimo 44px, labels persistentes, foco visível e operação por teclado. Estados assíncronos usam anúncios acessíveis; respeitar `prefers-reduced-motion`.

## 9. Respostas do bot

- `/app/respostas`, em Operação, reúne o catálogo de comandos e resultados da API; `?resposta=lucro.success` abre uma variante diretamente. Lucro mantém economia e recompensas, com link para este editor; não mantém editor ou prévia de embed próprios.
- Bancada usa tokens e tipografia do shell, formulário visual à esquerda e prévia aproximada do Discord à direita; empilha até 1100px. Estilos novos ficam em `features/bot-responses/bot-responses.css`, sem redefinir tokens globais.
- Conteúdo, embeds, campos, botões e blocos V2 têm controles nativos de ordem e remoção, contagens e labels. Catálogo fornece variáveis, exemplos e ações; clicar em variável insere no último campo de texto focado. Prévia não envia mensagens nem executa ações; URLs vazias não geram imagens quebradas.
- Trocar resultado com rascunho pede confirmação. Trocar formato explica e confirma a remoção de campos incompatíveis, publicada somente ao salvar. Falhas preservam o rascunho; controles ficam bloqueados durante salvamento. Inspeção e paginação da loja são geradas pelo bot, fora dos botões estáticos editáveis.

## 10. Accepted Debt

- Tokens ainda vivem em `globals.css`; migrar para arquivo dedicado somente se houver mais de um app consumindo mesmos tokens.
- Apresentação do pack persiste em campos estruturados junto ao PNG final; presets não modificam dados comerciais nem textos. Contextos de preview são simulações locais, não telas da loja real.
