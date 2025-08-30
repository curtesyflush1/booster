#!/bin/bash

# BoosterBeacon Deployment Status Script
# Quick status check for production deployment

# Configuration
DEPLOY_USER="${DEPLOY_USER:-derek}"
DEPLOY_HOST="${DEPLOY_HOST:-82.180.162.48}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 BoosterBeacon Production Status${NC}"
echo "=================================="

# Check if we can connect to the server
if ! ssh -o ConnectTimeout=5 "$DEPLOY_USER@$DEPLOY_HOST" "echo 'Connected'" &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to production server${NC}"
    exit 1
fi

# Get status from server
ssh "$DEPLOY_USER@$DEPLOY_HOST" << 'EOF'
cd /opt/booster 2>/dev/null || { echo -e "\033[0;31m❌ Deployment directory not found\033[0m"; exit 1; }

echo -e "\033[0;34m📊 Docker Services Status\033[0m"
echo "------------------------"
if docker-compose -f docker-compose.prod.yml ps 2>/dev/null; then
    echo ""
else
    echo -e "\033[0;31m❌ No services running\033[0m"
fi

echo -e "\033[0;34m🏥 Application Health\033[0m"
echo "-------------------"
health_response=$(curl -s http://localhost:3000/health 2>/dev/null)
if [[ $? -eq 0 ]]; then
    echo -e "\033[0;32m✅ Application is healthy\033[0m"
    echo "$health_response" | jq '.' 2>/dev/null || echo "$health_response"
else
    echo -e "\033[0;31m❌ Application health check failed\033[0m"
fi

echo ""
echo -e "\033[0;34m💾 System Resources\033[0m"
echo "-----------------"
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memory Usage: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
echo "Disk Usage: $(df -h /opt | awk 'NR==2{print $5}')"

echo ""
echo -e "\033[0;34m📝 Recent Activity\033[0m"
echo "----------------"
if [[ -f "logs/backend/combined.log" ]]; then
    echo "Last 3 log entries:"
    tail -3 logs/backend/combined.log 2>/dev/null || echo "No recent logs"
else
    echo "No log files found"
fi

echo ""
echo -e "\033[0;34m🔗 Service URLs\033[0m"
echo "-------------"
echo "Application: http://$(hostname -I | awk '{print $1}'):3000"
echo "Health Check: http://$(hostname -I | awk '{print $1}'):3000/health"
echo "Grafana: http://$(hostname -I | awk '{print $1}'):3001"
echo "Prometheus: http://$(hostname -I | awk '{print $1}'):9090"
EOF

echo ""
echo -e "${GREEN}✅ Status check completed${NC}"