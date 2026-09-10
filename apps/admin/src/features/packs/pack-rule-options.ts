import { type Card, type Reference, listCards, listCollections, listTeams } from '../cards/actions';
import type { PackRuleOption, PackRuleOptionLoader } from './pack-rule-chooser';

const optionPageSize = 24;

const referenceOptions = (references: readonly Reference[]): readonly PackRuleOption[] =>
  references.map(({ id, name, emoji }) => ({ id, label: name, meta: emoji }));

const cardOptions = (cards: readonly Card[]): readonly PackRuleOption[] =>
  cards.map(({ id, name, position, overall }) => ({
    id,
    label: name,
    meta: `${position} · ${overall}`,
  }));

export const positionOptions: readonly PackRuleOption[] = 'GOL LD LE ZAG VOL MA MC PD PE CA'
  .split(' ')
  .map((id) => ({ id, label: id }));
export const collectionOptions = referenceOptions;
export const teamOptions = referenceOptions;
export const cardRuleOptions = cardOptions;

export const loadCardOptions: PackRuleOptionLoader = async (page, query) => {
  const result = await listCards(
    page,
    optionPageSize,
    query ? { query, sort: 'name' } : { sort: 'name' },
  );
  return { options: cardOptions(result.items), total: result.total };
};

export const loadCollectionOptions: PackRuleOptionLoader = async (page, query) => {
  const result = await listCollections(page, optionPageSize, query ? { query } : {});
  return { options: referenceOptions(result.items), total: result.total };
};

export const loadTeamOptions: PackRuleOptionLoader = async (page, query) => {
  const result = await listTeams(page, optionPageSize, query ? { query } : {});
  return { options: referenceOptions(result.items), total: result.total };
};
