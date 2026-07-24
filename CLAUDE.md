# Deployment

Auto-deploy via GitHub Actions (`.github/workflows/deploy.yml`) is temporarily
disabled (switched to `workflow_dispatch`) — the private SSH key is
password-protected, and the server's firewall only allows SSH from trusted
IPs, so GitHub Actions runners can't connect.

When the user asks to deploy the project — perform the deploy manually from
the user's local machine (its IP is already allowlisted on the server, and
the key doesn't need to be passwordless since it's entered locally):

1. Build the project:
   ```
   npm run build
   ```
2. Upload `dist/` and `ecosystem.config.js` to the server:
   ```
   rsync -avz --delete \
     -e "ssh -i ~/.ssh/sonarqube.pl.bugfocus.com" \
     dist ecosystem.config.js \
     mikhail.topchilo@164.92.90.168:/home/mikhail.topchilo/apps/pirates/
   ```
3. Restart pm2 on the server:
   ```
   ssh -i ~/.ssh/sonarqube.pl.bugfocus.com mikhail.topchilo@164.92.90.168 \
     "cd /home/mikhail.topchilo/apps/pirates && pm2 startOrReload ecosystem.config.js --update-env && pm2 save"
   ```

Deploy path on the server: `/home/mikhail.topchilo/apps/pirates`.
PM2 process name: `pirates` (see `ecosystem.config.js`), serves `dist/` via
`serve` on port 3010.

Before the first run on the server, `serve` must be installed globally:
`npm i -g serve`.
