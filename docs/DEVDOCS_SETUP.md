# DevDocs MCP Server Setup

Tech documentation crawling MCP server for Windsurf/Cascade integration.

## Overview

DevDocs provides a completely free, private, UI-based documentation crawling service that can be integrated with Windsurf Cascade via MCP.

**Repository**: <https://github.com/cyberagiinc/DevDocs>  
**Local Path**: `/home/timothy/Project/Arch-Mk2/tools/devdocs`

## Features

- 🧠 **Intelligent Crawling** - Smart content extraction from tech docs
- ⚡ **Performance** - Async processing with caching
- 🎯 **Content Processing** - Markdown extraction, code block preservation
- 🛡️ **Enterprise Features** - Private, self-hosted, no external APIs

## Prerequisites

- Docker & Docker Compose
- 4GB+ RAM available for containers
- Ports 3001, 24125, 11235 available

## Quick Start

```bash
# Navigate to DevDocs directory
cd /home/timothy/Project/Arch-Mk2/tools/devdocs

# Configure environment
cp .env.template .env

# Edit .env to set:
# NEXT_PUBLIC_BACKEND_URL=http://localhost:24125

# Start services
./docker-start.sh
```

## Services

| Service     | URL                      | Description                        |
| ----------- | ------------------------ | ---------------------------------- |
| Frontend UI | <http://localhost:3001>  | Web interface for managing crawls  |
| Backend API | <http://localhost:24125> | REST API for documentation queries |
| Crawl4AI    | <http://localhost:11235> | Crawling service                   |

## MCP Integration

DevDocs is configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "devdocs": {
      "command": "docker",
      "args": ["exec", "-i", "devdocs-backend", "python", "-m", "mcp_server"],
      "env": {
        "DEVDOCS_URL": "http://localhost:24125"
      }
    }
  }
}
```

## Usage

1. **Start DevDocs**: Run `./docker-start.sh` in the devdocs directory
2. **Add Documentation**: Use the UI at <http://localhost:3001> to crawl docs
3. **Query in Cascade**: DevDocs MCP tools become available for querying documentation

## Available MCP Tools

- `search_docs` - Search crawled documentation
- `get_doc_content` - Retrieve specific documentation content
- `list_crawled_sites` - Show all indexed documentation sources

## Troubleshooting

### Containers won't start

```bash
docker-compose down
docker-compose up -d
```

### Reset all data

```bash
docker-compose down -v
rm -rf storage/* crawl_results/*
./docker-start.sh
```

### Check logs

```bash
docker logs devdocs-backend
docker logs devdocs-frontend
docker logs devdocs-crawl4ai
```

## Integration with Project

DevDocs complements `codebase-memory-mcp`:

- **codebase-memory-mcp**: Code intelligence, graph queries, architecture analysis
- **devdocs**: External documentation crawling (React docs, Supabase docs, etc.)

## Security Notes

- DevDocs runs locally - no data sent to external services
- crawled content stored in `tools/devdocs/storage/`
- Suitable for proprietary documentation

## Resources

- Main Repo: <https://github.com/cyberagiinc/DevDocs>
- Issues: <https://github.com/cyberagiinc/DevDocs/issues>
- Local Setup: `/home/timothy/Project/Arch-Mk2/tools/devdocs/`
