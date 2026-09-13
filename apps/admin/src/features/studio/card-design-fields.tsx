import { useId } from 'react';
import type { CardDesign } from './card-design';
import { cardFramePaths, cardFrames, defaultCardDesign } from './card-design';
import './card-design.css';

type CardDesignFieldsProps = Readonly<{
  design: CardDesign;
  onChange: (design: CardDesign) => void;
}>;
type RangeField = readonly [
  key:
    | 'frameWidth'
    | 'textureOpacity'
    | 'glow'
    | 'nameScale'
    | 'photoBrightness'
    | 'photoSaturation',
  label: string,
  min: number,
  max: number,
  unit: string,
];
const ranges: Readonly<Record<'frame' | 'surface' | 'identity', readonly RangeField[]>> = {
  frame: [['frameWidth', 'Espessura da moldura', 4, 12, '']],
  surface: [
    ['textureOpacity', 'Intensidade da textura', 0, 100, '%'],
    ['glow', 'Luz atrás da foto', 0, 100, '%'],
    ['photoBrightness', 'Luminosidade da foto', 50, 150, '%'],
    ['photoSaturation', 'Saturação da foto', 0, 150, '%'],
  ],
  identity: [['nameScale', 'Tamanho do nome', 70, 115, '%']],
};
const textures: readonly Readonly<{ id: CardDesign['texture']; label: string }>[] = [
  { id: 'diamond', label: 'Diamante' },
  { id: 'rays', label: 'Raios' },
  { id: 'none', label: 'Sem textura' },
];
const typography: readonly Readonly<{ id: CardDesign['typography']; label: string }>[] = [
  { id: 'sport', label: 'Esportiva' },
  { id: 'classic', label: 'Clássica' },
];

export function CardDesignFields({ design, onChange }: CardDesignFieldsProps) {
  return (
    <div className="card-design-fields">
      <fieldset>
        <legend>Moldura</legend>
        <div className="card-design-frames">
          {cardFrames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              aria-pressed={design.frame === frame.id}
              onClick={() => onChange({ ...design, frame: frame.id })}
            >
              <svg viewBox="0 0 600 800" width="36" height="48" aria-hidden="true">
                <path d={cardFramePaths[frame.id]} />
              </svg>
              <strong>{frame.label}</strong>
              <small>{frame.detail}</small>
            </button>
          ))}
        </div>
        <label>
          <span>
            Cor do metal <span className="card-design-value">{design.metalColor}</span>
          </span>
          <input
            type="color"
            value={design.metalColor}
            onChange={(event) => onChange({ ...design, metalColor: event.currentTarget.value })}
          />
        </label>
        <DesignRanges fields={ranges.frame} design={design} onChange={onChange} />
      </fieldset>
      <fieldset>
        <legend>Superfície</legend>
        <label>
          Textura
          <select
            value={design.texture}
            onChange={(event) =>
              onChange({
                ...design,
                texture:
                  textures.find((option) => option.id === event.currentTarget.value)?.id ??
                  design.texture,
              })
            }
          >
            {textures.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <DesignRanges fields={ranges.surface} design={design} onChange={onChange} />
      </fieldset>
      <fieldset>
        <legend>Identidade</legend>
        <label>
          Tipografia do nome
          <select
            value={design.typography}
            onChange={(event) =>
              onChange({
                ...design,
                typography:
                  typography.find((option) => option.id === event.currentTarget.value)?.id ??
                  design.typography,
              })
            }
          >
            {typography.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <DesignRanges fields={ranges.identity} design={design} onChange={onChange} />
        <label>
          Texto da edição
          <input
            type="text"
            maxLength={32}
            value={design.edition}
            onChange={(event) => onChange({ ...design, edition: event.currentTarget.value })}
          />
        </label>
        <label className="card-design-toggle">
          <input
            type="checkbox"
            checked={design.showNameplate}
            onChange={(event) =>
              onChange({ ...design, showNameplate: event.currentTarget.checked })
            }
          />
          Mostrar placa do nome
        </label>
        <label className="card-design-toggle">
          <input
            type="checkbox"
            checked={design.showStatBars}
            onChange={(event) => onChange({ ...design, showStatBars: event.currentTarget.checked })}
          />
          Mostrar barras de atributos
        </label>
      </fieldset>
      <button type="button" onClick={() => onChange({ ...defaultCardDesign })}>
        Restaurar somente o design
      </button>
    </div>
  );
}

function DesignRanges({
  fields,
  design,
  onChange,
}: CardDesignFieldsProps &
  Readonly<{
    fields: readonly RangeField[];
  }>) {
  const id = useId();
  return fields.map(([key, label, min, max, unit]) => (
    <label key={key} htmlFor={`${id}-${key}`}>
      <span>
        {label}
        <output htmlFor={`${id}-${key}`}>
          {design[key]}
          {unit}
        </output>
      </span>
      <input
        id={`${id}-${key}`}
        type="range"
        min={min}
        max={max}
        step={1}
        value={design[key]}
        onChange={(event) => onChange({ ...design, [key]: event.currentTarget.valueAsNumber })}
      />
    </label>
  ));
}
