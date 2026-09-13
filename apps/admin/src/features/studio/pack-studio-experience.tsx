import { useRef, useState } from 'react';
import { PackCanvas } from './pack-canvas';
import type { PackStudioDraft } from './pack-studio-model';

type PackStudioExperienceProps = Readonly<{
  draft: PackStudioDraft;
  onClose: () => void;
}>;

export function PackStudioExperience({ draft, onClose }: PackStudioExperienceProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);

  return (
    <dialog
      aria-labelledby="pack-experience-title"
      aria-modal="true"
      className="pack-studio-experience"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key !== 'Tab') return;
        event.preventDefault();
        dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }}
      open
      ref={dialogRef}
    >
      <button className="pack-studio-experience__close" onClick={onClose} type="button">
        Fechar preview
      </button>
      <div className="pack-studio-experience__copy">
        <p className="eyebrow">Preview experience</p>
        <h2 id="pack-experience-title">
          {opened
            ? `${draft.cardsAmount} cartas reveladas`
            : `${draft.name || 'Seu pack'} está pronto`}
        </h2>
        <p>
          {opened
            ? 'Lacre rompido. O jogo revela as cartas nesta sequência.'
            : 'Puxe o lacre como em uma embalagem física para testar a abertura.'}
        </p>
        {opened && (
          <button className="ops-button secondary" onClick={() => setOpened(false)} type="button">
            Fechar e testar de novo
          </button>
        )}
      </div>
      <div className={`pack-studio-experience__pack${opened ? ' is-open' : ''}`}>
        <div aria-hidden="true" className="pack-studio-experience__reveal">
          {[1, 2, 3, 4, 5]
            .filter((slot) => slot <= draft.cardsAmount)
            .map((slot) => (
              <span key={slot}>FH</span>
            ))}
        </div>
        <div className="pack-studio-experience__wrapper">
          <div className="pack-studio-experience__tear" aria-hidden="true" />
          <PackCanvas draft={draft} onCanvasReady={() => undefined} />
        </div>
        <button
          className="pack-studio-experience__open"
          disabled={opened}
          onClick={() => setOpened(true)}
          type="button"
        >
          <span>ABRA AQUI</span>
          <strong>Puxar lacre</strong>
        </button>
      </div>
    </dialog>
  );
}
