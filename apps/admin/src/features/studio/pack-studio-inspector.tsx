import type { Pack } from '../packs/actions';
import { PackStudioDesignFields } from './pack-studio-design-fields';
import type { PackStudioDraft } from './pack-studio-model';
import { PackStudioContentFields, PackStudioFields } from './pack-studio-pack-fields';

export const packStudioTabs = [
  { id: 'design', label: 'Design' },
  { id: 'pack', label: 'Pack' },
  { id: 'content', label: 'Conteúdo' },
] as const;

export const packStudioLayers = [
  { id: 'background', label: 'Fundo & efeito', detail: 'Cor, foil e decoração', glyph: '◈' },
  { id: 'headline', label: 'Título', detail: '3 CARTAS', glyph: 'T' },
  { id: 'kicker', label: 'Subtítulo', detail: 'Opcional', glyph: 'T' },
] as const;

export type PackStudioTab = (typeof packStudioTabs)[number]['id'];
export type PackStudioLayer = (typeof packStudioLayers)[number]['id'];

export type PackStudioFieldsProps = Readonly<{
  activeLayer: PackStudioLayer;
  draft: PackStudioDraft;
  loading: boolean;
  packs: readonly Pack[];
  selectedId: string;
  onChoosePack: (id: string) => void;
  onChange: <Key extends keyof PackStudioDraft>(key: Key, value: PackStudioDraft[Key]) => void;
  onEditFrontImage: () => void;
  onSelectLayer: (layer: PackStudioLayer) => void;
  onSelectTab: (tab: PackStudioTab) => void;
}>;

type PackStudioInspectorProps = PackStudioFieldsProps &
  Readonly<{
    activeTab: PackStudioTab;
    onSelectTab: (tab: PackStudioTab) => void;
  }>;

export function PackStudioInspector({
  activeTab,
  activeLayer,
  onSelectTab,
  ...fields
}: PackStudioInspectorProps) {
  const fieldProps: PackStudioFieldsProps = { ...fields, activeLayer, onSelectTab };
  return (
    <>
      <div className="pack-studio-panel-heading">
        <div>
          <p className="eyebrow">{activeTab === 'design' ? 'Personalização' : 'Publicação'}</p>
          <h2>
            {activeTab === 'design'
              ? 'Design do pack'
              : activeTab === 'pack'
                ? 'Dados do pack'
                : 'Conteúdo do pack'}
          </h2>
        </div>
      </div>
      <div className="pack-studio-tabs" role="tablist" aria-label="Painéis de propriedades">
        {packStudioTabs.map((tab) => (
          <button
            aria-controls={`pack-studio-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            id={`pack-studio-tab-${tab.id}`}
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {packStudioTabs.map((tab) => (
        <div
          aria-labelledby={`pack-studio-tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          id={`pack-studio-panel-${tab.id}`}
          key={tab.id}
          role="tabpanel"
        >
          {tab.id === 'pack' && activeTab === 'pack' && <PackStudioFields {...fieldProps} />}
          {tab.id === 'design' && activeTab === 'design' && (
            <PackStudioDesignFields {...fieldProps} />
          )}
          {tab.id === 'content' && activeTab === 'content' && (
            <PackStudioContentFields {...fieldProps} />
          )}
        </div>
      ))}
    </>
  );
}
