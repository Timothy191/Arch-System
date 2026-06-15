#!/usr/bin/env python3
"""
Vector memory for LTM - semantic search over project memory.
Uses sklearn TF-IDF by default (instant, no model download).
Auto-detects sentence-transformers for true semantic search if available.
"""
import json
import os
import sys
import hashlib
import re

LTM_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'store')
EVENTS_FILE = os.path.join(LTM_DIR, 'events.jsonl')
VECTORS_FILE = os.path.join(LTM_DIR, 'vectors.jsonl')
CHECKPOINTS_FILE = os.path.join(LTM_DIR, 'checkpoints.jsonl')
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.json')

HAS_SENTENCE = False
HAS_SKLEARN = False
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    HAS_SKLEARN = True
except ImportError:
    pass

try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE = True
except ImportError:
    pass

def read_jsonl(path):
    records = []
    if not os.path.exists(path):
        return records
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return records

def write_jsonl(path, records):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        for r in records:
            f.write(json.dumps(r) + '\n')

def extract_text(record):
    parts = []
    for key in ['summary', 'content', 'message', 'description', 'text', 'reason']:
        val = record.get(key)
        if val and isinstance(val, str):
            parts.append(val)
    for key in ['changed_files', 'decisions', 'next_actions']:
        val = record.get(key)
        if val and isinstance(val, list):
            parts.extend([str(v) for v in val])
    return ' '.join(parts)

def get_all_documents():
    docs = []
    sources = []

    for record in read_jsonl(EVENTS_FILE):
        text = extract_text(record)
        if text.strip():
            docs.append(text)
            sources.append(('event', record))

    for record in read_jsonl(CHECKPOINTS_FILE):
        text = extract_text(record)
        if text.strip():
            docs.append(text)
            sources.append(('checkpoint', record))

    return docs, sources

def build_tfidf_index(docs):
    vectorizer = TfidfVectorizer(
        max_features=5000,
        stop_words='english',
        ngram_range=(1, 2),
        sublinear_tf=True
    )
    matrix = vectorizer.fit_transform(docs)
    return vectorizer, matrix

def search_tfidf(query, vectorizer, matrix, k=5):
    query_vec = vectorizer.transform([query])
    scores = cosine_similarity(query_vec, matrix).flatten()
    top_indices = scores.argsort()[-k:][::-1]
    results = []
    for idx in top_indices:
        if scores[idx] > 0:
            results.append({'score': float(scores[idx]), 'index': int(idx)})
    return results

def search_sentence(query, model, docs, k=5):
    query_emb = model.encode([query])
    doc_embs = model.encode(docs)
    scores = cosine_similarity(query_emb, doc_embs).flatten()
    top_indices = scores.argsort()[-k:][::-1]
    results = []
    for idx in top_indices:
        if scores[idx] > 0:
            results.append({'score': float(scores[idx]), 'index': int(idx)})
    return results

def cmd_index():
    docs, sources = get_all_documents()
    counts = {}
    for stype, _ in sources:
        counts[stype] = counts.get(stype, 0) + 1

    if not docs:
        print(json.dumps({"status": "ok", "indexed": 0, "source_counts": counts}))
        return

    if HAS_SENTENCE:
        model = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
        embs = model.encode(docs, show_progress_bar=False)
        records = []
        for i, (emb, (stype, src)) in enumerate(zip(embs, sources)):
            record = {
                "id": f"vec_{hashlib.md5(json.dumps(src, sort_keys=True).encode()).hexdigest()[:12]}",
                "type": stype,
                "source_index": i,
                "embedding": emb.tolist(),
                "text": docs[i][:200],
                "model": "all-MiniLM-L6-v2"
            }
            records.append(record)
        write_jsonl(VECTORS_FILE, records)

    # Always save text index for TF-IDF fallback
    index_data = {
        "version": 2,
        "total_docs": len(docs),
        "source_counts": counts,
        "method": HAS_SENTENCE and "sentence-transformers" or "tfidf",
        "documents": docs
    }
    with open(os.path.join(LTM_DIR, 'text_index.json'), 'w') as f:
        json.dump(index_data, f)

    result = {"status": "ok", "indexed": len(docs), "method": index_data["method"], "source_counts": counts}
    print(json.dumps(result))

def cmd_search(query, k=5):
    if not query:
        print(json.dumps({"error": "No query provided", "results": []}))
        return

    # Try loading pre-indexed text
    text_index_path = os.path.join(LTM_DIR, 'text_index.json')
    if os.path.exists(text_index_path):
        with open(text_index_path) as f:
            index_data = json.load(f)
        docs = index_data.get("documents", [])

        if HAS_SENTENCE and index_data.get("method") == "sentence-transformers" and os.path.exists(VECTORS_FILE):
            vectors = read_jsonl(VECTORS_FILE)
            model = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
            query_emb = model.encode([query])
            results = []
            for v in vectors:
                vec = np.array(v["embedding"])
                score = float(cosine_similarity(query_emb, [vec]).flatten()[0])
                if score > 0.1:
                    results.append({"score": score, "text": v["text"][:200], "type": v["type"]})
            results.sort(key=lambda x: -x["score"])
            results = results[:k]
        elif HAS_SKLEARN:
            vectorizer, matrix = build_tfidf_index(docs)
            matches = search_tfidf(query, vectorizer, matrix, k)
            results = []
            for m in matches:
                results.append({
                    "score": m["score"],
                    "text": docs[m["index"]][:200],
                    "index": m["index"]
                })
        else:
            # Fallback: simple keyword matching
            results = []
            terms = query.lower().split()
            for i, doc in enumerate(docs):
                doc_lower = doc.lower()
                score = sum(1 for t in terms if t in doc_lower) / len(terms)
                if score > 0:
                    results.append({"score": score, "text": doc[:200], "index": i})
            results.sort(key=lambda x: -x["score"])
            results = results[:k]
    else:
        results = []

    print(json.dumps({"query": query, "results": results, "count": len(results)}))

def cmd_status():
    events = len(read_jsonl(EVENTS_FILE))
    checkpoints = len(read_jsonl(CHECKPOINTS_FILE))
    vectors = len(read_jsonl(VECTORS_FILE))
    has_text_index = os.path.exists(os.path.join(LTM_DIR, 'text_index.json'))
    method = "sentence-transformers" if HAS_SENTENCE else ("tf-idf" if HAS_SKLEARN else "keyword")
    print(json.dumps({
        "events": events,
        "checkpoints": checkpoints,
        "vectors_indexed": vectors,
        "text_index_exists": has_text_index,
        "method": method,
        "has_sentence_transformers": HAS_SENTENCE,
        "has_sklearn": HAS_SKLEARN
    }))

def cmd_health():
    errors = []
    if not os.path.exists(EVENTS_FILE):
        errors.append("events.jsonl not found")
    if not HAS_SKLEARN and not HAS_SENTENCE:
        errors.append("No ML backend available (install sklearn or sentence-transformers)")
    status = "healthy" if not errors else "degraded"
    print(json.dumps({"status": status, "errors": errors, "has_sklearn": HAS_SKLEARN, "has_sentence": HAS_SENTENCE}))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: vector.py <index|search|status|health> [args...]"}))
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == 'index':
        cmd_index()
    elif cmd == 'search':
        query = ' '.join(sys.argv[2:]) if len(sys.argv) > 2 else ''
        k = 5
        if '--top-k' in sys.argv:
            idx = sys.argv.index('--top-k')
            if idx + 1 < len(sys.argv):
                try:
                    k = int(sys.argv[idx + 1])
                except ValueError:
                    pass
        cmd_search(query, k)
    elif cmd == 'status':
        cmd_status()
    elif cmd == 'health':
        cmd_health()
    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))
        sys.exit(1)
