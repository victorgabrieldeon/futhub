import type { BotResponseTemplateDto } from '@futhub/api-client';
import { expect, it } from 'vitest';
import { createResponseDrafts } from './helpers';

const original: BotResponseTemplateDto = {
  mode: 'legacy',
  content: 'Saved',
  embeds: [],
  components: [],
};
const edited = { ...original, content: 'Draft' };
const describeError = (cause: unknown) => String(cause);

it('retains keyed templates and baselines across editor unsubscribe/remount until explicit discard', () => {
  const drafts = createResponseDrafts();
  let notifications = 0;
  const unmount = drafts.subscribe(() => notifications++);
  drafts.load('lucro.success', original);
  drafts.load('pack.shop', { ...original, content: 'Shop' });
  drafts.edit('lucro.success', edited);
  unmount();
  expect(drafts.get('lucro.success')?.template).toEqual(edited);
  expect(drafts.get('lucro.success')?.baseline).toBe(JSON.stringify(original));
  expect(drafts.get('pack.shop')?.template.content).toBe('Shop');
  expect(drafts.hasUnsaved()).toBe(true);
  const remount = drafts.subscribe(() => notifications++);
  drafts.discard('pack.shop');
  expect(drafts.get('lucro.success')?.template).toEqual(edited);
  drafts.discard('lucro.success');
  expect(drafts.hasUnsaved()).toBe(false);
  expect(notifications).toBe(5);
  remount();
});

it('keeps pending saves across unmount, blocks duplicates and updates the restored baseline', async () => {
  const drafts = createResponseDrafts();
  drafts.load('lucro.success', original);
  drafts.edit('lucro.success', edited);
  let complete!: (template: BotResponseTemplateDto) => void;
  let calls = 0;
  const persist = () => {
    calls++;
    return new Promise<BotResponseTemplateDto>((resolve) => {
      complete = resolve;
    });
  };
  const unmount = drafts.subscribe(() => undefined);
  const saving = drafts.save('lucro.success', persist, describeError);
  unmount();
  expect(drafts.get('lucro.success')?.pending).toBe(true);
  expect(drafts.hasUnsaved()).toBe(true);
  await drafts.save('lucro.success', persist, describeError);
  drafts.edit('lucro.success', original);
  expect(calls).toBe(1);
  expect(drafts.get('lucro.success')?.template).toEqual(edited);
  complete(edited);
  await saving;
  expect(drafts.get('lucro.success')?.baseline).toBe(JSON.stringify(edited));
  expect(drafts.get('lucro.success')?.pending).toBe(false);
  expect(drafts.hasUnsaved()).toBe(false);
});

it('preserves failed saves and ignores completions after logout or replacement', async () => {
  const drafts = createResponseDrafts();
  drafts.load('lucro.success', original);
  drafts.edit('lucro.success', edited);
  await drafts.save(
    'lucro.success',
    async () => {
      throw new Error('Offline');
    },
    describeError,
  );
  expect(drafts.get('lucro.success')?.error).toContain('Offline');
  expect(drafts.get('lucro.success')?.template).toEqual(edited);
  expect(drafts.get('lucro.success')?.baseline).toBe(JSON.stringify(original));
  for (const fails of [false, true]) {
    let complete!: () => void;
    const pending = new Promise<BotResponseTemplateDto>((resolve, reject) => {
      complete = () => (fails ? reject(new Error('Expired session')) : resolve(edited));
    });
    let errorsReported = 0;
    const saving = drafts.save(
      'lucro.success',
      () => pending,
      () => {
        errorsReported++;
        return 'Old session';
      },
    );
    drafts.clear();
    expect(drafts.hasUnsaved()).toBe(false);
    expect(drafts.get('lucro.success')).toBeUndefined();
    drafts.load('lucro.success', original);
    const nextSession = createResponseDrafts();
    expect(nextSession.get('lucro.success')).toBeUndefined();
    complete();
    await saving;
    expect(drafts.get('lucro.success')?.template).toEqual(original);
    expect(errorsReported).toBe(0);
  }
});
