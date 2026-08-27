os.putenv('PATH', os.getcwd() + '/bin:' + os.getenv('PATH'))
local('node scripts/ensure-dev-env.mjs')

docker_compose(
    ['docker-compose.yml', 'docker-compose.tilt.yml'],
    env_file='.env',
    profiles=['discord'],
    wait=True,
)

docker_build(
    'futhub-dev',
    '.',
    live_update=[
        sync('apps', '/app/apps'),
        sync('packages', '/app/packages'),
        sync('package.json', '/app/package.json'),
        sync('pnpm-lock.yaml', '/app/pnpm-lock.yaml'),
        sync('pnpm-workspace.yaml', '/app/pnpm-workspace.yaml'),
        sync('tsconfig.json', '/app/tsconfig.json'),
        sync('turbo.json', '/app/turbo.json'),
        run('pnpm --filter @futhub/database build', trigger=['packages/database/src']),
        run('pnpm --filter @futhub/api-client build', trigger=['packages/api-client/src']),
        run(
            'pnpm --filter @futhub/api build',
            trigger=['apps/api/src', 'packages/database/src'],
        ),
        run(
            'corepack enable && pnpm install --offline --no-frozen-lockfile',
            trigger=[
                'package.json',
                'pnpm-lock.yaml',
                'pnpm-workspace.yaml',
                'apps/admin/package.json',
                'apps/api/package.json',
                'apps/discord-bot/package.json',
                'packages/api-client/package.json',
                'packages/config/package.json',
                'packages/database/package.json',
            ],
        ),
    ],
)

dc_resource('postgres', labels=['infra'])
dc_resource('api', resource_deps=['postgres'], labels=['apps'])
dc_resource('admin', resource_deps=['api'], labels=['apps'])
dc_resource('discord-bot', auto_init=False, resource_deps=['api'], labels=['apps'])
