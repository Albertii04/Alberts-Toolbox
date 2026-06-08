/**
 * Resolved catalog — the runtime-facing catalog the shell actually fetches.
 *
 * The authoring catalog (registry/index.json) keeps `native` apps thin: a
 * GitHub `source` (repo + asset patterns) instead of pinned versions/URLs. A
 * resolver (a scheduled job using the GitHub API) expands every entry into the
 * shape below — concrete version, per-platform downloads, release notes,
 * screenshots and metrics — and publishes it as `resolved.json`. The shell
 * reads that static file: always fresh, no API rate limits, no token in the app.
 */
import type { AppKind, AppMetrics, Downloads, Installers } from './manifest.js';

/**
 * The published resolved catalog the resolver writes to the `catalog-data`
 * branch. Single source of truth — fetched by both the desktop app and the web
 * preview.
 */
export const RESOLVED_CATALOG_URL =
  'https://raw.githubusercontent.com/Albertii04/open-app-store/catalog-data/registry/resolved.json';

/** One app as the shell consumes it — every dynamic field already resolved. */
export interface ResolvedApp {
  id: string;
  kind: AppKind;
  name: string;
  description?: string;
  author?: string;
  icon?: string;
  /** Storefront category, e.g. "Creativity", "Productivity", "Developer". */
  category?: string;
  /** Paid products this app is an open alternative to. */
  replaces?: string[];
  /** Resolved version (release tag for github sources, manifest version otherwise). */
  version: string;
  /** Resolved per-platform downloads — the same shape the installer consumes. */
  downloads?: Downloads;
  /** Package-manager ids, passed through from the manifest. */
  installers?: Installers;
  /** Release notes (markdown) for the resolved version. */
  notes?: string;
  /** Screenshot / preview image URLs scraped from the README or release body. */
  images?: string[];
  /** ISO publish date of the resolved release. */
  publishedAt?: string;
  metrics?: AppMetrics;
  /** What produced this entry: an "owner/repo", or "manual". */
  resolvedFrom?: string;
  /** ISO timestamp of resolution. */
  resolvedAt?: string;
  /** Non-fatal resolution problem (e.g. no asset matched a platform). */
  warning?: string;
}

export interface ResolvedCatalog {
  /** Schema version of this resolved file. */
  version: number;
  /** ISO timestamp the resolver ran. */
  generatedAt: string;
  apps: ResolvedApp[];
}
