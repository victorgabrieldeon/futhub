import { configureApiClient } from '@futhub/api-client';
import { Client } from 'seyfert';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

configureApiClient({
  baseUrl: required('API_BASE_URL'),
  token: required('API_INTERNAL_TOKEN'),
});

const RETRY_DELAY_MS = 5_000;

async function retry(operation: () => Promise<unknown>, description: string): Promise<void> {
  for (;;) {
    try {
      await operation();
      return;
    } catch (error) {
      console.error(`${description} Retrying in ${RETRY_DELAY_MS / 1_000}s.`, error);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

const client = new Client({ commands: { prefix: () => ['!'] } });
await retry(() => client.start(), 'Failed to connect to Discord.');
await retry(() => client.uploadCommands(), 'Failed to upload Discord commands.');
