#!/bin/bash

# GAUGE Docker Setup Script
# This script sets up and runs the GAUGE pharmaceutical traceability system using Docker

set -e

echo "🚀 Starting GAUGE Pharmaceutical Traceability System with Docker"
echo "=================================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating environment file from Docker template..."
    cp .env.docker .env
fi

# Build the Docker images
echo "🔨 Building Docker images..."
docker-compose build

# Start the services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose exec -T api npx prisma migrate deploy

# Seed the database
echo "🌱 Seeding database with initial data..."
docker-compose exec -T api npx prisma db seed

echo ""
echo "✅ GAUGE System is now running!"
echo "================================"
echo ""
echo "🌐 Web Interface: http://localhost:3000/pwa/drug-extractor.html"
echo "🔧 API Health: http://localhost:3000/health"
echo "🐍 Python Service: http://localhost:8000/health"
echo ""
echo "👤 Login Credentials:"
echo "   Email: admin@gauge.com"
echo "   Password: admin123"
echo ""
echo "📊 Management Commands:"
echo "   View logs: npm run docker:logs"
echo "   Stop services: npm run docker:down"
echo "   Restart: npm run docker:down && npm run docker:up"
echo ""

# Show service status
echo "📋 Service Status:"
docker-compose ps