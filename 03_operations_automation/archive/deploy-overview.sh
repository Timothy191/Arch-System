#!/bin/bash

# Arch Systems Overview Visualizer Deployment Script
# This script builds and deploys the overview visualizer

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE} Arch Systems Overview Visualizer ${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is not installed${NC}"
    echo "Please install pnpm: npm install -g pnpm"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pnpm install
fi

# Function to start dev server
start_dev() {
    echo -e "${GREEN}Starting development server on http://localhost:3001${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    pnpm dev
}

# Function to build for production
build_static() {
    echo -e "${YELLOW}Building for static export...${NC}"
    pnpm build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Build successful!${NC}"
        echo -e "Static files exported to: ${BLUE}dist/${NC}"
    else
        echo -e "${RED}Build failed!${NC}"
        exit 1
    fi
}

# Function to serve built files
serve_static() {
    if [ ! -d "dist" ]; then
        echo -e "${YELLOW}No dist folder found. Building first...${NC}"
        build_static
    fi
    
    echo -e "${GREEN}Serving static files on http://localhost:3001${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    
    if command -v npx &> /dev/null; then
        npx serve dist -p 3001 -s
    else
        echo -e "${YELLOW}npx not available. Installing serve...${NC}"
        npm install -g serve
        serve dist -p 3001 -s
    fi
}

# Function to deploy to a custom location
deploy_to() {
    local target="$1"
    
    if [ -z "$target" ]; then
        echo -e "${RED}Error: Please specify a target directory${NC}"
        echo "Usage: ./deploy.sh deploy /path/to/target"
        exit 1
    fi
    
    if [ ! -d "dist" ]; then
        echo -e "${YELLOW}Building first...${NC}"
        build_static
    fi
    
    echo -e "${YELLOW}Copying files to $target...${NC}"
    mkdir -p "$target"
    cp -r dist/* "$target/"
    echo -e "${GREEN}Deployed to: $target${NC}"
}

# Parse command arguments
case "${1:-dev}" in
    dev|develop|development)
        start_dev
        ;;
    build)
        build_static
        ;;
    serve|start)
        serve_static
        ;;
    deploy)
        deploy_to "$2"
        ;;
    help|--help|-h)
        echo "Usage: ./deploy.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  dev      Start development server (default)"
        echo "  build    Build for static export"
        echo "  serve    Serve built static files"
        echo "  deploy   Copy dist to target directory"
        echo "  help     Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh              # Start dev server"
        echo "  ./deploy.sh dev          # Start dev server"
        echo "  ./deploy.sh build        # Build static files"
        echo "  ./deploy.sh serve        # Serve built files"
        echo "  ./deploy.sh deploy /var/www/overview  # Deploy to directory"
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Run './deploy.sh help' for usage information"
        exit 1
        ;;
esac
