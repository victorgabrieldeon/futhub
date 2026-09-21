const {
  DOKPLOY_API_URL,
  DOKPLOY_API_KEY,
  DOKPLOY_APPLICATION_ID,
  DOKPLOY_POSTGRES_ID,
  DOKPLOY_VARIABLES_JSON,
} = process.env;

if (!DOKPLOY_API_URL || !DOKPLOY_API_KEY || !DOKPLOY_APPLICATION_ID || !DOKPLOY_VARIABLES_JSON) {
  throw new Error('Missing Dokploy environment writer configuration.');
}

const variables = JSON.parse(DOKPLOY_VARIABLES_JSON);

if (DOKPLOY_POSTGRES_ID) {
  const databaseResponse = await fetch(
    `${DOKPLOY_API_URL.replace(/\/$/, '')}/postgres.one?postgresId=${encodeURIComponent(DOKPLOY_POSTGRES_ID)}`,
    { headers: { 'x-api-key': DOKPLOY_API_KEY } },
  );

  if (!databaseResponse.ok) {
    throw new Error(`Dokploy rejected database lookup (${databaseResponse.status}).`);
  }

  const database = await databaseResponse.json();
  if (!database.appName) throw new Error('Dokploy database response has no generated hostname.');

  variables.DATABASE_URL = variables.DATABASE_URL.replace(
    '__DOKPLOY_POSTGRES_HOST__',
    database.appName,
  );
}
const env = Object.entries(variables)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, value]) => {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name) || String(value).includes('\n')) {
      throw new Error(`Invalid environment variable: ${name}`);
    }
    return `${name}=${value}`;
  })
  .join('\n');

const response = await fetch(`${DOKPLOY_API_URL.replace(/\/$/, '')}/application.saveEnvironment`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': DOKPLOY_API_KEY,
  },
  body: JSON.stringify({
    applicationId: DOKPLOY_APPLICATION_ID,
    env,
    buildArgs: '',
    buildSecrets: '',
    createEnvFile: true,
  }),
});

if (!response.ok) {
  throw new Error(
    `Dokploy rejected environment update (${response.status}): ${await response.text()}`,
  );
}

console.info(`Updated environment for application ${DOKPLOY_APPLICATION_ID}.`);
