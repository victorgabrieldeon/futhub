import { ApiClientError } from '@futhub/api-client';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  type Reference,
  type SquadImportClub,
  type SquadImportPlayer,
  type SquadImportPreview,
  type SquadImportResult,
  importSquad,
  loadSquadImportPreview,
  searchSquadImportClubs,
} from './actions';

type Row = Readonly<{ player: SquadImportPlayer; selected: boolean }>;
type ClubsStatus = 'idle' | 'loading' | 'ready' | 'error';

const minOverall = 60;
const maxOverall = 99;
const ratingKeys = [
  'defense',
  'attack',
  'creation',
  'passing',
  'control',
  'marking',
  'pace',
  'dribbling',
  'finishing',
] as const;

export function SquadImportDialog({
  collections,
  teams,
  onClose,
  onImported,
}: Readonly<{
  collections: Reference[];
  teams: Reference[];
  onClose: () => void;
  onImported: (result: SquadImportResult, teamName: string) => void | Promise<void>;
}>) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [query, setQuery] = useState('');
  const [clubs, setClubs] = useState<SquadImportClub[]>([]);
  const [clubsStatus, setClubsStatus] = useState<ClubsStatus>('idle');
  const [preview, setPreview] = useState<SquadImportPreview | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [collectionId, setCollectionId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [replaceImages, setReplaceImages] = useState(false);
  const [loadingSource, setLoadingSource] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>('input[name="club"]')?.focus();
  }, []);

  useEffect(() => {
    const search = query.trim();
    if (preview || search.length < 2) {
      setClubs([]);
      setClubsStatus('idle');
      return;
    }
    const controller = new AbortController();
    setClubsStatus('loading');
    const timer = window.setTimeout(() => {
      searchSquadImportClubs(search, controller.signal)
        .then((result) => {
          setClubs(result);
          setClubsStatus('ready');
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setClubsStatus('error');
          if (!controller.signal.aborted) console.error(reason);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [preview, query]);

  async function openSquad(source: Readonly<{ clubId: number } | { name: string }>, key: string) {
    setLoadingSource(key);
    setError('');
    try {
      const squad = await loadSquadImportPreview(source);
      setPreview(squad);
      setTeamId(squad.existingTeam?.id ?? '');
      setRows(squad.players.map((player) => ({ player, selected: player.overall >= minOverall })));
    } catch (reason) {
      setError(sourceErrorMessage(reason));
    } finally {
      setLoadingSource('');
    }
  }

  function changeOverall(index: number, overall: number) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, player: withOverall(row.player, overall) } : row,
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) return;
    const players = rows
      .filter((row) => row.selected && isEligible(row.player))
      .map(({ player: { sourceId: _sourceId, ...player } }) => player);
    if (!players.length) return setError('Selecione pelo menos um jogador.');
    setImporting(true);
    setError('');
    try {
      const result = await importSquad({
        collectionId,
        teamId: selectedTeam?.id ?? null,
        team: preview.team,
        players,
        crestUrl: preview.crestUrl,
        replaceImages: Boolean(selectedTeam) && replaceImages,
      });
      await onImported(result, selectedTeam?.name ?? preview.team.name);
    } catch (reason) {
      setError(sourceErrorMessage(reason));
    } finally {
      setImporting(false);
    }
  }

  const selectable = rows.filter((row) => isEligible(row.player));
  const selectedCount = selectable.filter((row) => row.selected).length;
  const allSelected = selectable.length > 0 && selectedCount === selectable.length;
  const baseOverall = rows[0]?.player.overall ?? 72;
  const selectedTeam = teamId
    ? (teams.find((team) => team.id === teamId) ??
      (preview?.existingTeam?.id === teamId ? preview.existingTeam : null))
    : null;
  const teamOptions = [...teams].sort((left, right) =>
    left.name.localeCompare(right.name, 'pt-BR'),
  );
  const crest = selectedTeam
    ? selectedTeam.imageUrl
    : (preview?.team.imageUrl ?? preview?.crestUrl ?? null);

  return (
    <dialog
      aria-labelledby="squad-import-title"
      className="ops-dialog squad-import-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget && !importing) onClose();
      }}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && importing) event.preventDefault();
      }}
      ref={dialog}
    >
      <form className="ops-dialog-card" onSubmit={submit}>
        <header>
          <div>
            <p className="eyebrow">Importar time</p>
            <h2 id="squad-import-title">
              {preview ? (selectedTeam?.name ?? preview.team.name) : 'Buscar clube'}
            </h2>
            <p>
              {preview
                ? 'Revise o elenco, escolha a coleção e importe os cards de uma vez.'
                : 'Busque um clube do EA SPORTS FC 26 para trazer escudo, cores, jogadores, atributos e fotos.'}
            </p>
          </div>
          <button aria-label="Fechar" disabled={importing} onClick={onClose} type="button">
            ×
          </button>
        </header>

        {error && (
          <p className="squad-import-error" role="alert">
            {error}
          </p>
        )}

        {!preview ? (
          <div className="ops-dialog-body squad-import-search">
            <label>
              Clube
              <input
                autoComplete="off"
                name="club"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ex.: Real Madrid, Liverpool, Flamengo"
                value={query}
              />
            </label>
            <div aria-busy={clubsStatus === 'loading'} aria-live="polite">
              {clubsStatus === 'loading' ? (
                <p className="squad-import-empty">Buscando clubes…</p>
              ) : clubs.length ? (
                <ul className="squad-import-clubs">
                  {clubs.map((club) => (
                    <li key={club.id}>
                      <button
                        disabled={Boolean(loadingSource)}
                        onClick={() => void openSquad({ clubId: club.id }, `club-${club.id}`)}
                        type="button"
                      >
                        <img alt="" src={club.imageUrl} />
                        <span>
                          <strong>{club.name}</strong>
                          <small>{club.league || 'EA SPORTS FC'}</small>
                        </span>
                        <em>
                          {loadingSource === `club-${club.id}` ? 'Carregando…' : 'Ver elenco'}
                        </em>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="squad-import-empty">
                  {clubsStatus === 'error'
                    ? 'Não foi possível buscar clubes agora.'
                    : query.trim().length < 2
                      ? 'Digite pelo menos duas letras do nome do clube.'
                      : 'Nenhum clube encontrado na base do EA SPORTS FC.'}
                </p>
              )}
            </div>
            {query.trim().length >= 2 && clubsStatus !== 'loading' && (
              <button
                className="squad-import-fallback"
                disabled={Boolean(loadingSource)}
                onClick={() => void openSquad({ name: query.trim() }, 'name')}
                type="button"
              >
                {loadingSource === 'name'
                  ? 'Buscando elenco…'
                  : `Não achou? Buscar o elenco de “${query.trim()}” no TheSportsDB`}
              </button>
            )}
          </div>
        ) : (
          <div className="ops-dialog-body squad-import-review">
            <section className="team-identity-preview squad-import-team">
              <span className="team-identity-mark" style={{ backgroundColor: preview.team.color }}>
                {crest ? <img alt="" src={crest} /> : (selectedTeam?.emoji ?? preview.team.emoji)}
              </span>
              <div>
                <p className="eyebrow">{selectedTeam ? 'Time já cadastrado' : 'Novo time'}</p>
                <strong>{selectedTeam?.name ?? preview.team.name}</strong>
                <span>
                  {selectedTeam
                    ? selectedTeam.imageUrl || !preview.crestUrl
                      ? 'Os cards serão vinculados a este time, com o escudo dele na arte.'
                      : 'Os cards serão vinculados a este time, que vai receber o escudo da EA.'
                    : preview.team.imageUrl
                      ? 'Escudo e cores do FootyLogos.'
                      : preview.crestUrl
                        ? 'Escudo oficial do EA SPORTS FC.'
                        : 'Sem escudo encontrado. Você pode escolher um depois.'}
                </span>
              </div>
              <a href={preview.sourceUrl} rel="noreferrer" target="_blank">
                {preview.provider}
              </a>
            </section>

            {preview.estimated && (
              <div className="squad-import-estimated">
                <p>
                  Este clube não está na base da EA. Nomes, posições e fotos vêm do TheSportsDB, e
                  os atributos são estimados a partir do overall de cada jogador.
                </p>
                <label>
                  Overall de todos
                  <input
                    max={maxOverall}
                    min={minOverall}
                    onChange={(event) => {
                      const overall = Number(event.target.value);
                      if (!Number.isFinite(overall)) return;
                      setRows((current) =>
                        current.map((row) => ({
                          ...row,
                          player: withOverall(row.player, overall),
                        })),
                      );
                    }}
                    type="number"
                    value={baseOverall}
                  />
                </label>
              </div>
            )}

            <label>
              Time dos cards
              <select onChange={(event) => setTeamId(event.target.value)} value={teamId}>
                <option value="">Criar novo time: {preview.team.name}</option>
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.emoji} {team.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Coleção dos cards
              <select
                onChange={(event) => setCollectionId(event.target.value)}
                required
                value={collectionId}
              >
                <option value="">Selecione a coleção</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.emoji} {collection.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedTeam && (
              <label className="squad-import-check">
                <input
                  checked={replaceImages}
                  onChange={(event) => setReplaceImages(event.target.checked)}
                  type="checkbox"
                />
                Redesenhar a arte dos cards que já existem (substitui recortes manuais)
              </label>
            )}

            <section aria-labelledby="squad-import-players" className="squad-import-players">
              <header>
                <label className="squad-import-check">
                  <input
                    checked={allSelected}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((row) =>
                          isEligible(row.player) ? { ...row, selected: event.target.checked } : row,
                        ),
                      )
                    }
                    type="checkbox"
                  />
                  <span id="squad-import-players">
                    {selectedCount} de {rows.length} jogadores selecionados
                  </span>
                </label>
              </header>
              <ul>
                {rows.map((row, index) => {
                  const eligible = isEligible(row.player);
                  return (
                    <li className={eligible ? '' : 'is-ineligible'} key={row.player.sourceId}>
                      <input
                        aria-label={`Importar ${row.player.name}`}
                        checked={row.selected && eligible}
                        disabled={!eligible}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, selected: event.target.checked }
                                : item,
                            ),
                          )
                        }
                        type="checkbox"
                      />
                      <span className="squad-import-photo">
                        {row.player.photoUrl ? (
                          <img alt="" loading="lazy" src={row.player.photoUrl} />
                        ) : (
                          row.player.name.slice(0, 1)
                        )}
                      </span>
                      <span className="squad-import-player">
                        <strong>{row.player.name}</strong>
                        <small>
                          {[row.player.position, ...row.player.secondaryPositions].join(' · ')}
                          {eligible ? '' : ' · abaixo do overall mínimo (60)'}
                        </small>
                      </span>
                      <input
                        aria-label={`Overall de ${row.player.name}`}
                        className="squad-import-overall"
                        max={maxOverall}
                        min={1}
                        onChange={(event) => {
                          const overall = Number(event.target.value);
                          if (Number.isFinite(overall)) changeOverall(index, overall);
                        }}
                        type="number"
                        value={row.player.overall}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}

        <footer>
          <button
            className="ops-button secondary"
            disabled={importing}
            onClick={() => {
              if (!preview) return onClose();
              setPreview(null);
              setRows([]);
              setError('');
            }}
            type="button"
          >
            {preview ? 'Voltar' : 'Cancelar'}
          </button>
          {preview && (
            <button
              className="ops-button accent"
              disabled={importing || !selectedCount || !collectionId}
              type="submit"
            >
              {importing
                ? 'Importando…'
                : `Importar ${selectedCount} ${selectedCount === 1 ? 'jogador' : 'jogadores'}`}
            </button>
          )}
        </footer>
      </form>
    </dialog>
  );
}

function isEligible(player: SquadImportPlayer): boolean {
  return player.overall >= minOverall && player.overall <= maxOverall;
}

// Shifting every attribute by the overall delta keeps the player's profile intact.
function withOverall(player: SquadImportPlayer, overall: number): SquadImportPlayer {
  const next = Math.min(maxOverall, Math.max(1, Math.round(overall)));
  const delta = next - player.overall;
  const shifted = { ...player, overall: next };
  for (const key of ratingKeys) {
    shifted[key] = Math.min(maxOverall, Math.max(1, player[key] + delta));
  }
  return shifted;
}

function sourceErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 502) return 'A fonte de dados não respondeu agora. Tente novamente.';
    if (error.status === 409) return 'Já existe um time com esse nome ou slug.';
  }
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}
