import {
  type CanvasImage,
  type CanvasLayer,
  type Definition,
  type ItemLayer,
  type ListLayer,
  type Scope,
  grid,
  imagePresets,
  imageRef,
  label,
  picture,
  rect,
} from '@futhub/bot-templates';
import { useState } from 'react';
import { CanvasStage } from './canvas-stage';
import { TextField, type TextFocus } from './editor';
import { moveItem } from './helpers';

const layerNames = { rect: 'Retângulo', text: 'Texto', image: 'Imagem', list: 'Lista em grade' };

function summary(layer: CanvasLayer): string {
  switch (layer.type) {
    case 'text':
      return layer.text || 'Texto vazio';
    case 'image':
      return layer.url || 'Sem URL';
    case 'rect':
      return layer.progress ? `Barra · ${layer.progress}` : layer.fill || 'Sem preenchimento';
    case 'list':
      return `{${layer.source}} · ${layer.columns} col. · até ${layer.limit}`;
  }
}

function NumberField({
  label: text,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="response-field designer-number">
      {text}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (event.target.value !== '' && Number.isFinite(next))
            onChange(Math.min(max ?? next, Math.max(min ?? next, next)));
        }}
      />
    </label>
  );
}

function ColorField({
  label: text,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <label className="response-field designer-color">
      {text}
      <span>
        <input
          type="color"
          aria-label={`${text}: seletor`}
          value={/^#[0-9a-f]{6}/i.test(value) ? value.slice(0, 7) : '#000000'}
          onChange={(event) => onChange(event.target.value + value.slice(7))}
        />
        <input
          value={value}
          placeholder={optional ? 'nenhuma' : '#RRGGBB'}
          maxLength={9}
          pattern="#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?"
          onChange={(event) => onChange(event.target.value.trim())}
        />
      </span>
    </label>
  );
}

function Opacity({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="response-field designer-number">
      Opacidade {Math.round(value * 100)}%
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TokenChips({
  tokens,
  insert,
}: {
  tokens: { token: string; description: string }[];
  insert: (token: string) => void;
}) {
  return (
    <div className="token-chips">
      {tokens.map((item) => (
        <button
          type="button"
          key={item.token}
          title={item.description}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => insert(item.token)}
        >
          {item.token}
        </button>
      ))}
    </div>
  );
}

function LayerInspector({
  layer,
  onChange,
  focus,
  tokens,
  insert,
}: {
  layer: ItemLayer;
  onChange: (layer: ItemLayer) => void;
  focus: TextFocus;
  tokens: { token: string; description: string }[];
  insert: (token: string) => void;
}) {
  const geometry = (
    <div className="designer-grid">
      <NumberField
        label="X"
        value={layer.x}
        min={-2048}
        max={4096}
        onChange={(x) => onChange({ ...layer, x })}
      />
      <NumberField
        label="Y"
        value={layer.y}
        min={-2048}
        max={4096}
        onChange={(y) => onChange({ ...layer, y })}
      />
      <NumberField
        label="Largura"
        value={layer.w}
        min={1}
        max={4096}
        onChange={(w) => onChange({ ...layer, w })}
      />
      {layer.type !== 'text' && (
        <NumberField
          label="Altura"
          value={layer.h}
          min={1}
          max={4096}
          onChange={(h) => onChange({ ...layer, h })}
        />
      )}
    </div>
  );
  return (
    <div className="response-stack">
      {geometry}
      {layer.type === 'text' && (
        <>
          <TextField
            label="Texto"
            multiline
            maxLength={500}
            value={layer.text}
            focus={focus}
            onChange={(text) => onChange({ ...layer, text })}
          />
          <TokenChips tokens={tokens} insert={insert} />
          <div className="designer-grid">
            <NumberField
              label="Tamanho"
              value={layer.size}
              min={8}
              max={240}
              onChange={(size) => onChange({ ...layer, size })}
            />
            <NumberField
              label="Linhas"
              value={layer.lines}
              min={1}
              max={10}
              onChange={(lines) => onChange({ ...layer, lines })}
            />
            <label className="response-field">
              Peso
              <select
                value={layer.weight}
                onChange={(event) =>
                  onChange({ ...layer, weight: Number(event.target.value) as 400 | 600 | 800 })
                }
              >
                <option value={400}>Regular</option>
                <option value={600}>Semibold</option>
                <option value={800}>Extra bold</option>
              </select>
            </label>
            <label className="response-field">
              Alinhamento
              <select
                value={layer.align}
                onChange={(event) =>
                  onChange({ ...layer, align: event.target.value as 'left' | 'center' | 'right' })
                }
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </label>
          </div>
          <ColorField
            label="Cor"
            value={layer.color}
            onChange={(color) => onChange({ ...layer, color })}
          />
          <label className="response-check">
            <input
              type="checkbox"
              checked={layer.uppercase}
              onChange={(event) => onChange({ ...layer, uppercase: event.target.checked })}
            />
            Caixa alta
          </label>
          <p className="response-note">
            Emojis não são desenhados nas imagens; use camadas de imagem.
          </p>
        </>
      )}
      {layer.type === 'rect' && (
        <>
          <div className="designer-grid">
            <ColorField
              label="Preenchimento"
              optional
              value={layer.fill}
              onChange={(fill) => onChange({ ...layer, fill })}
            />
            <ColorField
              label="Gradiente até"
              optional
              value={layer.fill2}
              onChange={(fill2) => onChange({ ...layer, fill2 })}
            />
            <ColorField
              label="Borda"
              optional
              value={layer.stroke}
              onChange={(stroke) => onChange({ ...layer, stroke })}
            />
            <NumberField
              label="Espessura da borda"
              value={layer.strokeWidth}
              min={0}
              max={64}
              onChange={(strokeWidth) => onChange({ ...layer, strokeWidth })}
            />
            <NumberField
              label="Arredondamento"
              value={layer.radius}
              min={0}
              max={2048}
              onChange={(radius) => onChange({ ...layer, radius })}
            />
          </div>
          <TextField
            label="Progresso 0–100 (opcional, ex.: {percent})"
            value={layer.progress}
            maxLength={100}
            focus={focus}
            onChange={(progress) => onChange({ ...layer, progress })}
          />
        </>
      )}
      {layer.type === 'image' && (
        <>
          <TextField
            label="URL da imagem ou variável ({avatarUrl})"
            value={layer.url}
            maxLength={2048}
            focus={focus}
            onChange={(url) => onChange({ ...layer, url })}
          />
          <TokenChips tokens={tokens.filter((item) => /url/i.test(item.token))} insert={insert} />
          <div className="designer-grid">
            <label className="response-field">
              Enquadramento
              <select
                value={layer.fit}
                onChange={(event) =>
                  onChange({ ...layer, fit: event.target.value as 'cover' | 'contain' })
                }
              >
                <option value="cover">Preencher (recorta)</option>
                <option value="contain">Caber inteira</option>
              </select>
            </label>
            <NumberField
              label="Arredondamento"
              value={layer.radius}
              min={0}
              max={2048}
              onChange={(radius) => onChange({ ...layer, radius })}
            />
          </div>
        </>
      )}
      <Opacity value={layer.opacity} onChange={(opacity) => onChange({ ...layer, opacity })} />
    </div>
  );
}

function LayerList<T extends CanvasLayer>({
  layers,
  selected,
  onSelect,
  onChange,
}: {
  layers: T[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  onChange: (layers: T[]) => void;
}) {
  return (
    <ol className="designer-layers">
      {layers.map((layer, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Layers are positional; order is the identity.
        <li key={index} data-selected={selected === index}>
          <button type="button" className="designer-layer-name" onClick={() => onSelect(index)}>
            <strong>{layerNames[layer.type]}</strong>
            <small>{summary(layer)}</small>
          </button>
          <span className="designer-layer-actions">
            <button
              type="button"
              aria-label="Trazer para frente"
              title="Trazer para frente"
              disabled={index === layers.length - 1}
              onClick={() => {
                onChange(moveItem(layers, index, 1));
                onSelect(index + 1);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Enviar para trás"
              title="Enviar para trás"
              disabled={index === 0}
              onClick={() => {
                onChange(moveItem(layers, index, -1));
                onSelect(index - 1);
              }}
            >
              ↓
            </button>
            <button
              type="button"
              aria-label="Duplicar camada"
              title="Duplicar"
              onClick={() => {
                const copy = structuredClone(layer);
                copy.x += 16;
                copy.y += 16;
                onChange([...layers.slice(0, index + 1), copy, ...layers.slice(index + 1)]);
                onSelect(index + 1);
              }}
            >
              ⧉
            </button>
            <button
              type="button"
              aria-label="Remover camada"
              title="Remover"
              onClick={() => {
                onChange(layers.filter((_, i) => i !== index));
                onSelect(null);
              }}
            >
              ✕
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

function AddLayers({
  onAdd,
  lists,
}: {
  onAdd: (layer: CanvasLayer) => void;
  lists?: Definition['lists'];
}) {
  return (
    <div className="response-add">
      <button type="button" onClick={() => onAdd(label({ x: 40, y: 40, text: 'Novo texto' }))}>
        + Texto
      </button>
      <button type="button" onClick={() => onAdd(rect({ x: 40, y: 40 }))}>
        + Retângulo
      </button>
      <button type="button" onClick={() => onAdd(picture({ x: 40, y: 40 }))}>
        + Imagem
      </button>
      <button
        type="button"
        onClick={() => {
          onAdd(rect({ x: 40, y: 40, w: 400, h: 16, radius: 8, fill: '#2E2E32' }));
          onAdd(
            rect({
              x: 40,
              y: 40,
              w: 400,
              h: 16,
              radius: 8,
              fill: '#55E8FF',
              fill2: '#0D7BD8',
              progress: '50',
            }),
          );
        }}
      >
        + Barra de progresso
      </button>
      {lists?.map((list) => (
        <button
          type="button"
          key={list.name}
          onClick={() =>
            onAdd(
              grid(list.name, [
                rect({ w: 360, h: 140, fill: '#1C1C1E' }),
                label({
                  x: 24,
                  y: 24,
                  w: 312,
                  text: list.fields[0] ? `{${list.fields[0].name}}` : '{index}',
                  size: 28,
                }),
              ]),
            )
          }
        >
          + Grade de {`{${list.name}}`}
        </button>
      ))}
    </div>
  );
}

function ListLayerInspector({
  layer,
  onChange,
  definition,
  focus,
  tokens,
  insert,
}: {
  layer: ListLayer;
  onChange: (layer: ListLayer) => void;
  definition: Definition;
  focus: TextFocus;
  tokens: { token: string; description: string }[];
  insert: (token: string) => void;
}) {
  const [child, setChild] = useState<number | null>(layer.layers.length ? 0 : null);
  const list = definition.lists.find((entry) => entry.name === layer.source);
  const itemTokens = [
    { token: '{index}', description: 'Posição do item (1, 2, 3…)' },
    ...(list?.fields.map((field) => ({
      token: `{${field.name}}`,
      description: field.description,
    })) ?? []),
    ...tokens,
  ];
  const current = child === null ? undefined : layer.layers[child];
  return (
    <div className="response-stack">
      <label className="response-field">
        Lista
        <select
          value={layer.source}
          onChange={(event) => onChange({ ...layer, source: event.target.value })}
        >
          {definition.lists.map((entry) => (
            <option key={entry.name} value={entry.name}>
              {`{${entry.name}}`} — {entry.description}
            </option>
          ))}
        </select>
      </label>
      <div className="designer-grid">
        <NumberField
          label="X"
          value={layer.x}
          min={-2048}
          max={4096}
          onChange={(x) => onChange({ ...layer, x })}
        />
        <NumberField
          label="Y"
          value={layer.y}
          min={-2048}
          max={4096}
          onChange={(y) => onChange({ ...layer, y })}
        />
        <NumberField
          label="Colunas"
          value={layer.columns}
          min={1}
          max={10}
          onChange={(columns) => onChange({ ...layer, columns })}
        />
        <NumberField
          label="Máx. de itens"
          value={layer.limit}
          min={0}
          max={50}
          onChange={(limit) => onChange({ ...layer, limit })}
        />
        <NumberField
          label="Largura da célula"
          value={layer.cellWidth}
          min={1}
          max={4096}
          onChange={(cellWidth) => onChange({ ...layer, cellWidth })}
        />
        <NumberField
          label="Altura da célula"
          value={layer.cellHeight}
          min={1}
          max={4096}
          onChange={(cellHeight) => onChange({ ...layer, cellHeight })}
        />
        <NumberField
          label="Espaço horizontal"
          value={layer.gapX}
          min={0}
          max={512}
          onChange={(gapX) => onChange({ ...layer, gapX })}
        />
        <NumberField
          label="Espaço vertical"
          value={layer.gapY}
          min={0}
          max={512}
          onChange={(gapY) => onChange({ ...layer, gapY })}
        />
      </div>
      <h3>
        Camadas de cada item <small>{layer.layers.length}/20 · posições relativas à célula</small>
      </h3>
      <LayerList
        layers={layer.layers}
        selected={child}
        onSelect={setChild}
        onChange={(layers) => onChange({ ...layer, layers })}
      />
      {layer.layers.length < 20 && (
        <AddLayers
          onAdd={(added) => {
            if (added.type === 'list') return;
            onChange({ ...layer, layers: [...layer.layers, { ...added, x: 0, y: 0 }] });
            setChild(layer.layers.length);
          }}
        />
      )}
      {current && child !== null && (
        <fieldset className="response-block">
          <legend>Item · {layerNames[current.type]}</legend>
          <LayerInspector
            layer={current}
            focus={focus}
            tokens={itemTokens}
            insert={insert}
            onChange={(next) =>
              onChange({
                ...layer,
                layers: layer.layers.map((entry, i) => (i === child ? next : entry)),
              })
            }
          />
        </fieldset>
      )}
    </div>
  );
}

export function ImageDesigner({
  images,
  onChange,
  definition,
  scope,
  focus,
  insert,
  onUse,
}: {
  images: CanvasImage[];
  onChange: (images: CanvasImage[]) => void;
  definition: Definition;
  scope: Scope;
  focus: TextFocus;
  insert: (token: string) => void;
  onUse: (ref: string) => void;
}) {
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const image = images[Math.min(active, images.length - 1)];
  const index = Math.min(active, images.length - 1);
  const presets = imagePresets(definition);
  const tokens = [
    ...definition.variables.map((variable) => ({
      token: variable.token,
      description: variable.description,
    })),
    ...definition.lists.map((list) => ({
      token: `{${list.name}|count}`,
      description: `Quantidade: ${list.description}`,
    })),
  ];
  const update = (next: CanvasImage) =>
    onChange(images.map((entry, i) => (i === index ? next : entry)));
  const setLayers = (layers: CanvasLayer[]) => image && update({ ...image, layers });

  function add(preset: CanvasImage) {
    const taken = new Set(images.map((entry) => entry.id));
    let id = preset.id;
    for (let n = 2; taken.has(id); n++) id = `${preset.id.slice(0, 28)}-${n}`;
    onChange([...images, { ...structuredClone(preset), id }]);
    setActive(images.length);
    setSelected(null);
  }

  const layer = image && selected !== null ? image.layers[selected] : undefined;
  return (
    <div className="image-designer">
      <div className="designer-tabs" role="tablist" aria-label="Imagens geradas">
        {images.map((entry, i) => (
          <button
            type="button"
            role="tab"
            aria-selected={i === index}
            key={entry.id}
            onClick={() => {
              setActive(i);
              setSelected(null);
            }}
          >
            {entry.id}.png
          </button>
        ))}
        <label className="designer-new">
          <span className="visually-hidden">Nova imagem</span>
          <select
            value=""
            disabled={images.length >= 4}
            onChange={(event) => {
              const preset = presets.find((entry) => entry.id === event.target.value);
              if (preset) add(preset.image);
              else if (event.target.value === 'blank')
                add({ id: 'imagem', width: 1200, height: 400, background: '#111111', layers: [] });
            }}
          >
            <option value="">
              {images.length >= 4 ? 'Máximo de 4 imagens' : '+ Nova imagem…'}
            </option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} — {preset.description}
              </option>
            ))}
            <option value="blank">Em branco (1200×400)</option>
          </select>
        </label>
      </div>
      {!image ? (
        <p className="response-note">
          Crie imagens com variáveis e listas. O bot desenha cada uma na hora e anexa como PNG na
          resposta. Comece por um modelo pronto acima.
        </p>
      ) : (
        <>
          <div className="designer-toolbar">
            <TextField
              label="ID (nome do arquivo)"
              value={image.id}
              maxLength={32}
              focus={focus}
              pattern="[a-z0-9][a-z0-9\-]{0,31}"
              onChange={(id) =>
                update({ ...image, id: id.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
              }
            />
            <NumberField
              label="Largura"
              value={image.width}
              min={64}
              max={2048}
              onChange={(width) => update({ ...image, width })}
            />
            <NumberField
              label="Altura"
              value={image.height}
              min={64}
              max={2048}
              onChange={(height) => update({ ...image, height })}
            />
            <ColorField
              label="Fundo"
              optional
              value={image.background}
              onChange={(background) => update({ ...image, background })}
            />
          </div>
          <div className="designer-actions">
            <button
              type="button"
              className="ops-button accent"
              onClick={() => onUse(imageRef(image.id))}
            >
              Usar na mensagem
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Remover ${image.id}.png do rascunho?`)) {
                  onChange(images.filter((_, i) => i !== index));
                  setActive(0);
                  setSelected(null);
                }
              }}
            >
              Remover imagem
            </button>
            <small>
              Referência: <code>{imageRef(image.id)}</code>
            </small>
          </div>
          <CanvasStage
            image={image}
            scope={scope}
            selected={selected}
            onSelect={setSelected}
            onMove={(i, x, y) =>
              setLayers(image.layers.map((entry, j) => (j === i ? { ...entry, x, y } : entry)))
            }
          />
          <p className="response-note">
            Clique para selecionar e arraste para mover. A prévia usa os exemplos do catálogo e a
            mesma fonte do bot.
          </p>
          <div className="designer-columns">
            <section aria-label="Camadas">
              <h3>
                Camadas <small>{image.layers.length}/60 · a última fica na frente</small>
              </h3>
              <LayerList
                layers={image.layers}
                selected={selected}
                onSelect={setSelected}
                onChange={setLayers}
              />
              {image.layers.length < 60 && (
                <AddLayers
                  lists={definition.lists}
                  onAdd={(added) => {
                    setLayers([...image.layers, added]);
                    setSelected(image.layers.length);
                  }}
                />
              )}
            </section>
            <section aria-label="Propriedades da camada">
              {!layer || selected === null ? (
                <p className="response-note">Selecione uma camada para editar.</p>
              ) : (
                <fieldset className="response-block">
                  <legend>{layerNames[layer.type]}</legend>
                  {layer.type === 'list' ? (
                    <ListLayerInspector
                      key={selected}
                      layer={layer}
                      definition={definition}
                      focus={focus}
                      tokens={tokens}
                      insert={insert}
                      onChange={(next) =>
                        setLayers(image.layers.map((entry, i) => (i === selected ? next : entry)))
                      }
                    />
                  ) : (
                    <LayerInspector
                      layer={layer}
                      focus={focus}
                      tokens={tokens}
                      insert={insert}
                      onChange={(next) =>
                        setLayers(image.layers.map((entry, i) => (i === selected ? next : entry)))
                      }
                    />
                  )}
                </fieldset>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
