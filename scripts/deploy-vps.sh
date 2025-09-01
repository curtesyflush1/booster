#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-boosterbeacon.com}"
DEPLOY_HOST="${DEPLOY_HOST:-82.180.162.48}"
DEPLOY_USER="${DEPLOY_USER:-derek}"
APP_DIR="${APP_DIR:-/opt/booster}"
WEB_ROOT="${WEB_ROOT:-/var/www/boosterbeacon}"
SSL_DIR="${SSL_DIR:-/etc/ssl/boosterbeacon}"
PM2_APP_NAME="${PM2_APP_NAME:-booster-beacon-api}"

info() { echo -e "\033[0;34m[INFO]\033[0m $*"; }
ok()   { echo -e "\033[0;32m[OK]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[0;31m[ERR ]\033[0m $*"; }

sshx() { ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" "$@"; }
rsyncx() { rsync -az --delete "$@"; }

step_setup_server() {
  info "Installing system dependencies (Node, Nginx, unzip, PM2) ..."
  sshx 'sudo apt-get update && \
        sudo apt-get install -y ca-certificates curl gnupg unzip && \
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && \
        sudo apt-get install -y nodejs nginx && \
        sudo npm i -g pm2'

  ok "Base server setup complete"
}

step_push_build() {
  info "Building locally and syncing artifacts ..."
  pushd "$(dirname "$0")/.." >/dev/null
  npm ci
  npm run build
  popd >/dev/null

  rsyncx \
    --exclude node_modules \
    --exclude .git \
    -av ./ "$DEPLOY_USER@$DEPLOY_HOST:$APP_DIR/"

  ok "Artifacts synced to $APP_DIR"
}

step_ssl_setup() {
  info "Preparing SSL certs ..."
  sshx "sudo mkdir -p $SSL_DIR && sudo chown $DEPLOY_USER:$DEPLOY_USER $SSL_DIR"

  # Use existing bundle on server if present
  sshx "if [ -f $APP_DIR/boosterbeacon.com-ssl-bundle.zip ]; then \
           unzip -o $APP_DIR/boosterbeacon.com-ssl-bundle.zip -d $SSL_DIR >/dev/null 2>&1 || true; \
         fi"

  # Attempt to normalize filenames to fullchain.pem/privkey.pem if obvious matches exist
  sshx "cd $SSL_DIR && \
        CERT=\$(ls *fullchain*.pem *certificate*.pem *crt 2>/dev/null | head -n1 || true) && \
        KEY=\$(ls *privkey*.pem *private*.key *key 2>/dev/null | head -n1 || true) && \
        if [ -n \"\$CERT\" ] && [ -n \"\$KEY\" ]; then \
          sudo cp -f \"$SSL_DIR/\$CERT\" $SSL_DIR/fullchain.pem; \
          sudo cp -f \"$SSL_DIR/\$KEY\" $SSL_DIR/privkey.pem; \
        fi"

  ok "SSL bundle prepared (ensure fullchain.pem and privkey.pem exist in $SSL_DIR)"
}

step_nginx() {
  info "Configuring Nginx for $DOMAIN ..."
  # Push server block template
  rsyncx nginx/boosterbeacon.conf "$DEPLOY_USER@$DEPLOY_HOST:/tmp/boosterbeacon.conf"

  sshx "sudo mv /tmp/boosterbeacon.conf /etc/nginx/sites-available/boosterbeacon.conf && \
        sudo sed -i 's#/etc/ssl/boosterbeacon#${SSL_DIR}#g' /etc/nginx/sites-available/boosterbeacon.conf && \
        sudo ln -sf /etc/nginx/sites-available/boosterbeacon.conf /etc/nginx/sites-enabled/boosterbeacon.conf && \
        sudo mkdir -p $WEB_ROOT && \
        sudo systemctl enable nginx && \
        sudo nginx -t && \
        sudo systemctl restart nginx"
  ok "Nginx configured and restarted"
}

step_frontend() {
  info "Deploying frontend to $WEB_ROOT ..."
  rsyncx -av frontend/dist/ "$DEPLOY_USER@$DEPLOY_HOST:$WEB_ROOT/"
  sshx "sudo chown -R www-data:www-data $WEB_ROOT"
  ok "Frontend deployed"
}

step_backend_pm2() {
  info "Starting backend via PM2 ..."
  sshx "cd $APP_DIR && \
        cp -n .env.production .env 2>/dev/null || true && \
        cd backend && npm ci && npm run build && \
        if [ -f ./data/products.csv ]; then npm run import:products || true; fi && \
        pm2 start ../ecosystem.pm2.config.js --only booster-beacon-api || pm2 start dist/index.js --name $PM2_APP_NAME && \
        pm2 save"
  ok "Backend started with PM2"
}

step_health() {
  info "Checking health endpoint ..."
  sshx "curl -fsS http://127.0.0.1:3000/health || curl -fsS http://127.0.0.1:3000/api/v1/status"
  ok "Health OK"
}

usage() {
  cat <<USAGE
Usage: $0 [setup|deploy|nginx|frontend|backend|health|all]
  setup     Install system deps (Node, Nginx, PM2)
  deploy    Build locally, sync repo to server
  nginx     Install Nginx server block and restart
  frontend  Sync frontend dist to web root
  backend   Install and start backend via PM2
  health    Check API health
  all       setup + deploy + ssl + nginx + frontend + backend + health
USAGE
}

case "${1:-all}" in
  setup) step_setup_server ;;
  deploy) step_push_build ;;
  ssl) step_ssl_setup ;;
  nginx) step_nginx ;;
  frontend) step_frontend ;;
  backend) step_backend_pm2 ;;
  health) step_health ;;
  all)
    step_setup_server
    step_push_build
    step_ssl_setup
    step_nginx
    step_frontend
    step_backend_pm2
    step_health
    ;;
  *) usage; exit 1 ;;
esac
