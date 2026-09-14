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

const client = new Client({ commands: { prefix: () => ['!'] } });
await client.start();
await client.uploadCommands();
