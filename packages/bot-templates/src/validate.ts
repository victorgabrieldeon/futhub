import { EMOJI_NAME, literal, pipes, tokens } from './expand.js';
import {
  IMAGE_ID,
  TemplateRenderError,
  createScope,
  exampleData,
  httpUrl,
  imageId,
  render,
} from './render.js';
import type { CanvasLayer, Definition, ItemLayer, Template, TemplateComponent } from './types.js';

const COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
const SOLID = /^#[0-9a-f]{6}$/i;

class Invalid extends Error {}
const fail = (message: string): never => {
  throw new Invalid(message);
};

type Names = { scalars: Set<string>; lists: Set<string> };

function checkText(value: string, names: Names, where: string): void {
  if (/[{}]/.test(literal(value))) fail(`${where}: chave "{" ou "}" solta. Variáveis usam {nome}.`);
  for (const token of tokens(value)) {
    if (!token) fail(`${where}: variável malformada (emojis usam {emoji:nome}).`);
    else if (token.emoji) {
      if (token.pipes.length) fail(`${where}: emojis não aceitam filtros.`);
    } else {
      const isList = names.lists.has(token.name);
      if (!isList && !names.scalars.has(token.name))
        fail(`${where}: variável desconhecida {${token.name}}.`);
      for (const pipe of token.pipes) {
        if (!Object.hasOwn(pipes, pipe)) fail(`${where}: filtro desconhecido "|${pipe}".`);
        if (pipe === 'count' && !isList) fail(`${where}: "|count" só funciona em listas.`);
      }
    }
  }
}

/** Image slots accept '', a generated image, one whole token, or an HTTP(S) URL with fixed host. */
function checkImage(value: string, names: Names, images: Set<string>, where: string): void {
  checkText(value, names, where);
  const trimmed = value.trim();
  if (trimmed.includes('{emoji:')) fail(`${where}: emojis não podem ser usados em URLs.`);
  if (!trimmed || /^\{[^{}]+\}$/.test(trimmed)) return;
  if (trimmed.startsWith('attachment://')) {
    const id = imageId(trimmed);
    if (!id || !images.has(id)) fail(`${where}: imagem gerada inexistente.`);
    return;
  }
  checkLink(trimmed, where);
}

function checkLink(value: string, where: string): void {
  if (value.includes('{emoji:')) fail(`${where}: emojis não podem ser usados em URLs.`);
  if (!/^https?:\/\/[^/{}\s]+(?:[/?#]|$)/i.test(value) || /[\s\\]/.test(value))
    fail(`${where}: use uma URL HTTP(S) com domínio fixo.`);
  if (!httpUrl(value.replace(/\{[^{}]*\}/g, 'x'))) fail(`${where}: URL inválida.`);
}

function checkColor(value: string, where: string, solid = false): void {
  if (value && !(solid ? SOLID : COLOR).test(value)) fail(`${where}: cor inválida.`);
}

function checkLayers(
  layers: readonly (CanvasLayer | ItemLayer)[],
  names: Names,
  definition: Definition,
  where: string,
): void {
  layers.forEach((layer, index) => {
    const at = `${where}, camada ${index + 1}`;
    switch (layer.type) {
      case 'rect':
        checkColor(layer.fill, at);
        checkColor(layer.fill2, at);
        checkColor(layer.stroke, at);
        checkText(layer.progress, names, `${at}, progresso`);
        break;
      case 'text':
        checkText(layer.text, names, at);
        checkColor(layer.color, at);
        break;
      case 'image':
        checkImage(layer.url, names, new Set(), at);
        break;
      case 'list': {
        const list = definition.lists.find((entry) => entry.name === layer.source);
        if (!list) fail(`${at}: lista "${layer.source}" indisponível nesta resposta.`);
        checkLayers(layer.layers, itemNames(names, list?.fields ?? []), definition, `${at} (item)`);
        break;
      }
    }
  });
}

function itemNames(names: Names, fields: readonly { name: string }[]): Names {
  return {
    scalars: new Set([...names.scalars, 'index', ...fields.map((field) => field.name)]),
    lists: new Set(),
  };
}

function checkComponents(
  components: readonly TemplateComponent[],
  names: Names,
  images: Set<string>,
  definition: Definition,
  nested = false,
): void {
  const actions = new Set(definition.actions.map((action) => action.id));
  for (const item of components) {
    switch (item.type) {
      case 'container':
        if (nested) fail('Containers não podem ficar dentro de containers.');
        checkColor(item.color, 'Cor do container', true);
        checkComponents(item.components, names, images, definition, true);
        break;
      case 'text':
        checkText(item.content, names, 'Bloco de texto');
        break;
      case 'media':
        if (!item.url.trim()) fail('Mídia: informe uma URL, variável ou imagem gerada.');
        checkImage(item.url, names, images, 'Mídia');
        checkText(item.description, names, 'Descrição da mídia');
        break;
      case 'row':
        if (!item.buttons.length || item.buttons.length > 5)
          fail('Cada linha precisa de 1 a 5 botões.');
        for (const button of item.buttons) {
          if (!actions.has(button.action))
            fail(`Ação indisponível nesta resposta: ${button.action}.`);
          if (!button.label.trim()) fail('Preencha o rótulo de cada botão.');
          if (button.emoji && !EMOJI_NAME.test(button.emoji))
            fail('Emoji do botão: use o nome de um emoji do bot (2 a 32 letras, números ou _).');
          checkText(button.label, names, 'Rótulo do botão');
          if (button.action === 'link') {
            if (button.style !== 'link') fail('Botões de link precisam do estilo link.');
            checkText(button.url, names, 'URL do botão');
            checkLink(button.url, 'URL do botão');
          }
        }
        break;
      case 'separator':
        break;
    }
  }
}

/** Returns the first problem in Portuguese, or null when the template can be published. */
export function validateTemplate(definition: Definition, template: Template): string | null {
  try {
    const names: Names = {
      scalars: new Set(definition.variables.map((variable) => variable.token.slice(1, -1))),
      lists: new Set(definition.lists.map((list) => list.name)),
    };
    const images = new Set<string>();
    for (const image of template.images ?? []) {
      if (!IMAGE_ID.test(image.id))
        fail('IDs de imagem usam letras minúsculas, números e hífen (até 32).');
      if (images.has(image.id)) fail(`ID de imagem repetido: ${image.id}.`);
      images.add(image.id);
      checkColor(image.background, `Imagem ${image.id}`);
      checkLayers(image.layers, names, definition, `Imagem ${image.id}`);
    }
    const seen = new Set<string>();
    for (const format of template.lists ?? []) {
      const list = definition.lists.find((entry) => entry.name === format.source);
      if (!list) fail(`Lista "${format.source}" indisponível nesta resposta.`);
      if (seen.has(format.source)) fail(`Formato repetido para a lista ${format.source}.`);
      seen.add(format.source);
      const where = `Lista {${format.source}}`;
      checkText(format.item, itemNames(names, list?.fields ?? []), `${where}, item`);
      checkText(format.separator, { scalars: new Set(), lists: new Set() }, `${where}, separador`);
      checkText(format.empty, { ...names, lists: new Set() }, `${where}, vazia`);
      checkText(format.prefix ?? '', { ...names, lists: new Set() }, `${where}, antes`);
      checkText(format.suffix ?? '', { ...names, lists: new Set() }, `${where}, depois`);
      checkText(
        format.more,
        { scalars: new Set([...names.scalars, 'rest', 'total']), lists: new Set() },
        `${where}, excedente`,
      );
    }
    checkText(template.content, names, 'Conteúdo');
    template.embeds.forEach((embed, index) => {
      const where = `Embed ${index + 1}`;
      for (const value of [embed.title, embed.description, embed.footer, embed.authorName ?? ''])
        checkText(value, names, where);
      for (const field of embed.fields) {
        if (!field.name.trim() || !field.value.trim())
          fail(`${where}: campos não podem ficar vazios.`);
        checkText(field.name, names, where);
        checkText(field.value, names, where);
      }
      checkColor(embed.color, `${where}, cor`, true);
      if (!embed.authorName?.trim() && (embed.authorUrl?.trim() || embed.authorIconUrl?.trim()))
        fail(`${where}: URLs do autor exigem o nome do autor.`);
      if (embed.authorUrl?.trim()) {
        checkText(embed.authorUrl, names, `${where}, link do autor`);
        checkLink(embed.authorUrl.trim(), `${where}, link do autor`);
      }
      checkImage(embed.authorIconUrl ?? '', names, images, `${where}, ícone do autor`);
      checkImage(embed.imageUrl, names, images, `${where}, imagem`);
      checkImage(embed.thumbnailUrl, names, images, `${where}, miniatura`);
    });
    checkComponents(template.components, names, images, definition);
    if (template.mode === 'legacy') {
      if (template.components.some((item) => item.type !== 'row'))
        fail('O modo legado aceita apenas linhas de botões.');
      if (template.components.length > 5) fail('O modo legado aceita até cinco linhas de botões.');
      if (template.embeds.length > 10) fail('Use no máximo 10 embeds.');
    } else if (template.content || template.embeds.length)
      fail('Components V2 não permite conteúdo ou embeds.');
    // Limits are checked again after expanding the catalog examples, as the bot will; emojis
    // take their longest form, <a:name:snowflake>.
    const emojis = [...JSON.stringify(template).matchAll(/\{emoji:([A-Za-z0-9_]{2,32})\}/g)].map(
      (match) => ({ id: '0'.repeat(20), name: match[1] ?? '', animated: true }),
    );
    render(template, createScope(template, exampleData(definition), definition, emojis), {
      strict: true,
    });
    return null;
  } catch (error) {
    if (error instanceof Invalid || error instanceof TemplateRenderError) return error.message;
    throw error;
  }
}
