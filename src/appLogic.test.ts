import { describe, expect, it } from 'vitest'
import type { MediaItem } from './types'
import {
  extractYear,
  getCatalogGenre,
  getCatalogReleaseYear,
  getImdbIdFromFilePath,
  getRouteMovieId,
  getSortIndicator,
  isTypingTarget,
  isValidPage,
  sortCatalogItems,
} from './appLogic'

const itemA: MediaItem = {
  id: 1,
  title: 'Alpha 1999',
  file_path: '/media/alpha.mp4',
  media_type: 'movie',
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
}

const itemB: MediaItem = {
  id: 2,
  title: 'Zulu',
  file_path: 'omdb://movie/tt0372784',
  media_type: 'series',
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
}

describe('appLogic helpers', () => {
  it('extracts IMDb ID from OMDb file path', () => {
    expect(getImdbIdFromFilePath('omdb://movie/tt1234567')).toBe('tt1234567')
    expect(getImdbIdFromFilePath('/tmp/file.mp4')).toBeNull()
  })

  it('extracts year from a string', () => {
    expect(extractYear('Movie (2004)')).toBe('2004')
    expect(extractYear('no year')).toBeNull()
  })

  it('computes catalog year from resolved value then fallbacks', () => {
    expect(getCatalogReleaseYear(itemA, '2010')).toBe('2010')
    expect(getCatalogReleaseYear(itemA)).toBe('1999')
    expect(getCatalogReleaseYear({ ...itemA, title: 'Alpha', file_path: '/x/no-year' })).toBe('-')
  })

  it('returns catalog genre fallback', () => {
    expect(getCatalogGenre('Action, Adventure')).toBe('Action, Adventure')
    expect(getCatalogGenre()).toBe('-')
  })

  it('computes route movie id from imdb path or fallback', () => {
    expect(getRouteMovieId(itemB)).toBe('tt0372784')
    expect(getRouteMovieId(itemA)).toBe('catalog-1')
  })

  it('sorts catalog items by title, type, and year', () => {
    const items = [itemB, itemA]

    const byTitle = sortCatalogItems(items, 'title', 'asc', {})
    expect(byTitle[0].title).toBe('Alpha 1999')

    const byTypeDesc = sortCatalogItems(items, 'type', 'desc', {})
    expect(byTypeDesc[0].media_type).toBe('series')

    const byYearAsc = sortCatalogItems(items, 'year', 'asc', { 2: '2005' })
    expect(byYearAsc[0].id).toBe(1)

    const byYearDesc = sortCatalogItems(items, 'year', 'desc', { 2: '2005' })
    expect(byYearDesc[0].id).toBe(2)
  })

  it('handles year sort when years are missing', () => {
    const unknownYearItem: MediaItem = { ...itemA, id: 3, title: 'Unknown', file_path: '/tmp/u' }
    const sorted = sortCatalogItems([unknownYearItem, itemA], 'year', 'asc', {})
    expect(sorted[0].id).toBe(1)
    expect(sorted[1].id).toBe(3)
  })

  it('returns sort indicator glyph for active and inactive columns', () => {
    expect(getSortIndicator('title', 'asc', 'title')).toBe('↑')
    expect(getSortIndicator('title', 'desc', 'title')).toBe('↓')
    expect(getSortIndicator('title', 'asc', 'year')).toBe('↕')
  })

  it('detects typing targets', () => {
    expect(isTypingTarget('INPUT', false)).toBe(true)
    expect(isTypingTarget('TEXTAREA', false)).toBe(true)
    expect(isTypingTarget('DIV', true)).toBe(true)
    expect(isTypingTarget('DIV', false)).toBe(false)
  })

  it('validates page numbers from string input', () => {
    expect(isValidPage('1')).toBe(true)
    expect(isValidPage('2.5')).toBe(true)
    expect(isValidPage('0')).toBe(false)
    expect(isValidPage('-2')).toBe(false)
    expect(isValidPage('abc')).toBe(false)
  })
})
