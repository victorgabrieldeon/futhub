import { ApiClientError } from '@futhub/api-client';

import {
  autoLineup,
  loadClub,
  loadLeague,
  loadTeam,
  queueLeagueMatch,
  reloadTeam,
  sellTeamCard,
  setCaptain,
  setFormation,
  setLineupCard,
  setTactic,
  toggleFavorite,
  upgradeClubStadium,
} from './api.js';
import { teamResponse } from './response.js';
import {
  type TeamAction,
  type TeamPosition,
  type TeamSession,
  type TeamTab,
  createTeamSession,
  updateTeamSession,
} from './session.js';

type Identity = TeamSession['identity'];
type Event =
  | { kind: 'button'; action: TeamAction; argument: string }
  | { kind: 'select'; action: TeamAction; argument: string; value: string }
  | { kind: 'search'; name: string };

export async function openTeamPanel(
  identity: Identity,
  ephemeral: boolean,
  tab: TeamTab = 'overview',
) {
  const filters = { name: '', position: null, collectionId: null, sort: 'overall' } as const;
  const [team, club, league] = await Promise.all([
    loadTeam(identity, { ...filters, page: 1 }),
    tab === 'club' ? loadClub(identity) : null,
    tab === 'league' ? loadLeague(identity) : null,
  ]);
  const session = createTeamSession({
    ownerId: identity.id,
    identity,
    ephemeral,
    tab,
    filters,
    selectedCardId: null,
    confirmSale: false,
    team,
    club,
    league,
  });
  return teamResponse(session);
}

// The interaction handlers only parse ownership and acknowledge Discord; all panel transitions live here.
export async function updateTeamPanel(session: TeamSession, event: Event) {
  if (event.kind === 'search') {
    const filters = { ...session.filters, name: event.name.trim().slice(0, 80) };
    const team = await reloadTeam({ ...session, filters });
    return teamResponse(
      updateTeamSession(session, {
        filters,
        team,
        selectedCardId: null,
        confirmSale: false,
      }),
    );
  }
  const { action, argument } = event;
  if (event.kind === 'button') {
    if (action === 'league-refresh' || action === 'league-queue') {
      try {
        const league =
          action === 'league-queue'
            ? await queueLeagueMatch(session.identity)
            : await loadLeague(session.identity);
        return teamResponse(updateTeamSession(session, { league }));
      } catch (error) {
        console.error('Failed to update league panel.', error);
        const notice =
          action === 'league-queue' && error instanceof ApiClientError && error.status === 400
            ? '⚠️ Complete sua escalação com 11 titulares compatíveis antes de buscar partida.'
            : '❌ Não foi possível atualizar a liga. Tente novamente.';
        return teamResponse(session, notice);
      }
    }
    if (action === 'cancel')
      return teamResponse(updateTeamSession(session, { confirmSale: false }));
    if (action === 'page') {
      const page = Number(argument);
      if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid inventory page.');
      const team = await reloadTeam(session, page);
      return teamResponse(
        updateTeamSession(session, {
          team,
          selectedCardId: null,
          confirmSale: false,
        }),
      );
    }
    if (action === 'sort') {
      if (!isSort(argument)) throw new Error('Invalid inventory sort.');
      return filteredPanel(session, { ...session.filters, sort: argument });
    }
    if (action === 'stadium-upgrade') {
      const club = await upgradeClubStadium(session.identity);
      return teamResponse(
        updateTeamSession(session, {
          club,
          team: { ...session.team, balance: club.balance },
        }),
        '✅ Estádio melhorado.',
      );
    }
    if (action === 'sell-confirm') {
      if (session.selectedCardId !== argument) throw new Error('Selected card changed.');
      return teamResponse(
        updateTeamSession(session, { confirmSale: true }),
        '⚠️ Confirme a venda. Esta ação é definitiva.',
      );
    }
    let notice: string;
    if (action === 'auto') {
      await autoLineup(session.identity);
      notice = '✅ Melhor escalação compatível aplicada.';
    } else if (action === 'tactic') {
      if (!isTactic(argument)) throw new Error('Invalid tactic.');
      await setTactic(session.identity, argument);
      notice = '✅ Tática atualizada.';
    } else if (action === 'favorite') {
      await toggleFavorite(session.identity, argument);
      notice = '✅ Favorito atualizado.';
    } else if (action === 'sell') {
      const card = session.team.inventory.items.find(({ userCardId }) => userCardId === argument);
      if (
        session.tab !== 'sale' ||
        !session.confirmSale ||
        session.selectedCardId !== argument ||
        !card ||
        card.holder ||
        card.favorite ||
        card.captain ||
        card.sellPrice <= 0
      )
        throw new Error('Card is not available for sale.');
      const sale = await sellTeamCard(session.identity, argument);
      notice = `✅ ${card.name} vendido por ${sale.amount}. Saldo: ${sale.balance}.`;
    } else {
      throw new Error('Unsupported team button action.');
    }
    const team = await reloadTeam(session);
    return teamResponse(
      updateTeamSession(session, {
        team,
        selectedCardId: action === 'sell' ? null : session.selectedCardId,
        confirmSale: false,
      }),
      notice,
    );
  }

  const { value } = event;
  if (action === 'tab') {
    if (!isTab(value)) throw new Error('Invalid team tab.');
    const [club, league] = await Promise.all([
      value === 'club' ? loadClub(session.identity) : session.club,
      value === 'league' ? loadLeague(session.identity) : session.league,
    ]);
    return teamResponse(
      updateTeamSession(session, {
        tab: value,
        selectedCardId: null,
        confirmSale: false,
        club,
        league,
      }),
    );
  }
  if (action === 'card') {
    const selectedCardId = session.team.inventory.items.some(
      ({ userCardId }) => userCardId === value,
    )
      ? value
      : null;
    return teamResponse(updateTeamSession(session, { selectedCardId, confirmSale: false }));
  }
  if (action === 'position-filter') {
    if (value !== 'all' && !isPosition(value)) throw new Error('Invalid position filter.');
    return filteredPanel(session, { ...session.filters, position: value === 'all' ? null : value });
  }
  if (action === 'collection-filter') {
    const collectionId = value === 'all' ? null : value;
    if (
      collectionId &&
      !session.team.collections.some((collection) => collection.id === collectionId)
    )
      throw new Error('Invalid collection filter.');
    return filteredPanel(session, { ...session.filters, collectionId });
  }
  let notice: string;
  if (action === 'formation') {
    await setFormation(session.identity, value);
    notice = '✅ Formação e escalação atualizadas.';
  } else if (action === 'captain') {
    await setCaptain(session.identity, value);
    notice = '✅ Capitão definido.';
  } else if (action === 'lineup') {
    if (!isPosition(value) || session.selectedCardId !== argument)
      throw new Error('Invalid lineup selection.');
    await setLineupCard(session.identity, argument, value);
    notice = '✅ Jogador escalado.';
  } else {
    throw new Error('Unsupported team selection action.');
  }
  const team = await reloadTeam(session);
  return teamResponse(updateTeamSession(session, { team, confirmSale: false }), notice);
}

async function filteredPanel(session: TeamSession, filters: TeamSession['filters']) {
  const team = await reloadTeam({ ...session, filters });
  return teamResponse(
    updateTeamSession(session, {
      filters,
      team,
      selectedCardId: null,
      confirmSale: false,
    }),
  );
}

function isTab(value: string): value is TeamTab {
  return ['overview', 'lineup', 'inventory', 'packs', 'sale', 'club', 'league'].includes(value);
}

function isPosition(value: string): value is TeamPosition {
  return ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'].includes(value);
}

function isTactic(value: string): value is TeamSession['team']['tactic'] {
  return ['defensive', 'balanced', 'offensive'].includes(value);
}

function isSort(value: string): value is TeamSession['filters']['sort'] {
  return ['overall', 'name', 'recent'].includes(value);
}
