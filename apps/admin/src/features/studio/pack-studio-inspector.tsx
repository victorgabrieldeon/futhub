import type { Pack } from '../packs/actions';
import { PackStudioDesignFields } from './pack-studio-design-fields';
import type { PackStudioArt, PackStudioDraft } from './pack-studio-model';
import { PackStudioContentFields, PackStudioFields } from './pack-studio-pack-fields';
import { PackStudioPresets } from './pack-studio-presets';
import { StudioIcon } from './studio-icon';
import { StudioPanelHeader } from './studio-workspace';

export const packStudioTabs = [
  { id: 'design', label: 'Design' },
  { id: 'pack', label: 'Pack' },
  { id: 'content', label: 'Conteúdo' },
] as const;

export const packStudioLayers = [
  { id: 'background', label: 'Fundo & efeito', detail: 'Cor, foil e decoração', glyph: '◈' },
  { id: 'headline', label: 'Título', detail: '3 CARTAS', glyph: 'T' },
  { id: 'kicker', label: 'Subtítulo', detail: 'Opcional', glyph: 't' },
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
    onApplyArt: (art: PackStudioArt) => void;
    onCollapse: () => void;
    onSelectTab: (tab: PackStudioTab) => void;
  }>;

const tabTitles: Record<PackStudioTab, string> = {
  design: 'Design do pack',
  pack: 'Dados do pack',
  content: 'Conteúdo do pack',
};

export function PackStudioInspector({
  activeTab,
  activeLayer,
  onApplyArt,
  onCollapse,
  onSelectTab,
  ...fields
}: PackStudioInspectorProps) {
  const fieldProps: PackStudioFieldsProps = { ...fields, activeLayer, onSelectTab };
  return (
    <>
      <StudioPanelHeader
        actions={
          <button
            aria-label="Recolher painel de propriedades"
            className="studio-icon-button"
            onClick={onCollapse}
            type="button"
          >
            <StudioIcon name="panel-right" />
          </button>
        }
        eyebrow={activeTab === 'design' ? 'Personalização' : 'Publicação'}
        title={tabTitles[activeTab]}
      />
      <div className="studio-tabs" role="tablist" aria-label="Painéis de propriedades">
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
      <div className="studio-inspector__body">
        {packStudioTabs.map((tab) => (
          <div
            aria-labelledby={`pack-studio-tab-${tab.id}`}
            className="studio-panel"
            hidden={activeTab !== tab.id}
            id={`pack-studio-panel-${tab.id}`}
            key={tab.id}
            role="tabpanel"
          >
            {tab.id === 'pack' && activeTab === 'pack' && <PackStudioFields {...fieldProps} />}
            {tab.id === 'design' && activeTab === 'design' && (
              <>
                <PackStudioPresets draft={fields.draft} onApplyArt={onApplyArt} />
                <PackStudioDesignFields {...fieldProps} />
              </>
            )}
            {tab.id === 'content' && activeTab === 'content' && (
              <PackStudioContentFields {...fieldProps} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
