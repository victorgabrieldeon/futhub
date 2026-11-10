import type { ChangeEvent } from 'react';
import type { PackStudioFieldsProps } from './pack-studio-inspector';
import { packEffectOptions, packTextureOptions } from './pack-studio-model';
import { StudioIcon } from './studio-icon';

function numberValue(value: string, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function choose<T extends readonly { readonly id: string }[]>(
  options: T,
  value: string,
  fallback: T[number]['id'],
): T[number]['id'] {
  return options.find((option) => option.id === value)?.id ?? fallback;
}

export function PackStudioDesignFields({
  activeLayer,
  draft,
  onEditFrontImage,
  onChange,
  onSelectLayer,
}: PackStudioFieldsProps) {
  const changeNumber =
    (
      key:
        | 'headlineSize'
        | 'headlineX'
        | 'headlineY'
        | 'kickerX'
        | 'kickerY'
        | 'tintOpacity'
        | 'textureOpacity',
    ) =>
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange(key, numberValue(event.target.value, draft[key]));
  return (
    <>
      <fieldset className="studio-section">
        <legend className="studio-section__title">Texto</legend>
        <fieldset className="studio-segmented studio-segmented--block">
          <legend className="sr-only">Texto em edição</legend>
          {(['headline', 'kicker'] as const).map((layer) => (
            <button
              aria-pressed={layer === (activeLayer === 'kicker' ? 'kicker' : 'headline')}
              key={layer}
              onClick={() => onSelectLayer(layer)}
              type="button"
            >
              {layer === 'headline' ? 'Título' : 'Subtítulo'}
            </button>
          ))}
        </fieldset>
        <PackStudioTextFields
          activeLayer={activeLayer === 'kicker' ? 'kicker' : 'headline'}
          changeNumber={changeNumber}
          {...{ draft, onChange }}
        />
      </fieldset>
      <PackStudioBackgroundFields
        changeNumber={changeNumber}
        {...{ draft, onChange, onEditFrontImage }}
      />
    </>
  );
}

type ChangeNumber = (
  key:
    | 'headlineSize'
    | 'headlineX'
    | 'headlineY'
    | 'kickerX'
    | 'kickerY'
    | 'tintOpacity'
    | 'textureOpacity',
) => (event: ChangeEvent<HTMLInputElement>) => void;
type VisualFieldsProps = Pick<PackStudioFieldsProps, 'draft' | 'onChange'> &
  Readonly<{ changeNumber: ChangeNumber; onEditFrontImage: () => void }>;

function PackStudioBackgroundFields({
  changeNumber,
  draft,
  onChange,
  onEditFrontImage,
}: VisualFieldsProps) {
  return (
    <>
      <fieldset className="studio-section">
        <legend className="studio-section__title">Foto frontal</legend>
        <p className="studio-section__lead">
          PNG obrigatório em 1024 × 1536. A textura acompanha contorno e dobras do foil.
        </p>
        <div className="studio-button-row">
          <button
            className="studio-btn studio-btn--secondary studio-btn--block"
            onClick={onEditFrontImage}
            type="button"
          >
            <StudioIcon name="image" />
            {draft.frontImage ? 'Ajustar foto frontal' : 'Adicionar foto frontal'}
          </button>
          {draft.frontImage && (
            <button
              className="studio-btn studio-btn--ghost"
              onClick={() => onChange('frontImage', '')}
              type="button"
            >
              Remover foto
            </button>
          )}
        </div>
      </fieldset>
      <fieldset className="studio-section">
        <legend className="studio-section__title">Cores</legend>
        <div className="studio-field-row studio-field-row--3">
          <label className="studio-field studio-color-field">
            <span className="studio-field__label">Base</span>
            <input
              aria-label="Cor base"
              onChange={(event) => onChange('color', event.target.value)}
              type="color"
              value={draft.color}
            />
          </label>
          <label className="studio-field studio-color-field">
            <span className="studio-field__label">Brilho</span>
            <input
              aria-label="Cor de brilho"
              onChange={(event) => onChange('accentColor', event.target.value)}
              type="color"
              value={draft.accentColor}
            />
          </label>
          <label className="studio-field studio-color-field">
            <span className="studio-field__label">Texto</span>
            <input
              aria-label="Cor do texto"
              onChange={(event) => onChange('textColor', event.target.value)}
              type="color"
              value={draft.textColor}
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="studio-section">
        <legend className="studio-section__title">Acabamento</legend>
        <label className="studio-field">
          <span className="studio-field__label">Efeito</span>
          <select
            onChange={(event) =>
              onChange('effect', choose(packEffectOptions, event.target.value, draft.effect))
            }
            value={draft.effect}
          >
            {packEffectOptions.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.label}
              </option>
            ))}
          </select>
        </label>
        <label className="studio-field">
          <span className="studio-field__label">
            Luz <span className="studio-field__value">{draft.tintOpacity}</span>
          </span>
          <input
            max="42"
            min="0"
            onChange={changeNumber('tintOpacity')}
            type="range"
            value={draft.tintOpacity}
          />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Decoração de fundo</span>
          <select
            onChange={(event) =>
              onChange('texture', choose(packTextureOptions, event.target.value, draft.texture))
            }
            value={draft.texture}
          >
            {packTextureOptions.map((texture) => (
              <option key={texture.id} value={texture.id}>
                {texture.label}
              </option>
            ))}
          </select>
        </label>
        <label className="studio-field">
          <span className="studio-field__label">
            Intensidade da decoração{' '}
            <span className="studio-field__value">{draft.textureOpacity}</span>
          </span>
          <input
            max="65"
            min="0"
            onChange={changeNumber('textureOpacity')}
            type="range"
            value={draft.textureOpacity}
          />
        </label>
      </fieldset>
    </>
  );
}

type TextFieldsProps = Pick<PackStudioFieldsProps, 'activeLayer' | 'draft' | 'onChange'> &
  Readonly<{ changeNumber: ChangeNumber }>;

function PackStudioTextFields({ activeLayer, changeNumber, draft, onChange }: TextFieldsProps) {
  return (
    <>
      {activeLayer === 'headline' && (
        <>
          <div className="studio-field">
            <label className="studio-field">
              <span className="studio-field__label">Título</span>
              <input
                maxLength={18}
                onChange={(event) => onChange('headline', event.target.value)}
                value={draft.headline}
              />
            </label>
            <small className="studio-field__hint">{draft.headline.length}/18 caracteres</small>
          </div>
          <label className="studio-field">
            <span className="studio-field__label">
              Posição horizontal <span className="studio-field__value">{draft.headlineX}</span>
            </span>
            <input
              max="520"
              min="80"
              onChange={changeNumber('headlineX')}
              type="range"
              value={draft.headlineX}
            />
          </label>
          <label className="studio-field">
            <span className="studio-field__label">
              Posição vertical <span className="studio-field__value">{draft.headlineY}</span>
            </span>
            <input
              max="470"
              min="190"
              onChange={changeNumber('headlineY')}
              type="range"
              value={draft.headlineY}
            />
          </label>
        </>
      )}
      {activeLayer === 'kicker' && (
        <>
          <div className="studio-field">
            <label className="studio-field">
              <span className="studio-field__label">Subtítulo</span>
              <input
                maxLength={16}
                onChange={(event) => onChange('kicker', event.target.value)}
                value={draft.kicker}
              />
            </label>
            <small className="studio-field__hint">{draft.kicker.length}/16 caracteres</small>
          </div>
          <label className="studio-field">
            <span className="studio-field__label">
              Posição horizontal <span className="studio-field__value">{draft.kickerX}</span>
            </span>
            <input
              max="520"
              min="80"
              onChange={changeNumber('kickerX')}
              type="range"
              value={draft.kickerX}
            />
          </label>
          <label className="studio-field">
            <span className="studio-field__label">
              Posição vertical <span className="studio-field__value">{draft.kickerY}</span>
            </span>
            <input
              max="370"
              min="120"
              onChange={changeNumber('kickerY')}
              type="range"
              value={draft.kickerY}
            />
          </label>
        </>
      )}
      {activeLayer === 'headline' && (
        <label className="studio-field">
          <span className="studio-field__label">
            Tamanho <span className="studio-field__value">{draft.headlineSize}</span>
          </span>
          <input
            max="84"
            min="12"
            onChange={changeNumber('headlineSize')}
            type="range"
            value={draft.headlineSize}
          />
        </label>
      )}
      <small className="studio-field__hint">
        Texto aplicado na face 3D. Ajuste posição sem sair da área útil.
      </small>
    </>
  );
}
