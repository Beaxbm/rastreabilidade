# 🐳 GAUGE Docker Setup Guide

## Why Docker is Better for This System

**Current Issues Solved by Docker:**
- ✅ **Python Dependencies**: No more OpenCV/NumPy conflicts
- ✅ **Tesseract OCR**: Pre-installed and configured
- ✅ **Service Management**: All services start together
- ✅ **Environment Consistency**: Same setup everywhere
- ✅ **Database Setup**: PostgreSQL configured automatically
- ✅ **Port Conflicts**: Isolated networking
- ✅ **Easy Deployment**: One command setup

## 🚀 Quick Start with Docker

### Prerequisites
- Docker Desktop installed
- Docker Compose available

### 1. One-Command Setup
```bash
./start-docker.sh
```

### 2. Manual Setup (Alternative)
```bash
# Build and start all services
npm run docker:build
npm run docker:up

# Run database migrations and seeding
npm run docker:migrate
npm run docker:seed
```

## 🔧 Docker Services

### Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Node.js API   │    │  Python OCR     │
│   (Browser)     │────│   Port 3000     │────│   Port 8000     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   Port 5432     │
                       └─────────────────┘
```

### Services Included
- **gauge-api**: Node.js API with authentication and file handling
- **gauge-python**: Python OCR service with Tesseract
- **gauge-postgres**: PostgreSQL database with migrations
- **gauge-redis**: Redis for caching (optional)

## 📱 Access Points

- **Web Interface**: http://localhost:3000/pwa/drug-extractor.html
- **API Health**: http://localhost:3000/health
- **Python Health**: http://localhost:8000/health
- **Database**: localhost:5432 (gauge_user/gauge_password)

## 🎯 Usage

### Login Credentials
- **Email**: admin@gauge.com
- **Password**: admin123

### Workflow
1. **Login** → Upload drug image → **Extract** → View QR code
2. All data automatically saved to PostgreSQL
3. Complete audit trail maintained

## 🛠️ Management Commands

```bash
# View real-time logs
npm run docker:logs

# Stop all services
npm run docker:down

# Restart everything
npm run docker:down && npm run docker:up

# Access database
docker-compose exec postgres psql -U gauge_user -d gauge_trace_db

# Access API container
docker-compose exec api bash

# Access Python service container
docker-compose exec python-service bash
```

## 🔒 Production Deployment

### Environment Variables
Update `.env.docker` for production:
```bash
JWT_SECRET=your-super-secure-secret-key
POSTGRES_PASSWORD=secure-database-password
NODE_ENV=production
```

### SSL/HTTPS Setup
Add nginx reverse proxy:
```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
    - ./ssl:/etc/ssl
```

## 🐛 Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check what's using ports
lsof -i :3000
lsof -i :8000
lsof -i :5432

# Stop conflicting services
npm run docker:down
```

**Database issues:**
```bash
# Reset database
docker-compose down -v
docker-compose up -d
npm run docker:migrate
npm run docker:seed
```

**Image rebuild:**
```bash
# Force rebuild all images
docker-compose build --no-cache
```

## 📊 Benefits Over Local Setup

| Aspect | Local Setup | Docker Setup |
|--------|-------------|--------------|
| **Setup Time** | 30+ minutes | 5 minutes |
| **Dependencies** | Manual install | Automatic |
| **Consistency** | Environment varies | Always same |
| **Debugging** | Complex paths | Isolated services |
| **Deployment** | Manual config | One command |
| **Scaling** | Difficult | Easy horizontal scaling |

## 🎉 Ready to Deploy!

Your pharmaceutical traceability system is now production-ready with:
- ✅ Automatic QR code generation from drug images
- ✅ Complete audit trail and database
- ✅ Secure authentication and authorization
- ✅ Professional-grade containerization
- ✅ Health monitoring and logging
- ✅ Easy backup and restore capabilities