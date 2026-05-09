import type { MediaItem } from './types'

export type CatalogSortKey = 'title' | 'year' | 'type'
export type SortDirection = 'asc' | 'desc'

export function getImdbIdFromFilePath(filePath: string): string | null {
  const match = filePath.match(/omdb:\/\/movie\/(tt\d+)/i)
  return match?.[1] ?? null
}

export function extractYear(value: string): string | null {
  const match = value.match(/\b(19|20)\d{2}\b/)
  return match?.[0] ?? null
}

export function getCatalogReleaseYear(item: MediaItem, resolvedYear?: string): string {
  if (resolvedYear) {
    return resolvedYear
  }

  return extractYear(item.title) ?? extractYear(item.file_path) ?? '-'
}

export function getCatalogGenre(resolvedGenre?: string): string {
  return resolvedGenre || '-'
}

export function getRouteMovieId(item: MediaItem): string {
  const imdbId = getImdbIdFromFilePath(item.file_path)
  return imdbId ?? `catalog-${item.id}`
}

export function sortCatalogItems(
  items: MediaItem[],
  sortKey: CatalogSortKey,
  sortDirection: SortDirection,
  catalogYears: Record<number, string>,
): MediaItem[] {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  const directionFactor = sortDirection === 'asc' ? 1 : -1

  return [...items].sort((a, b) => {
    if (sortKey === 'title') {
      return collator.compare(a.title, b.title) * directionFactor
    }

    if (sortKey === 'type') {
      return collator.compare(a.media_type ?? '', b.media_type ?? '') * directionFactor
    }

    const aYear = Number.parseInt(getCatalogReleaseYear(a, catalogYears[a.id]), 10)
    const bYear = Number.parseInt(getCatalogReleaseYear(b, catalogYears[b.id]), 10)
    const aHasYear = Number.isFinite(aYear)
    const bHasYear = Number.isFinite(bYear)

    if (!aHasYear && !bHasYear) {
      return 0
    }

    if (!aHasYear) {
      return 1
    }

    if (!bHasYear) {
      return -1
    }

    return (aYear - bYear) * directionFactor
  })
}

export function getSortIndicator(
  activeSortKey: CatalogSortKey,
  activeDirection: SortDirection,
  targetSortKey: CatalogSortKey,
): string {
  if (activeSortKey !== targetSortKey) {
    return '↕'
  }

  return activeDirection === 'asc' ? '↑' : '↓'
}

export function isTypingTarget(tagName: string | undefined, isContentEditable: boolean | undefined): boolean {
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || Boolean(isContentEditable)
}

export function isValidPage(value: string): boolean {
  const page = Number(value)
  return Number.isFinite(page) && page >= 1
}
