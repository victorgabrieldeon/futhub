import { configureApiClient, listPackCatalog } from '@futhub/api-client';
import type { PackCatalogItem } from '@futhub/api-client';
import { ActionRow, Button, ButtonStyle, Container, TextDisplay } from 'seyfert';

import { noMentions } from './responses.js';

const storeTabs = ['packs', 'contratar'] as const;
export type StoreTab = (typeof storeTabs)[number];

type ListPacks = () => Promise<readonly PackCatalogItem[]>;

export function isStoreTab(value: string): value is StoreTab {
  return (storeTabs as readonly string[]).includes(value);
}

export async function storeResponse(
  tab: StoreTab,
  listPacks: ListPacks = configuredListPacks,
) {
  const body =
    tab === 'packs'
      ? await packsBody(listPacks)
      : '## Contratar\nEscolha uma carta no mercado e use `/loja` com `carta_id`.';
  const tabs = new ActionRow<Button>().setComponents([
    new Button()
      .setCustomId('loja:packs')
      .setLabel('Packs')
      .setStyle(tab === 'packs' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new Button()
      .setCustomId('loja:contratar')
      .setLabel('Contratar')
      .setStyle(tab === 'contratar' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  ]);
  return {
    flags: 32768,
    components: [
      new Container()
        .setColor('#8b1d3d')
        .setComponents(new TextDisplay().setContent(body), tabs),
    ],
    allowedMentions: noMentions,
  };
}

async function configuredListPacks(): Promise<readonly PackCatalogItem[]> {
  const baseUrl = process.env.API_BASE_URL;
  const token = process.env.API_INTERNAL_TOKEN;
  if (!baseUrl || !token) throw new Error('Bot API configuration is missing.');
  configureApiClient({ baseUrl, token });
  return listPackCatalog();
}

async function packsBody(listPacks: ListPacks): Promise<string> {
  const packs = await listPacks();
  const rows = packs.map((pack) => `**${pack.name}** · ${pack.price} moedas · \`${pack.id}\``);
  return `## Loja\n${rows.join('\n') || 'Nenhum pack disponível.'}`;
}
