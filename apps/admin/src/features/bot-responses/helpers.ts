import type { BotResponseDefinitionDto, BotResponseTemplateDto } from '@futhub/api-client';

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

export function exampleText(
  text: string,
  variables: BotResponseDefinitionDto['variables'],
): string {
  const examples = new Map(variables.map((variable) => [variable.token, variable.example]));
  return text.replace(/\{[^{}]+\}/g, (token) => examples.get(token) ?? token);
}

export function previewUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
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

export function templateError(
  template: BotResponseTemplateDto,
  definition: BotResponseDefinitionDto,
): string | null {
  if (template.mode === 'components_v2' && (template.content || template.embeds.length))
    return 'Components V2 não permite conteúdo ou embeds.';
  if (template.mode === 'legacy' && template.components.some((block) => block.type !== 'row'))
    return 'O modo legado aceita apenas linhas de botões.';
  if (template.mode === 'components_v2' && componentCount(template.components) > 40)
    return 'Use no máximo 40 componentes, contando containers, linhas e botões.';
  const embedCharacters = template.embeds.reduce(
    (total, embed) =>
      total +
      embed.title.length +
      embed.description.length +
      embed.footer.length +
      (embed.authorName?.length ?? 0) +
      embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0),
    0,
  );
  if (embedCharacters > 6000) return 'O conjunto de embeds aceita até 6000 caracteres.';
  for (const embed of template.embeds) {
    if (!embed.authorName?.trim() && (embed.authorUrl?.trim() || embed.authorIconUrl?.trim()))
      return 'URLs do autor exigem o nome do autor.';
    for (const value of [embed.authorUrl, embed.authorIconUrl]) {
      if (value?.trim() && !previewUrl(exampleText(value, definition.variables)))
        return 'Use uma URL HTTP ou HTTPS válida nos dados do autor.';
    }
  }
  const blocks = template.components.flatMap((block) =>
    block.type === 'container' ? block.components : [block],
  );
  const textCharacters = blocks.reduce(
    (total, block) => total + (block.type === 'text' ? block.content.length : 0),
    0,
  );
  if (textCharacters > 4000) return 'O conjunto de textos V2 aceita até 4000 caracteres.';
  for (const block of blocks) {
    if (block.type !== 'row') continue;
    if (!block.buttons.length || block.buttons.length > 5)
      return 'Cada linha precisa de 1 a 5 botões.';
    for (const button of block.buttons) {
      if (!definition.actions.some((action) => action.id === button.action))
        return 'Selecione uma ação do catálogo para cada botão.';
      if (!button.label.trim()) return 'Preencha o rótulo de cada botão.';
      if (button.action === 'link') {
        if (button.style !== 'link' || !previewUrl(exampleText(button.url, definition.variables)))
          return 'Botões de link precisam do estilo link e uma URL HTTP ou HTTPS válida.';
      } else if (
        !['primary', 'secondary', 'success', 'danger'].includes(button.style) ||
        button.url
      )
        return 'Ações do bot não podem usar estilo link ou URL.';
    }
  }
  return null;
}
