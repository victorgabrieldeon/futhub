import { ComponentCommand } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { isStoreTab, storeResponse } from '../store.js';

export default class LojaTabComponent extends ComponentCommand {
  componentType = 'Button' as const;

  filter(context: ComponentContext<'Button'>): boolean {
    return context.customId.startsWith('loja:') && isStoreTab(context.customId.slice(5));
  }

  async run(context: ComponentContext<'Button'>): Promise<void> {
    const tab = context.customId.slice(5);
    if (!isStoreTab(tab)) return;
    await context.update(await storeResponse(tab));
  }
}
