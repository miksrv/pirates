module.exports = {
    apps: [
        {
            name: 'pirates-client',
            script: 'serve',
            args: ['-s', 'dist', '-l', '3010'],
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'pirates-server',
            script: 'node_modules/.bin/tsx',
            args: 'server/index.ts',
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production',
                PORT: 8081
            }
        }
    ]
}
