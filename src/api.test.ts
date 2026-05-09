import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  createMediaItem,
  deleteMediaItem,
  getMovieByImdb,
  listMediaItems,
  searchMovies,
  updateMediaItem,
} from './api'

describe('api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds search query and returns movie data', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query: 'batman',
        count: 1,
        results: [{ imdbID: 'tt001', Title: 'Batman' }],
      }),
    } as Response)

    const response = await searchMovies('batman', 2)

    expect(fetchSpy).toHaveBeenCalledWith('/api/movies/search?title=batman&page=2', expect.any(Object))
    expect(response.count).toBe(1)
  })

  it('throws ApiError when backend returns an error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'bad request' }),
    } as Response)

    await expect(listMediaItems()).rejects.toBeInstanceOf(ApiError)
  })

  it('calls IMDb lookup endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ imdbID: 'tt0372784', Title: 'Batman Begins' }),
    } as Response)

    const response = await getMovieByImdb('tt0372784')

    expect(fetchSpy).toHaveBeenCalledWith('/api/movies/by-imdb/tt0372784', expect.any(Object))
    expect(response.imdbID).toBe('tt0372784')
  })

  it('sends list params for limit, offset, and media_type', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ count: 0, results: [] }),
    } as Response)

    await listMediaItems({ limit: 10, offset: 20, mediaType: 'movie' })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/media-items?limit=10&offset=20&media_type=movie',
      expect.any(Object),
    )
  })

  it('handles 204 response for delete endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as Response)

    await deleteMediaItem(42)

    expect(fetchSpy).toHaveBeenCalledWith('/api/media-items/42', expect.any(Object))
  })

  it('uses fallback error message when API body has no detail/message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    await expect(createMediaItem({ title: 'A', file_path: '/tmp/a', media_type: 'movie' })).rejects.toMatchObject({
      message: 'Request failed with 500',
      status: 500,
    })
  })

  it('supports update endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, title: 'Updated', file_path: '/tmp/a', media_type: 'movie' }),
    } as Response)

    await updateMediaItem(1, { title: 'Updated' })

    expect(fetchSpy).toHaveBeenCalledWith('/api/media-items/1', expect.any(Object))
  })
})
