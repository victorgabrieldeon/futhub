'use client';

import { useEffect, useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  isSavedBase,
  MAX_LABEL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PLAYER_NAME_LENGTH,
  MAX_SLUG_LENGTH,
} from '../card-bases.js';
import type { CreateCardBaseBody, SavedBase } from '../card-bases.js';

type BaseForm = {
  accentColor: string;
  backgroundColor: string;
  label: string;
  name: string;
  playerName: string;
  rating: string;
  slug: string;
};

type CardStyle = CSSProperties & {
  '--accent': string;
  '--background': string;
};

const INITIAL_FORM: BaseForm = {
  accentColor: '#c2f600',
  backgroundColor: '#0b1510',
  label: 'RARE GOLD',
  name: 'Rare Gold 2026',
  playerName: 'FUTURA ESTRELA',
  rating: '89',
  slug: 'rare-gold-2026',
};

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cardStyle(form: BaseForm): CardStyle {
  return {
    '--accent': form.accentColor,
    '--background': form.backgroundColor,
  };
}

export function CardMaker() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [bases, setBases] = useState<SavedBase[]>([]);
  const [notice, setNotice] = useState('Pronto para salvar uma nova base.');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void fetch('/api/card-bases')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Catalog request failed');
        }

        const data: unknown = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid catalog');
        }

        setBases(data.filter(isSavedBase));
      })
      .catch(() => setNotice('Catalogo indisponivel ate o banco estar conectado.'));
  }, []);

  function updateField(field: keyof BaseForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'name' ? { slug: slugify(value) } : {}),
    }));
  }

  function saveBase() {
    startTransition(async () => {
      const body: CreateCardBaseBody = {
        design: {
          accentColor: form.accentColor,
          backgroundColor: form.backgroundColor,
          label: form.label,
          playerName: form.playerName,
          rating: form.rating,
        },
        height: CARD_HEIGHT,
        name: form.name,
        slug: form.slug,
        width: CARD_WIDTH,
      };

      try {
        const response = await fetch('/api/card-bases', {
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Save request failed');
        }

        const base: unknown = await response.json();
        if (!isSavedBase(base)) {
          throw new Error('Invalid saved base');
        }

        setBases((current) => [base, ...current.filter((item) => item.id !== base.id)]);
        setNotice(`Base "${form.name}" salva com sucesso.`);
      } catch {
        setNotice('Nao foi possivel salvar. Revise os campos e tente novamente.');
      }
    });
  }

  return (
    <main className="shell">
      <header className="topbar">
        <span className="format-label">Base fixa: 600 x 800 px</span>
        <div className="title-block">
          <p>Ferramentas internas</p>
          <h1>Card maker</h1>
        </div>
        <button
          className="ds-button save-button"
          disabled={isPending}
          onClick={saveBase}
          type="button"
        >
          {isPending ? 'Salvando...' : 'Salvar base'}
        </button>
      </header>

      <section className="workspace">
        <aside className="panel settings-panel">
          <div className="section-heading">
            <p>01 / Base</p>
            <h2>Identidade da carta</h2>
          </div>
          <label>
            Nome interno
            <input
              className="ds-field"
              maxLength={MAX_NAME_LENGTH}
              onChange={(event) => updateField('name', event.target.value)}
              value={form.name}
            />
          </label>
          <label>
            Identificador
            <input
              className="ds-field"
              maxLength={MAX_SLUG_LENGTH}
              onChange={(event) => updateField('slug', event.target.value)}
              value={form.slug}
            />
          </label>
          <p className="ds-note fixed-format">
            Formato da base: <strong>600 x 800 px</strong>
          </p>

          <div className="section-heading visual-heading">
            <p>02 / Visual</p>
            <h2>Paleta e amostra</h2>
          </div>
          <div className="two-columns colors">
            <label>
              Fundo
              <input
                className="ds-field"
                onChange={(event) => updateField('backgroundColor', event.target.value)}
                type="color"
                value={form.backgroundColor}
              />
            </label>
            <label>
              Destaque
              <input
                className="ds-field"
                onChange={(event) => updateField('accentColor', event.target.value)}
                type="color"
                value={form.accentColor}
              />
            </label>
          </div>
          <label>
            Raridade
            <input
              className="ds-field"
              maxLength={MAX_LABEL_LENGTH}
              onChange={(event) => updateField('label', event.target.value)}
              value={form.label}
            />
          </label>
          <label>
            Nome de exemplo
            <input
              className="ds-field"
              maxLength={MAX_PLAYER_NAME_LENGTH}
              onChange={(event) => updateField('playerName', event.target.value)}
              value={form.playerName}
            />
          </label>
          <label>
            Overall de exemplo
            <input
              className="ds-field"
              inputMode="numeric"
              max={99}
              maxLength={2}
              min={1}
              onChange={(event) => updateField('rating', event.target.value)}
              pattern="[0-9]{1,2}"
              value={form.rating}
            />
          </label>
        </aside>

        <section className="preview-area">
          <div className="preview-heading">
            <div>
              <p>Preview ao vivo</p>
              <h2>Base de carta</h2>
            </div>
            <span>
              {CARD_WIDTH} x {CARD_HEIGHT} px
            </span>
          </div>
          <div className="preview-stage">
            <article className="player-card" style={cardStyle(form)}>
              <div className="card-glow" />
              <div className="card-topline">
                <strong>{form.rating}</strong>
                <span>ATA</span>
              </div>
              <div className="portrait">
                <div className="portrait-silhouette" />
              </div>
              <div className="card-name">{form.playerName}</div>
              <div className="card-label">{form.label}</div>
              <div className="card-stats">
                <span>92 PAC</span>
                <span>88 FIN</span>
                <span>91 PAS</span>
              </div>
            </article>
          </div>
          <p aria-live="polite" className="notice">
            {notice}
          </p>
        </section>

        <aside className="panel guide-panel">
          <div className="section-heading">
            <p>Fluxo de trabalho</p>
            <h2>Da base ao elenco</h2>
          </div>
          <ol>
            <li>
              <span>1</span> Defina a estrutura visual reutilizavel.
            </li>
            <li>
              <span>2</span> Salve a base no catalogo do Dream Fut.
            </li>
            <li>
              <span>3</span> Use a base para gerar cartas de jogadores.
            </li>
          </ol>
          <div className="ds-note tip">
            <strong>Dica</strong>
            <p>
              Use um identificador estavel. Ele sera a referencia para futuras cartas e integracoes.
            </p>
          </div>
          <div className="catalog">
            <p className="catalog-title">Bases salvas ({bases.length})</p>
            {bases.length > 0 ? (
              <ul>
                {bases.map((base) => (
                  <li key={base.id}>
                    <strong>{base.name}</strong>
                    <span>{base.slug}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-catalog">As bases salvas aparecerao aqui.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
