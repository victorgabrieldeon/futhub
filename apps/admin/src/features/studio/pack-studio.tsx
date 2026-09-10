import type { Canvas } from 'fabric';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { type Pack, createPack, listPacks, updatePack, uploadPackImage } from '../packs/actions';
import { PackCanvas, packCanvasPng } from './pack-canvas';
import {
  type PackStudioDraft,
  defaultPackStudioDraft,
  packEffectOptions,
  packStudioDraft,
  packStudioInput,
  packTextureOptions,
} from './pack-studio-model';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível salvar o pack.';
}

function numberValue(value: string, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function choice<T extends readonly { id: string }[]>(
  options: T,
  value: string,
  fallback: T[number]['id'],
): T[number]['id'] {
  return options.find((option) => option.id === value)?.id ?? fallback;
}

export function PackStudio() {
  const location = useLocation();
  const navigate = useNavigate();
  const canvasRef = useRef<Canvas | null>(null);
  const linkedPack = (location.state as { pack?: Pack } | null)?.pack ?? null;
  const initialSelectedId = useRef(linkedPack?.id ?? '');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedId, setSelectedId] = useState(linkedPack?.id ?? '');
  const [draft, setDraft] = useState<PackStudioDraft>(
    linkedPack ? packStudioDraft(linkedPack) : defaultPackStudioDraft,
  );
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listPacks()
      .then((items) => {
        setPacks(items);
        const selected =
          items.find((item) => item.id === initialSelectedId.current) ?? items[0] ?? null;
        if (selected) {
          setSelectedId(selected.id);
          setDraft(packStudioDraft(selected));
        }
      })
      .catch((error: unknown) => setNotice(message(error)))
      .finally(() => setLoading(false));
  }, []);

  const pack = useMemo(
    () => packs.find((item) => item.id === selectedId) ?? null,
    [packs, selectedId],
  );
  const canSave = draft.name.trim().length > 0 && !saving;

  function updateDraft<Key extends keyof PackStudioDraft>(key: Key, value: PackStudioDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function choosePack(id: string) {
    const selected = packs.find((item) => item.id === id) ?? null;
    setSelectedId(id);
    setDraft(selected ? packStudioDraft(selected) : defaultPackStudioDraft());
    setNotice('');
  }

  function changeNumber(key: 'headlineSize' | 'tintOpacity' | 'textureOpacity') {
    return (event: ChangeEvent<HTMLInputElement>) =>
      updateDraft(key, numberValue(event.target.value, draft[key]));
  }

  async function saveArtwork() {
    if (!canvasRef.current || !canSave) return;
    setSaving(true);
    try {
      const saved = pack
        ? await updatePack(pack.id, packStudioInput(draft, pack))
        : await createPack(packStudioInput(draft));
      const artwork = await packCanvasPng(canvasRef.current);
      const form = new FormData();
      form.set(
        'image',
        new File(
          [artwork],
          `${saved.name.toLowerCase().replaceAll(/[^a-z0-9]+/gi, '-')}-pack.png`,
          {
            type: 'image/png',
          },
        ),
      );
      const updated = await uploadPackImage(saved.id, form);
      setPacks((current) => [...current.filter((item) => item.id !== updated.id), updated]);
      setSelectedId(updated.id);
      setNotice(pack ? 'Pack atualizado e arte publicada.' : 'Pack criado e arte publicada.');
    } catch (error) {
      setNotice(message(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="pack-studio-title"
      className="command-page cards-page packs-page pack-studio-page"
    >
      <header className="command-header">
        <div>
          <p className="eyebrow">Studio de packs</p>
          <h1 id="pack-studio-title">Criar e compor pack</h1>
          <p>Defina oferta, textos, cores, acabamento e textura antes de publicar.</p>
        </div>
        <div className="cards-header-actions">
          <button
            className="ops-button secondary"
            onClick={() => navigate('/app/gerenciar/packs')}
            type="button"
          >
            Gestão avançada
          </button>
        </div>
      </header>

      <div className="pack-studio-layout">
        <aside className="pack-studio-controls">
          <div className="pack-studio-controls__heading">
            <div>
              <p className="eyebrow">Composição</p>
              <h2>{pack ? 'Editar pack' : 'Novo pack'}</h2>
            </div>
            <button className="text-button" onClick={() => choosePack('')} type="button">
              + Novo
            </button>
          </div>

          <label>
            Pack existente
            <select
              disabled={loading}
              onChange={(event) => choosePack(event.target.value)}
              value={selectedId}
            >
              <option value="">Novo pack</option>
              {packs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="pack-studio-fields">
            <legend>Oferta</legend>
            <label>
              Nome
              <input
                maxLength={42}
                onChange={(event) => updateDraft('name', event.target.value)}
                value={draft.name}
              />
            </label>
            <div className="pack-studio-grid">
              <label>
                Cartas
                <input
                  min="1"
                  onChange={(event) =>
                    updateDraft('cardsAmount', numberValue(event.target.value, draft.cardsAmount))
                  }
                  type="number"
                  value={draft.cardsAmount}
                />
              </label>
              <label>
                Preço
                <input
                  min="0"
                  onChange={(event) =>
                    updateDraft('price', numberValue(event.target.value, draft.price))
                  }
                  type="number"
                  value={draft.price}
                />
              </label>
              <label>
                Limite
                <input
                  min="1"
                  onChange={(event) =>
                    updateDraft('limitPerUser', numberValue(event.target.value, draft.limitPerUser))
                  }
                  type="number"
                  value={draft.limitPerUser}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="pack-studio-fields">
            <legend>Textos</legend>
            <label>
              Título superior
              <input
                maxLength={28}
                onChange={(event) => updateDraft('headline', event.target.value)}
                value={draft.headline}
              />
            </label>
            <label>
              Subtítulo
              <input
                maxLength={16}
                onChange={(event) => updateDraft('kicker', event.target.value)}
                value={draft.kicker}
              />
            </label>
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
            <p className="form-note">Arraste e redimensione título direto no pack.</p>
          </fieldset>

          <fieldset className="pack-studio-fields">
            <legend>Visual</legend>
            <div className="pack-studio-colors">
              <label>
                Base
                <input
                  aria-label="Cor base"
                  onChange={(event) => updateDraft('color', event.target.value)}
                  type="color"
                  value={draft.color}
                />
              </label>
              <label>
                Brilho
                <input
                  aria-label="Cor de brilho"
                  onChange={(event) => updateDraft('accentColor', event.target.value)}
                  type="color"
                  value={draft.accentColor}
                />
              </label>
              <label>
                Texto
                <input
                  aria-label="Cor do texto"
                  onChange={(event) => updateDraft('textColor', event.target.value)}
                  type="color"
                  value={draft.textColor}
                />
              </label>
            </div>
            <label>
              Efeito
              <select
                onChange={(event) =>
                  updateDraft('effect', choice(packEffectOptions, event.target.value, draft.effect))
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
              Tipo de textura
              <select
                onChange={(event) =>
                  updateDraft(
                    'texture',
                    choice(packTextureOptions, event.target.value, draft.texture),
                  )
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
              Intensidade da textura
              <input
                max="65"
                min="0"
                onChange={changeNumber('textureOpacity')}
                type="range"
                value={draft.textureOpacity}
              />
            </label>
          </fieldset>

          <p className="form-note">Elegibilidade e exceções continuam em Gestão avançada.</p>
          <button
            className="ops-button accent"
            disabled={!canSave}
            onClick={() => void saveArtwork()}
            type="button"
          >
            {saving ? 'Publicando...' : pack ? 'Atualizar e publicar' : 'Criar e publicar'}
          </button>
          {notice && <p className="form-success">{notice}</p>}
        </aside>

        <section className="pack-studio-canvas" aria-label="Preview do pack">
          <header>
            <p className="eyebrow">Preview ao vivo</p>
            <h2>{draft.name || 'Seu novo pack'}</h2>
            <p>
              {draft.cardsAmount} cartas · {draft.price.toLocaleString('pt-BR')} moedas · limite{' '}
              {draft.limitPerUser}
            </p>
          </header>
          <PackCanvas
            draft={draft}
            onCanvasReady={(canvas) => {
              canvasRef.current = canvas;
            }}
            onTextChange={(headline) => updateDraft('headline', headline)}
            onTextTransform={(headlineX, headlineY) =>
              setDraft((current) => ({ ...current, headlineX, headlineY }))
            }
          />
        </section>
      </div>
    </section>
  );
}
