'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  GitBranch,
  Globe,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { externalContentIndexing } from '../../../actions/external-content-indexing';

export function ExternalContentTab() {
  const [urlInput, setUrlInput] = useState('');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubPath, setGithubPath] = useState('');
  const [localDirPath, setLocalDirPath] = useState('');
  const [isIndexing, setIsIndexing] = useState(false);
  const [results, setResults] = useState<{
    source: string;
    indexedCount: number;
    errors?: string[];
  } | null>(null);

  const handleIndexUrl = async () => {
    if (!urlInput.trim()) return;
    setIsIndexing(true);
    setResults(null);
    try {
      const result = await externalContentIndexing({
        source: 'url',
        sourceId: urlInput.trim(),
        userId: '',
      });
      if (result.success) {
        toast.success(`Indexed ${result.indexedCount ?? 0} chunks from URL`);
        setResults({
          source: 'URL',
          indexedCount: result.indexedCount ?? 0,
          errors: result.errors,
        });
      } else {
        toast.error(result.errors?.[0] ?? 'Failed to index URL');
        setResults({ source: 'URL', indexedCount: 0, errors: result.errors });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
      setResults({ source: 'URL', indexedCount: 0, errors: [message] });
    } finally {
      setIsIndexing(false);
    }
  };

  const handleIndexGitHub = async () => {
    if (!githubOwner.trim() || !githubRepo.trim()) return;
    setIsIndexing(true);
    setResults(null);
    try {
      const result = await externalContentIndexing({
        source: 'github',
        owner: githubOwner.trim(),
        repo: githubRepo.trim(),
        path: githubPath.trim(),
        userId: '',
      });
      if (result.success) {
        toast.success(`Indexed ${result.indexedCount ?? 0} chunks from GitHub`);
        setResults({
          source: 'GitHub',
          indexedCount: result.indexedCount ?? 0,
          errors: result.errors,
        });
      } else {
        toast.error(result.errors?.[0] ?? 'Failed to index GitHub repo');
        setResults({ source: 'GitHub', indexedCount: 0, errors: result.errors });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
      setResults({ source: 'GitHub', indexedCount: 0, errors: [message] });
    } finally {
      setIsIndexing(false);
    }
  };

  const handleIndexLocalDocs = async () => {
    if (!localDirPath.trim()) return;
    setIsIndexing(true);
    setResults(null);
    try {
      const result = await externalContentIndexing({
        source: 'local-docs',
        dirPath: localDirPath.trim(),
        userId: '',
      });
      if (result.success) {
        toast.success(`Indexed ${result.indexedCount ?? 0} chunks from local docs`);
        setResults({
          source: 'Local Docs',
          indexedCount: result.indexedCount ?? 0,
          errors: result.errors,
        });
      } else {
        toast.error(result.errors?.[0] ?? 'Failed to index local docs');
        setResults({ source: 'Local Docs', indexedCount: 0, errors: result.errors });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
      setResults({ source: 'Local Docs', indexedCount: 0, errors: [message] });
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-[var(--text-heading)] text-lg">External Content Indexer</h2>
        <p className="text-[var(--text-muted)] text-xs">
          Index external content (web URLs, GitHub repositories, local docs) into the semantic
          vector store for RAG-powered search.
        </p>
      </div>

      {results && (
        <GlassCard className="flex items-center gap-3 p-4">
          {results.errors && results.errors.length > 0 ? (
            <AlertCircle className="h-5 w-5 text-accent-red" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )}
          <div className="flex-1 text-sm">
            <span className="font-medium">{results.source}</span>: indexed{' '}
            <span className="font-mono">{results.indexedCount}</span> chunks
            {results.errors && results.errors.length > 0 && (
              <span className="ml-2 text-accent-red">
                ({results.errors.length} error{results.errors.length > 1 ? 's' : ''})
              </span>
            )}
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* URL Indexing */}
        <GlassCard className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2 border-[var(--border-default)] border-b pb-3">
            <Globe className="h-4 w-4 text-[var(--accent-blue)]" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">Web URL</h3>
          </div>
          <Input
            placeholder="https://example.com/docs/page"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="border-[var(--border-default)] bg-[var(--bg-primary)] text-xs"
          />
          <Button
            size="sm"
            disabled={isIndexing || !urlInput.trim()}
            onClick={handleIndexUrl}
            className="shrink-0 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
          >
            {isIndexing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
            )}
            Index URL
          </Button>
        </GlassCard>

        {/* GitHub Indexing */}
        <GlassCard className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2 border-[var(--border-default)] border-b pb-3">
            <GitBranch className="h-4 w-4 text-[var(--accent-blue)]" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">GitHub Repo</h3>
          </div>
          <Input
            placeholder="Owner (e.g. tim)"
            value={githubOwner}
            onChange={(e) => setGithubOwner(e.target.value)}
            className="border-[var(--border-default)] bg-[var(--bg-primary)] text-xs"
          />
          <Input
            placeholder="Repo name (e.g. Arch-System)"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            className="border-[var(--border-default)] bg-[var(--bg-primary)] text-xs"
          />
          <Input
            placeholder="Path filter (optional)"
            value={githubPath}
            onChange={(e) => setGithubPath(e.target.value)}
            className="border-[var(--border-default)] bg-[var(--bg-primary)] text-xs"
          />
          <Button
            size="sm"
            disabled={isIndexing || !githubOwner.trim() || !githubRepo.trim()}
            onClick={handleIndexGitHub}
            className="shrink-0 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
          >
            {isIndexing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitBranch className="mr-1 h-3.5 w-3.5" />
            )}
            Index Repo
          </Button>
        </GlassCard>

        {/* Local Docs Indexing */}
        <GlassCard className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2 border-[var(--border-default)] border-b pb-3">
            <FolderOpen className="h-4 w-4 text-[var(--accent-blue)]" />
            <h3 className="font-semibold text-[var(--text-heading)] text-sm">Local Docs</h3>
          </div>
          <Input
            placeholder="/path/to/docs/directory"
            value={localDirPath}
            onChange={(e) => setLocalDirPath(e.target.value)}
            className="border-[var(--border-default)] bg-[var(--bg-primary)] text-xs"
          />
          <Button
            size="sm"
            disabled={isIndexing || !localDirPath.trim()}
            onClick={handleIndexLocalDocs}
            className="shrink-0 bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
          >
            {isIndexing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderOpen className="mr-1 h-3.5 w-3.5" />
            )}
            Index Docs
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
