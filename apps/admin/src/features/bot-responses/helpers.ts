import type { BotResponseTemplateDto } from '@futhub/api-client';
import type { Template } from '@futhub/bot-templates';

export type BotResponseComponentDto = BotResponseTemplateDto['components'][number];

type ResponseDraft = {
  template: BotResponseTemplateDto;
  baseline: string;
  pending: boolean;
  error: string;
  notice: string;
};

export function createResponseDrafts() {
  // ponytail: one authenticated layout owns memory; persistent drafts need a server session identity.
  const entries = new Map<string, ResponseDraft>();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const set = (key: string, draft: ResponseDraft) => {
    entries.set(key, draft);
    emit();
  };
  return {
    get: (key: string) => entries.get(key),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load(key: string, template: BotResponseTemplateDto) {
      set(key, {
        template,
        baseline: JSON.stringify(template),
        pending: false,
        error: '',
        notice: '',
      });
    },
    edit(key: string, template: BotResponseTemplateDto) {
      const current = entries.get(key);
      if (current && !current.pending) set(key, { ...current, template, error: '', notice: '' });
    },
    discard(key: string) {
      entries.delete(key);
      emit();
    },
    clear() {
      entries.clear();
      emit();
    },
    hasUnsaved() {
      return [...entries.values()].some(
        (draft) => draft.pending || JSON.stringify(draft.template) !== draft.baseline,
      );
    },
    async save(
      key: string,
      persist: (template: BotResponseTemplateDto) => Promise<BotResponseTemplateDto>,
      describeError: (cause: unknown) => string,
    ) {
      const current = entries.get(key);
      if (!current || current.pending) return;
      const saving = { ...current, pending: true, error: '', notice: '' };
      set(key, saving);
      try {
        const template = await persist(saving.template);
        if (entries.get(key) !== saving) return;
        set(key, {
          template,
          baseline: JSON.stringify(template),
          pending: false,
          error: '',
          notice: 'Resposta salva.',
        });
      } catch (cause) {
        if (entries.get(key) !== saving) return;
        set(key, {
          ...saving,
          pending: false,
          error: `${describeError(cause)} O rascunho foi preservado; tente salvar novamente.`,
        });
      }
    },
  };
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function changeMode(
  template: BotResponseTemplateDto,
  mode: BotResponseTemplateDto['mode'],
): BotResponseTemplateDto {
  if (template.mode === mode) return template;
  return mode === 'components_v2'
    ? { ...template, mode, content: '', embeds: [] }
    : {
        ...template,
        mode,
        components: template.components.filter((block) => block.type === 'row'),
      };
}

export function componentCount(components: BotResponseTemplateDto['components']): number {
  return components.reduce(
    (total, component) =>
      total +
      1 +
      (component.type === 'container'
        ? componentCount(component.components)
        : component.type === 'row'
          ? component.buttons.length
          : 0),
    0,
  );
}

/** Shows a generated image in the message: a media block in V2, the embed image in legacy. */
export function attachImage(template: Template, ref: string): Template {
  if (template.mode === 'components_v2') {
    const media = { type: 'media' as const, url: ref, description: '' };
    const container = template.components.findIndex((block) => block.type === 'container');
    const target = template.components[container];
    if (target?.type === 'container' && target.components.length < 39)
      return {
        ...template,
        components: template.components.map((block, index) =>
          index === container && block.type === 'container'
            ? { ...block, components: [...block.components, media] }
            : block,
        ),
      };
    return { ...template, components: [...template.components, media] };
  }
  const [first, ...rest] = template.embeds;
  if (first) return { ...template, embeds: [{ ...first, imageUrl: ref }, ...rest] };
  return {
    ...template,
    embeds: [
      {
        title: '',
        description: '',
        color: '',
        footer: '',
        imageUrl: ref,
        thumbnailUrl: '',
        fields: [],
      },
    ],
  };
}
