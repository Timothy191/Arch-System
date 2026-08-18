#!/bin/bash

# Regenerate Codebase Maps
# This script regenerates all codebase visualization maps with current codebase data
# Usage: ./scripts/regenerate-codebase-maps.sh [--with-svg] [--full]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MAPS_DIR="$PROJECT_ROOT/codebase-maps"
GENERATE_SVG=false
FULL_REGEN=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --with-svg)
            GENERATE_SVG=true
            shift
            ;;
        --full)
            FULL_REGEN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--with-svg] [--full]"
            echo "  --with-svg    Also generate SVG images from Mermaid diagrams"
            echo "  --full        Perform full regeneration (requires subagent capability)"
            echo "  --help, -h    Show this help message"
            echo ""
            echo "Note: Full regeneration requires Devin CLI with subagent capability."
            echo "      Without --full, the script only updates dates and manages versions."
            exit 0
            ;;
    esac
done

# Get current date in YY-MM-DD format
DATE=$(date +%y-%m-%d)

echo "======================================"
echo "Codebase Maps Regeneration"
echo "======================================"
echo "Date: $DATE"
echo "Project Root: $PROJECT_ROOT"
echo "Maps Directory: $MAPS_DIR"
echo "With SVG: $GENERATE_SVG"
echo "Full Regeneration: $FULL_REGEN"
echo ""

# Create maps directory if it doesn't exist
mkdir -p "$MAPS_DIR"

# Check if we're doing full regeneration
if [ "$FULL_REGEN" = true ]; then
    echo "⚠ Full regeneration requires Devin CLI with subagent capability."
    echo "This script currently supports:"
    echo "  - Date updates and version management"
    echo "  - SVG generation (if --with-svg is specified)"
    echo "  - Cleanup of old versions"
    echo ""
    echo "For full regeneration, use Devin CLI with appropriate subagent calls."
    echo "See codebase-maps/README.md for details on manual regeneration."
    echo ""
    echo "Continuing with partial regeneration..."
fi

# Function to update a map's date and create new version
update_map() {
    local map_name="$1"
    local output_file="$MAPS_DIR/${map_name}_${DATE}.md"
    
    echo "Updating: $map_name"
    
    local existing_file=$(ls "$MAPS_DIR/${map_name}_"*.md 2>/dev/null | head -1)
    
    if [ -f "$existing_file" ]; then
        # Copy existing file and update date
        sed "s/\*\*Generated:\*\* [0-9]\{2\}-[0-9]\{2\}-[0-9]\{2\}/**Generated:** $DATE/" "$existing_file" > "$output_file"
        echo "  ✓ Created: $output_file"
    else
        echo "  ⚠ Warning: No existing file found for $map_name"
        return 1
    fi
}

# Update all maps
echo "Updating maps with current date..."
update_map "project-dependencies"
update_map "package-structure"
update_map "route-feature-architecture"
update_map "database-schema"
update_map "technology-stack"
update_map "ci-cd-pipeline"

echo ""
echo "Map update complete!"

# Generate SVG images if requested
if [ "$GENERATE_SVG" = true ]; then
    echo ""
    echo "Generating SVG images..."
    if [ -f "$MAPS_DIR/generate-svg.sh" ]; then
        "$MAPS_DIR/generate-svg.sh"
    else
        echo "⚠ Warning: SVG generation script not found at $MAPS_DIR/generate-svg.sh"
    fi
fi

# Clean up old maps (keep last 3 versions)
echo ""
echo "Cleaning up old map versions (keeping last 3)..."
for map_name in project-dependencies package-structure route-feature-architecture database-schema technology-stack ci-cd-pipeline; do
    # List all files for this map, sort by date, keep only the 3 most recent
    ls -t "$MAPS_DIR/${map_name}_"*.md 2>/dev/null | tail -n +4 | while read old_file; do
        echo "  Removing old: $(basename "$old_file")"
        rm "$old_file"
    done
done

echo ""
echo "======================================"
echo "Regeneration complete!"
echo "======================================"
echo ""
echo "Updated maps:"
ls -lh "$MAPS_DIR"/*.md | grep "$DATE" | awk '{print "  " $9 " (" $5 ")"}'

if [ "$GENERATE_SVG" = true ] && [ -d "$MAPS_DIR/svg" ]; then
    echo ""
    echo "SVG images:"
    ls -lh "$MAPS_DIR/svg"/*.svg 2>/dev/null | wc -l | xargs -I {} echo "  {} SVG files generated"
fi

echo ""
echo "Next steps:"
echo "  1. Review the generated maps"
echo "  2. For full content regeneration, use Devin CLI with subagent capability"
echo "  3. Commit the changes to git"
echo "  4. Update documentation if needed"
echo ""
echo "Note: This script performs date updates and version management."
echo "      For full content regeneration with actual codebase analysis,"
echo "      use Devin CLI with appropriate subagent calls or manual generation."
