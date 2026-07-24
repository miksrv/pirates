module.exports = {
    apps: [
        {
            name: 'pirates',
            script: 'serve',
            args: '-s dist -l 3010',
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
}
