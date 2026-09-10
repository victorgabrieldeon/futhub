import { type ChatAction, record } from './api';

const titles = {
  create_team: 'Criar time',
  create_collection: 'Criar coleção',
  create_card: 'Criar card',
  create_pack: 'Criar pack',
} as const;
const statuses = {
  pending: 'Aguardando aprovação',
  succeeded: 'Criado',
  failed: 'Falhou',
  rejected: 'Rejeitado',
} as const;
const fields: Readonly<Record<string, string>> = {
  name: 'Nome',
  description: 'Descrição',
  teamId: 'ID do time',
  collectionId: 'ID da coleção',
  playerId: 'ID do jogador',
  cardIds: 'IDs dos cards',
  price: 'Preço',
  quantity: 'Quantidade',
  position: 'Posição',
  overall: 'OVR',
  rarity: 'Raridade',
  imageUrl: 'URL da imagem',
  country: 'País',
  nationality: 'Nacionalidade',
  isActive: 'Ativo',
  slug: 'Identificador',
};

type Props = Readonly<{ action: ChatAction }> &
  (
    | Readonly<{ readOnly: true }>
    | Readonly<{
        readOnly?: false;
        disabled: boolean;
        decide: (id: string, approved: boolean) => Promise<void>;
      }>
  );
export function ActionReview(props: Props) {
  const { action } = props;
  let proposal: unknown;
  try {
    proposal = JSON.parse(action.arguments);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    proposal = action.arguments;
  }
  const entries =
    typeof proposal === 'object' && proposal !== null && !Array.isArray(proposal)
      ? Object.entries(proposal)
      : [];
  return (
    <article className={`ai-review ai-review--${action.status}`} aria-label={titles[action.tool]}>
      <header>
        <h3>{titles[action.tool]}</h3>
        <span className="ai-action-status">{statuses[action.status]}</span>
      </header>
      {entries.length > 0 ? (
        <dl>
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>
                {fields[key] ?? key}
                {fields[key] ? <small> ({key})</small> : null}
              </dt>
              <dd>{typeof value === 'string' ? value || '""' : JSON.stringify(value, null, 2)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre>{action.arguments}</pre>
      )}
      <details>
        <summary>Parâmetros exatos (JSON)</summary>
        <pre>{action.arguments}</pre>
      </details>
      {action.result !== null && <p className="ai-action-result">{action.result}</p>}
      {props.readOnly && <p>Somente leitura · proposta registrada, sem execução pelo histórico.</p>}
      {!record(proposal) && action.status === 'pending' && (
        <p>Parâmetros incompletos ou inválidos. Não é possível confirmar.</p>
      )}
      {action.status === 'pending' && !props.readOnly && (
        <footer>
          <button
            className="ops-button accent"
            type="button"
            disabled={props.disabled || !record(proposal)}
            onClick={() => void props.decide(action.id, true)}
          >
            Confirmar criação
          </button>
          <button
            className="ops-button secondary"
            type="button"
            disabled={props.disabled}
            onClick={() => void props.decide(action.id, false)}
          >
            Rejeitar
          </button>
        </footer>
      )}
    </article>
  );
}
