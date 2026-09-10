import { ActionReview } from './action-review';
import type { AiChatState } from './api';
import { MarkdownMessage } from './markdown-message';
import { WebResults } from './web-results';

const roles = { user: 'Você', assistant: 'Assistente', tool: 'Resultado da ferramenta' } as const;
type Props = Readonly<{ state: AiChatState | null }> &
  (
    | Readonly<{ readOnly: true }>
    | Readonly<{
        readOnly?: false;
        disabled: boolean;
        streaming: boolean;
        decide: (id: string, approved: boolean) => Promise<void>;
      }>
  );
export function ChatMessages(props: Props) {
  const messages = props.state?.messages ?? [];
  const streaming = !props.readOnly && props.streaming;
  const lastMessage = messages.at(-1);
  const streamingMessageId =
    streaming && lastMessage?.role === 'assistant' ? lastMessage.id : undefined;
  const waitingForText = streaming && lastMessage?.role !== 'assistant';
  return (
    <>
      {messages.map((message) => (
        <article
          className={`ai-message ai-message--${message.role}${message.id === streamingMessageId ? ' ai-message--streaming' : ''}`}
          key={message.id}
        >
          {message.role === 'tool' ? (
            <details className="ai-tool-result">
              <summary>{roles.tool}</summary>
              <WebResults content={message.content} />
            </details>
          ) : (
            <>
              <h3 className="sr-only">{roles[message.role]}</h3>
              <MarkdownMessage content={message.content} />
            </>
          )}
        </article>
      ))}
      {waitingForText && (
        <output className="ai-response-pending" aria-label="Assistente preparando resposta">
          <span />
          <span />
          <span />
        </output>
      )}
      {props.state?.actions.map((action) =>
        props.readOnly ? (
          <ActionReview key={action.id} action={action} readOnly />
        ) : (
          <ActionReview
            key={action.id}
            action={action}
            disabled={props.disabled}
            decide={props.decide}
          />
        ),
      )}
    </>
  );
}
