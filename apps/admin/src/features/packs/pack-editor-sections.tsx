import type { Card, Reference } from '../cards/actions';
import type { PackInput } from './actions';
import { PackNumberField } from './pack-number-field';
import { type PackRuleKey, RuleChooser } from './pack-rule-chooser';
import {
  cardRuleOptions,
  collectionOptions,
  loadCardOptions,
  loadCollectionOptions,
  loadTeamOptions,
  positionOptions,
  teamOptions,
} from './pack-rule-options';

export type PackRuleChange = (
  onlyKey: PackRuleKey,
  excludedKey: PackRuleKey,
  id: string,
  target: 'only' | 'excluded',
) => void;
export type PackRuleTargetChange = (
  onlyKey: PackRuleKey,
  excludedKey: PackRuleKey,
  target: 'only' | 'excluded',
) => void;

export function IdentitySection({
  form,
  onChange,
}: Readonly<{ form: PackInput; onChange: (next: PackInput) => void }>) {
  return (
    <section className="pack-editor__section">
      <SectionHeading index="01" title="Identidade">
        Como pack aparece no catálogo e para jogadores.
      </SectionHeading>
      <div className="drawer-form-grid two-columns">
        <label className="full-width">
          Nome do pack
          <input
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            required
            value={form.name}
          />
        </label>
        <label>
          Emoji
          <input
            onChange={(event) => onChange({ ...form, emoji: event.target.value })}
            required
            value={form.emoji}
          />
        </label>
        <label>
          Cor de destaque
          <span className="pack-color-input">
            <input
              aria-label="Selecionar cor de destaque"
              onChange={(event) => onChange({ ...form, color: event.target.value })}
              type="color"
              value={form.color}
            />
            <input
              onChange={(event) => onChange({ ...form, color: event.target.value })}
              pattern="#[0-9A-Fa-f]{6}"
              value={form.color}
            />
          </span>
        </label>
        <label className="full-width">
          URL da imagem <small>Opcional</small>
          <input
            onChange={(event) => onChange({ ...form, imageUrl: event.target.value || null })}
            placeholder="https://..."
            type="url"
            value={form.imageUrl ?? ''}
          />
        </label>
      </div>
    </section>
  );
}

export function OfferSection({
  form,
  onChange,
}: Readonly<{ form: PackInput; onChange: (next: PackInput) => void }>) {
  return (
    <section className="pack-editor__section">
      <SectionHeading index="02" title="Oferta">
        Quantidade, custo e disponibilidade da compra.
      </SectionHeading>
      <div className="drawer-form-grid three-columns">
        <PackNumberField
          label="Cards por pack"
          min={1}
          onChange={(value) => onChange({ ...form, cardsAmount: value })}
          value={form.cardsAmount}
        />
        <PackNumberField
          label="Preço em moedas"
          min={0}
          onChange={(value) => onChange({ ...form, price: value })}
          value={form.price}
        />
        <PackNumberField
          label="Limite por jogador"
          min={0}
          onChange={(value) => onChange({ ...form, limitPerUser: value })}
          value={form.limitPerUser}
        />
      </div>
      <label className="pack-availability">
        <input
          checked={form.canBuy}
          onChange={(event) => onChange({ ...form, canBuy: event.target.checked })}
          type="checkbox"
        />
        <span>
          <b>{form.canBuy ? 'Pack à venda' : 'Pack pausado'}</b>
          <small>
            {form.canBuy
              ? 'Jogadores podem comprar este pack.'
              : 'O pack fica salvo, mas não pode ser comprado.'}
          </small>
        </span>
      </label>
    </section>
  );
}

export function EligibilitySection({
  cards,
  collections,
  form,
  onChange,
  onRuleChange,
  onRuleTargetChange,
  teams,
  validRange,
}: Readonly<{
  cards: readonly Card[];
  collections: readonly Reference[];
  form: PackInput;
  onChange: (next: PackInput) => void;
  onRuleChange: PackRuleChange;
  onRuleTargetChange: PackRuleTargetChange;
  teams: readonly Reference[];
  validRange: boolean;
}>) {
  return (
    <section className="pack-editor__section">
      <SectionHeading index="03" title="Elegibilidade">
        Controle quais cards podem entrar no pack.
      </SectionHeading>
      <div className="drawer-form-grid three-columns">
        <label className="full-width">
          Nome da regra <small>Opcional</small>
          <input
            onChange={(event) =>
              onChange({ ...form, config: { ...form.config, name: event.target.value || null } })
            }
            placeholder="Ex.: Ouro 85+"
            value={form.config.name ?? ''}
          />
        </label>
        <PackNumberField
          label="Overall mínimo"
          max={100}
          min={60}
          onChange={(value) => onChange({ ...form, config: { ...form.config, minOverall: value } })}
          value={form.config.minOverall}
        />
        <PackNumberField
          label="Overall máximo"
          max={100}
          min={60}
          onChange={(value) => onChange({ ...form, config: { ...form.config, maxOverall: value } })}
          value={form.config.maxOverall}
        />
      </div>
      {!validRange && <p className="form-error">Overall mínimo não pode ser maior que máximo.</p>}
      <div className="pack-editor__rules">
        <RuleChooser
          excluded={form.config.excludedPositions}
          excludedKey="excludedPositions"
          only={form.config.onlyPositions}
          onlyKey="onlyPositions"
          onChange={onRuleChange}
          onTargetChange={onRuleTargetChange}
          options={positionOptions}
          title="Posições"
        />
        <RuleChooser
          excluded={form.config.excludedCollectionIds}
          excludedKey="excludedCollectionIds"
          only={form.config.onlyCollectionIds}
          onlyKey="onlyCollectionIds"
          onChange={onRuleChange}
          onTargetChange={onRuleTargetChange}
          loadOptions={loadCollectionOptions}
          options={collectionOptions(collections)}
          title="Coleções"
        />
        <RuleChooser
          excluded={form.config.excludedTeamIds}
          excludedKey="excludedTeamIds"
          only={form.config.onlyTeamIds}
          onlyKey="onlyTeamIds"
          onChange={onRuleChange}
          onTargetChange={onRuleTargetChange}
          loadOptions={loadTeamOptions}
          options={teamOptions(teams)}
          title="Times"
        />
        <RuleChooser
          excluded={form.config.excludedCardIds}
          excludedKey="excludedCardIds"
          only={form.config.onlyCardIds}
          onlyKey="onlyCardIds"
          onChange={onRuleChange}
          onTargetChange={onRuleTargetChange}
          loadOptions={loadCardOptions}
          options={cardRuleOptions(cards)}
          title="Cards específicos"
        />
      </div>
    </section>
  );
}

function SectionHeading({
  children,
  index,
  title,
}: Readonly<{ children: string; index: string; title: string }>) {
  return (
    <div className="pack-editor__section-heading">
      <span>{index}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}
