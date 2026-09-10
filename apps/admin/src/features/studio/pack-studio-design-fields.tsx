import type { ChangeEvent } from 'react';
import type { PackStudioFieldsProps } from './pack-studio-inspector';
import { packEffectOptions, packTextureOptions } from './pack-studio-model';

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
    <div className="pack-studio-fields">
      <fieldset className="pack-studio-field-section">
        <legend>Texto</legend>
        <div className="pack-studio-text-switch" aria-label="Texto em edição">
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
        </div>
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
    </div>
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
      <fieldset className="pack-studio-field-section">
        <legend>Foto frontal</legend>
        <p className="pack-studio-field-help">
          PNG obrigatório em 1024 × 1536. A textura acompanha contorno e dobras do foil.
        </p>
        <button className="pack-studio-image-action" onClick={onEditFrontImage} type="button">
          {draft.frontImage ? 'Ajustar foto frontal' : 'Adicionar foto frontal'}
        </button>
        {draft.frontImage && (
          <button
            className="pack-studio-image-remove"
            onClick={() => onChange('frontImage', '')}
            type="button"
          >
            Remover foto
          </button>
        )}
      </fieldset>
      <fieldset className="pack-studio-field-section">
        <legend>Cores</legend>
        <div className="pack-studio-colors">
          <label>
            Base
            <input
              aria-label="Cor base"
              onChange={(event) => onChange('color', event.target.value)}
              type="color"
              value={draft.color}
            />
          </label>
          <label>
            Brilho
            <input
              aria-label="Cor de brilho"
              onChange={(event) => onChange('accentColor', event.target.value)}
              type="color"
              value={draft.accentColor}
            />
          </label>
          <label>
            Texto
            <input
              aria-label="Cor do texto"
              onChange={(event) => onChange('textColor', event.target.value)}
              type="color"
              value={draft.textColor}
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="pack-studio-field-section">
        <legend>Acabamento</legend>
        <label>
          Efeito
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
        <label>
          Luz
          <input
            max="42"
            min="0"
            onChange={changeNumber('tintOpacity')}
            type="range"
            value={draft.tintOpacity}
          />
        </label>
        <label>
          Decoração de fundo
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
        <label>
          Intensidade da decoração
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
          <label>
            Título
            <input
              maxLength={18}
              onChange={(event) => onChange('headline', event.target.value)}
              value={draft.headline}
            />
          </label>
          <label>
            Posição horizontal
            <input
              max="520"
              min="80"
              onChange={changeNumber('headlineX')}
              type="range"
              value={draft.headlineX}
            />
          </label>
          <label>
            Posição vertical
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
          <label>
            Subtítulo
            <input
              maxLength={16}
              onChange={(event) => onChange('kicker', event.target.value)}
              value={draft.kicker}
            />
          </label>
          <label>
            Posição horizontal
            <input
              max="520"
              min="80"
              onChange={changeNumber('kickerX')}
              type="range"
              value={draft.kickerX}
            />
          </label>
          <label>
            Posição vertical
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
        <label>
          Tamanho
          <input
            max="84"
            min="12"
            onChange={changeNumber('headlineSize')}
            type="range"
            value={draft.headlineSize}
          />
        </label>
      )}
      <p className="form-note">Texto aplicado na face 3D. Ajuste posição sem sair da área útil.</p>
    </>
  );
}
