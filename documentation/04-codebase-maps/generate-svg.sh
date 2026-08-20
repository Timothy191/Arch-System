#!/bin/bash

# Generate SVG images from Mermaid diagrams in codebase maps
# This script extracts Mermaid code blocks from markdown files and converts them to SVG
# Requires: @mermaid-js/mermaid-cli with puppeteer

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SVG_DIR="$SCRIPT_DIR/svg"
MD_DIR="$SCRIPT_DIR"

# Check if mmdc is available
if ! command -v mmdc &> /dev/null; then
    echo "Mermaid CLI (mmdc) not found. Skipping SVG generation."
    echo "To install: npm install -g @mermaid-js/mermaid-cli puppeteer"
    echo "The markdown files will still contain Mermaid diagrams that render in GitHub/GitLab."
    exit 0
fi

# Create SVG directory if it doesn't exist
mkdir -p "$SVG_DIR"

# Process all markdown files in the directory
for md_file in "$MD_DIR"/*.md; do
    filename=$(basename "$md_file" .md)
    
    # Skip README
    if [ "$filename" = "README" ]; then
        continue
    fi
    
    echo "Processing: $filename"
    
    # Extract mermaid blocks and convert to SVG
    awk -v svg_dir="$SVG_DIR" -v filename="$filename" '
        BEGIN { 
            in_mermaid=0 
            diagram_num=0
            content=""
        }
        /^```mermaid/ { 
            in_mermaid=1
            diagram_num++
            next 
        }
        /^```/ && in_mermaid { 
            in_mermaid=0
            # Write the mermaid content to a temp file
            if (content != "") {
                mmd_file = svg_dir "/" filename "_diagram_" diagram_num ".mmd"
                print content > mmd_file
                close(mmd_file)
                content=""
            }
            next 
        }
        in_mermaid { 
            if (content == "") {
                content = $0
            } else {
                content = content "\n" $0
            }
        }
    ' "$md_file"
done

# Convert all .mmd files to SVG
echo "Converting Mermaid files to SVG..."
mmd_count=0
for mmd_file in "$SVG_DIR"/*.mmd; do
    if [ -f "$mmd_file" ]; then
        svg_file="${mmd_file%.mmd}.svg"
        echo "Converting: $(basename "$mmd_file") -> $(basename "$svg_file")"
        if mmdc -i "$mmd_file" -o "$svg_file" -t neutral -b transparent 2>/dev/null; then
            mmd_count=$((mmd_count + 1))
        else
            echo "  Warning: Failed to convert $(basename "$mmd_file")"
        fi
    fi
done

# Clean up temporary .mmd files
echo "Cleaning up temporary files..."
rm -f "$SVG_DIR"/*.mmd

echo "SVG generation complete! Generated $mmd_count SVGs in: $SVG_DIR"
if [ $mmd_count -gt 0 ]; then
    ls -lh "$SVG_DIR"
else
    echo "No SVGs were generated. The markdown files still contain Mermaid diagrams."
fi
