import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, Reference } from '../cards/actions';
import type { PackInput } from './actions';
import {
  EligibilitySection,
  IdentitySection,
  OfferSection,
  type PackRuleChange,
  type PackRuleTargetChange,
} from './pack-editor-sections';
import type { PackRuleKey } from './pack-rule-chooser';

export type PackCatalog = Readonly<{
  cards: readonly Card[];
  collections: readonly Reference[];
  teams: readonly Reference[];
}>;

type PackEditorProps = Readonly<{
  catalog: PackCatalog;
  editingName: string | null;
  form: PackInput;
  onChange: (next: PackInput) => void;
  onClose: () => void;
  onOpenStudio: (() => void) | null;
  onPause: (() => void) | null;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  working: boolean;
}>;

export function PackEditor({
  catalog,
  editingName,
  form,
  onChange,
  onClose,
  onOpenStudio,
  onPause,
  onSave,
  open,
  working,
}: PackEditorProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const isOverallRangeValid = form.config.minOverall <= form.config.maxOverall;
  const updateRule = useMemo<PackRuleChange>(
    () => (onlyKey, excludedKey, id, target) => {
      const targetKey = target === 'only' ? onlyKey : excludedKey;
      const otherKey = target === 'only' ? excludedKey : onlyKey;
      const selected = form.config[targetKey];
      onChange({
        ...form,
        config: {
          ...form.config,
          [targetKey]: selected.includes(id)
            ? selected.filter((value) => value !== id)
            : [...selected, id],
          [otherKey]: [],
        },
      });
    },
    [form, onChange],
  );
  const updateRuleTarget = useMemo<PackRuleTargetChange>(
    () => (onlyKey, excludedKey, target) => {
      const otherKey = target === 'only' ? excludedKey : onlyKey;
      onChange({ ...form, config: { ...form.config, [otherKey]: [] } });
    },
    [form, onChange],
  );

  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    setActiveStep(0);
    node.showModal();
    return () => node.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      aria-labelledby="pack-editor-title"
      className="ops-dialog pack-editor-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialog}
    >
      <form className="ops-dialog-card pack-editor" onSubmit={onSave}>
        <header className="pack-editor__header">
          <div>
            <p className="eyebrow">{editingName ? 'Editar oferta' : 'Nova oferta'}</p>
            <h2 id="pack-editor-title">{editingName ?? 'Criar pack'}</h2>
            <p>Defina visual, venda e regras de elegibilidade em um só lugar.</p>
          </div>
          <button
            aria-label="Fechar editor"
            className="dialog-close"
            disabled={working}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <PackEditorProgress activeStep={activeStep} />
        {activeStep === 0 && (
          <div className="ops-dialog-body pack-editor__body">
            <IdentitySection form={form} onChange={onChange} />
          </div>
        )}
        {activeStep === 1 && (
          <div className="ops-dialog-body pack-editor__body">
            <OfferSection form={form} onChange={onChange} />
          </div>
        )}
        {activeStep === 2 && (
          <div className="ops-dialog-body pack-editor__body">
            <EligibilitySection
              cards={catalog.cards}
              collections={catalog.collections}
              form={form}
              onChange={onChange}
              onRuleChange={updateRule}
              onRuleTargetChange={updateRuleTarget}
              teams={catalog.teams}
              validRange={isOverallRangeValid}
            />
          </div>
        )}
        <PackEditorActions
          activeStep={activeStep}
          editingName={editingName}
          identityComplete={Boolean(form.name.trim() && form.emoji.trim())}
          isOverallRangeValid={isOverallRangeValid}
          onClose={onClose}
          onNext={() => setActiveStep((step) => Math.min(step + 1, 2))}
          onOpenStudio={onOpenStudio}
          onPause={onPause}
          onPrevious={() => setActiveStep((step) => Math.max(step - 1, 0))}
          working={working}
        />
      </form>
    </dialog>
  );
}

function PackEditorProgress({ activeStep }: Readonly<{ activeStep: number }>) {
  const steps = ['Identidade', 'Oferta', 'Elegibilidade'];

  return (
    <ol aria-label="Etapas da criação do pack" className="pack-editor__steps">
      {steps.map((step, index) => (
        <li aria-current={activeStep === index ? 'step' : undefined} key={step}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          {step}
        </li>
      ))}
      <span className="sr-only">
        Etapa {activeStep + 1} de {steps.length}
      </span>
    </ol>
  );
}

function PackEditorActions({
  activeStep,
  editingName,
  identityComplete,
  isOverallRangeValid,
  onClose,
  onNext,
  onOpenStudio,
  onPause,
  onPrevious,
  working,
}: Readonly<{
  activeStep: number;
  editingName: string | null;
  identityComplete: boolean;
  isOverallRangeValid: boolean;
  onClose: () => void;
  onNext: () => void;
  onOpenStudio: (() => void) | null;
  onPause: (() => void) | null;
  onPrevious: () => void;
  working: boolean;
}>) {
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === 2;
  const canContinue = activeStep !== 0 || identityComplete;

  return (
    <footer className="dialog-actions pack-editor__footer">
      {onOpenStudio && (
        <button
          className="ops-button secondary"
          disabled={working}
          onClick={onOpenStudio}
          type="button"
        >
          Abrir Studio
        </button>
      )}
      {onPause && (
        <button className="ops-button danger" disabled={working} onClick={onPause} type="button">
          Pausar pack
        </button>
      )}
      <button className="ops-button secondary" disabled={working} onClick={onClose} type="button">
        Cancelar
      </button>
      {!isFirstStep && (
        <button
          className="ops-button secondary"
          disabled={working}
          onClick={onPrevious}
          type="button"
        >
          Voltar
        </button>
      )}
      {isLastStep ? (
        <button
          className="ops-button accent"
          disabled={working || !isOverallRangeValid}
          type="submit"
        >
          {working ? 'Salvando...' : editingName ? 'Salvar alterações' : 'Criar pack'}
        </button>
      ) : (
        <button
          className="ops-button accent"
          disabled={working || !canContinue}
          onClick={onNext}
          type="button"
        >
          Continuar
        </button>
      )}
    </footer>
  );
}
