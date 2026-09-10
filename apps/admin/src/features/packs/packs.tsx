import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminIcon } from '../../components/admin-icon';
import { listCards, listCollections, listTeams } from '../cards/actions';
import {
  type Pack,
  type PackInput,
  createPack,
  disablePack,
  listPacks,
  updatePack,
} from './actions';
import { PackCard, PacksEmpty } from './pack-card';
import { type PackCatalog, PackEditor } from './pack-editor';
import { emptyPack, packInput } from './pack-form';

type PackView = 'all' | 'live' | 'paused';
type NoticeTone = 'info' | 'error';

export function Packs() {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [catalog, setCatalog] = useState<PackCatalog>({ cards: [], collections: [], teams: [] });
  const [editing, setEditing] = useState<Pack | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<PackInput>(emptyPack);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<NoticeTone>('info');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<PackView>('all');
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextPacks, cards, collections, teams] = await Promise.all([
        listPacks(),
        listCards(1, 24, { sort: 'name' }),
        listCollections(1, 24),
        listTeams(1, 24),
      ]);
      setPacks(nextPacks);
      setCatalog({
        cards: cards.items,
        collections: collections.items,
        teams: teams.items,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível carregar os packs.');
      setNoticeTone('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visiblePacks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return packs.filter((pack) => {
      const matchesView = view === 'all' || (view === 'live' ? pack.canBuy : !pack.canBuy);
      return matchesView && (!term || pack.name.toLocaleLowerCase('pt-BR').includes(term));
    });
  }, [packs, query, view]);
  const activeCount = packs.filter((pack) => pack.canBuy).length;
  const pauseAction = editing?.canBuy ? () => void pausePack(editing) : null;

  function showNotice(message: string, tone: NoticeTone = 'info') {
    setNotice(message);
    setNoticeTone(tone);
  }

  function closeEditor() {
    if (working) return;
    setEditorOpen(false);
    setEditing(null);
    setForm(emptyPack());
  }

  function startPack() {
    setEditing(null);
    setForm(emptyPack());
    setEditorOpen(true);
  }

  function editPack(pack: Pack) {
    setEditing(pack);
    setForm(packInput(pack));
    setEditorOpen(true);
  }

  function openStudio() {
    if (!editing) return;
    navigate('/app/studio/packs', { state: { pack: editing } });
  }

  async function savePack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    try {
      const pack = editing ? await updatePack(editing.id, form) : await createPack(form);
      await load();
      setEditorOpen(false);
      setEditing(null);
      setForm(emptyPack());
      showNotice(editing ? `${pack.name} atualizado.` : `${pack.name} criado.`);
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : 'Não foi possível salvar o pack.',
        'error',
      );
    } finally {
      setWorking(false);
    }
  }

  async function pausePack(pack: Pack) {
    if (!window.confirm(`Pausar ${pack.name}? Jogadores não poderão comprá-lo.`)) return;
    setWorking(true);
    try {
      await disablePack(pack.id);
      await load();
      showNotice(`${pack.name} pausado.`);
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : 'Não foi possível pausar o pack.',
        'error',
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section aria-labelledby="packs-title" className="command-page cards-page packs-page">
      <header className="command-header">
        <div>
          <p className="eyebrow">Gestão comercial</p>
          <h1 className="page-title" id="packs-title">
            <AdminIcon className="page-title-icon" name="pack" />
            <span>
              Packs <span className="collection-count">{String(packs.length).padStart(2, '0')}</span>
            </span>
          </h1>
          <p>Monte ofertas, defina preço e controle quais cards entram em cada abertura.</p>
        </div>
        <div className="cards-header-side">
          <p className="cards-record-count">{activeCount} à venda</p>
          <div className="cards-header-actions">
            <button className="ops-button accent" onClick={startPack} type="button">
              + Novo pack
            </button>
          </div>
        </div>
      </header>

      <div className="cards-panel packs-panel">
        <div className="packs-toolbar">
          <div aria-label="Filtrar packs" className="command-tabs" role="tablist">
            {[
              ['all', 'Todos'],
              ['live', 'À venda'],
              ['paused', 'Pausados'],
            ].map(([id, label]) => (
              <button
                aria-selected={view === id}
                className="command-tab"
                key={id}
                onClick={() => setView(id as PackView)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <label className="packs-search">
            <span className="sr-only">Buscar pack</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pack"
              type="search"
              value={query}
            />
          </label>
        </div>

        <section aria-live="polite" className="packs-catalog collection-gallery">
          <header className="catalog-rail-header">
            <div>
              <p className="eyebrow">Catálogo de abertura</p>
              <h2>
                {view === 'live'
                  ? 'Packs à venda'
                  : view === 'paused'
                    ? 'Packs pausados'
                    : 'Todos os packs'}
              </h2>
            </div>
            <p className="packs-catalog__count">{visiblePacks.length} resultados</p>
          </header>
          {loading ? (
            <div aria-label="Carregando packs" className="packs-grid packs-grid--loading">
              <span />
              <span />
              <span />
            </div>
          ) : visiblePacks.length ? (
            <div className="packs-grid">
              {visiblePacks.map((pack) => (
                <PackCard key={pack.id} onOpen={editPack} pack={pack} />
              ))}
            </div>
          ) : (
            <PacksEmpty onCreate={startPack} />
          )}
        </section>
      </div>

      {notice && (
        <output className={`ops-toast ${noticeTone}`}>
          <span aria-hidden="true" />
          <p>{notice}</p>
          <button aria-label="Fechar aviso" onClick={() => setNotice('')} type="button">
            ×
          </button>
        </output>
      )}

      <PackEditor
        catalog={catalog}
        editingName={editing?.name ?? null}
        form={form}
        onChange={setForm}
        onClose={closeEditor}
        onOpenStudio={editing ? openStudio : null}
        onPause={pauseAction}
        onSave={savePack}
        open={editorOpen}
        working={working}
      />
    </section>
  );
}
