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
        run(
            'corepack enable && pnpm install --frozen-lockfile',
            trigger=['apps/admin/package.json', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'],
        ),
        run(
            'pnpm --filter @futhub/database db:migrate',
            trigger=['packages/database/drizzle'],
        ),
    ],
)

dc_resource('postgres', labels=['infra'])
dc_resource('api', resource_deps=['postgres'], labels=['apps'])
dc_resource('admin', resource_deps=['api'], labels=['apps'])
dc_resource('discord-bot', auto_init=False, resource_deps=['api'], labels=['apps'])
