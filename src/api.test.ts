import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getMovieByImdb, listMediaItems, searchMovies } from './api'

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
})
