import os
import glob
import yaml

def parse_md_frontmatter(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            try:
                fm = yaml.safe_load(parts[1])
                return fm if fm else {}
            except Exception:
                return {}
    return {}

roots = ['/home/timothy/Projects/Arch-System/.agents']
files = glob.glob('/home/timothy/Projects/Arch-System/.agents/**/*.md', recursive=True)
for path in files:
    if 'references/' in path or 'assets/' in path or 'storage/' in path:
        continue
    fm = parse_md_frontmatter(path)
    size = os.path.getsize(path)
    rel_path = path.replace('/home/timothy/Projects/Arch-System/.agents/', '')
    name = fm.get('name', 'N/A')
    desc = fm.get('description', 'N/A')
    print(f"{rel_path} | Size: {size} | Name: {name} | Desc: {desc[:60]}...")
