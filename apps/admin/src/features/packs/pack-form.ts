import type { Pack, PackInput } from './actions';

export function emptyPack(): PackInput {
  return {
    name: '',
    imageUrl: null,
    color: '#20242b',
    emoji: '📦',
    cardsAmount: 3,
    price: 15,
    canBuy: true,
    limitPerUser: 10,
    config: {
      name: null,
      minOverall: 60,
      maxOverall: 100,
      onlyPositions: [],
      excludedPositions: [],
      onlyCollectionIds: [],
      excludedCollectionIds: [],
      onlyCardIds: [],
      excludedCardIds: [],
      onlyTeamIds: [],
      excludedTeamIds: [],
    },
  };
}

export function packInput(pack: Pack): PackInput {
  const { config, id: _, presentation: _presentation, ...values } = pack;
  const { id: _configId, ...configValues } = config;
  return { ...values, config: configValues };
}
