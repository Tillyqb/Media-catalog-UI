import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './api'

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    searchMovies: vi.fn(),
    getMovieByImdb: vi.fn(),
    listMediaItems: vi.fn(),
    createMediaItem: vi.fn(),
    updateMediaItem: vi.fn(),
    deleteMediaItem: vi.fn(),
  }
})

const mockedSearchMovies = vi.mocked(api.searchMovies)
const mockedGetMovieByImdb = vi.mocked(api.getMovieByImdb)
const mockedListMediaItems = vi.mocked(api.listMediaItems)
const mockedCreateMediaItem = vi.mocked(api.createMediaItem)
const mockedUpdateMediaItem = vi.mocked(api.updateMediaItem)
const mockedDeleteMediaItem = vi.mocked(api.deleteMediaItem)

const baseItem = {
  id: 1,
  title: 'Original Title',
  file_path: '/mnt/media/original.mp4',
  media_type: 'movie',
  created_at: '2026-05-08T00:00:00.000Z',
  updated_at: '2026-05-08T00:00:00.000Z',
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.hash = '#/'
    window.localStorage.clear()

    mockedSearchMovies.mockResolvedValue({
      query: 'batman',
      count: 1,
      results: [
        {
          Title: 'Batman Begins',
          Year: '2005',
          Rated: 'PG-13',
          Released: '15 Jun 2005',
          Runtime: '140 min',
          Genre: 'Action',
          Director: 'Christopher Nolan',
          Actors: 'Christian Bale',
          Plot: 'After training with his mentor...',
          Poster: 'N/A',
          imdbRating: '8.2',
          imdbID: 'tt0372784',
        },
      ],
    })

    mockedListMediaItems.mockResolvedValue({
      count: 1,
      results: [baseItem],
    })

    mockedGetMovieByImdb.mockResolvedValue({
      Title: 'Batman Begins',
      Year: '2005',
      Rated: 'PG-13',
      Released: '15 Jun 2005',
      Runtime: '140 min',
      Genre: 'Action',
      Director: 'Christopher Nolan',
      Actors: 'Christian Bale',
      Plot: 'After training with his mentor...',
      Poster: 'N/A',
      imdbRating: '8.2',
      imdbID: 'tt0372784',
    })

    mockedCreateMediaItem.mockResolvedValue({
      id: 2,
      title: 'Batman Begins',
      file_path: 'omdb://movie/tt0372784',
      media_type: 'movie',
      created_at: '2026-05-08T00:00:00.000Z',
      updated_at: '2026-05-08T00:00:00.000Z',
    })
  })

  it('renders and searches movies', async () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByText('Batman Begins')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('heading', { name: 'Batman Begins', level: 3 }))

    await waitFor(() => {
      expect(screen.getByText('movie details')).toBeInTheDocument()
      expect(screen.getByText('Details')).toBeInTheDocument()
      expect(screen.getByText('IMDb ID: tt0372784')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Movie to Database' }))

    await waitFor(() => {
      expect(mockedCreateMediaItem).toHaveBeenCalledWith({
        title: 'Batman Begins',
        file_path: 'omdb://movie/tt0372784',
        media_type: 'movie',
      })
      expect(screen.getByText('Movie added to catalog database.')).toBeInTheDocument()
    })
  })

  it('rolls back optimistic update when API fails', async () => {
    mockedUpdateMediaItem.mockRejectedValueOnce(new Error('update failed'))

    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const titleInput = screen.getByDisplayValue('Original Title')
    fireEvent.change(titleInput, { target: { value: 'Changed Title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Original Title')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Could not update media item.').length).toBeGreaterThan(0)
  })

  it('rolls back optimistic delete when API fails', async () => {
    mockedDeleteMediaItem.mockRejectedValueOnce(new Error('delete failed'))

    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))

    await waitFor(() => {
      expect(screen.getByText('Original Title')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Could not delete media item.').length).toBeGreaterThan(0)
  })

  it('opens details from catalog row with add button disabled', async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Original Title'))

    await waitFor(() => {
      expect(screen.getByText('IMDb ID: catalog-1')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Already in Catalog' })).toBeDisabled()
    })
  })

  it('disables add button when searched movie is already in catalog', async () => {
    mockedListMediaItems.mockResolvedValue({
      count: 1,
      results: [
        {
          id: 2,
          title: 'Batman Begins',
          file_path: 'omdb://movie/tt0372784',
          media_type: 'movie',
          created_at: '2026-05-08T00:00:00.000Z',
          updated_at: '2026-05-08T00:00:00.000Z',
        },
      ],
    })

    render(<App />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Batman Begins', level: 3 })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('heading', { name: 'Batman Begins', level: 3 }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Already in Catalog' })).toBeDisabled()
    })
  })

  it('cancels delete when confirmation modal is dismissed', async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockedDeleteMediaItem).not.toHaveBeenCalled()
    expect(screen.getByText('Original Title')).toBeInTheDocument()
  })

  it('handles keyboard shortcuts and pagination actions', async () => {
    mockedListMediaItems.mockResolvedValue({ count: 1, results: [baseItem] })

    render(<App />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByLabelText('Title')).toHaveFocus()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Batman Begins', level: 3 })).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Next' })[0])
    await waitFor(() => {
      expect(mockedSearchMovies).toHaveBeenCalledWith('Batman', 2)
    })

    fireEvent.change(screen.getByLabelText('Items page'), { target: { value: '2' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Go' })[1])
    await waitFor(() => {
      expect(mockedListMediaItems).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: '10/page' }))
    await waitFor(() => {
      expect(mockedListMediaItems).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }))
    })
  })

  it('confirms delete through modal and calls delete API', async () => {
    mockedDeleteMediaItem.mockResolvedValueOnce()

    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))

    await waitFor(() => {
      expect(mockedDeleteMediaItem).toHaveBeenCalledWith(1)
    })
  })

  it('defaults to dark mode and toggles from the header', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Original Title')).toBeInTheDocument()
    })

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    const lightModeButton = screen.getByRole('button', { name: 'Light Mode' })
    fireEvent.click(lightModeButton)

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(screen.getByRole('button', { name: 'Dark Mode' })).toBeInTheDocument()
  })

  it('sorts catalog columns when clicking table headers', async () => {
    mockedListMediaItems.mockResolvedValueOnce({
      count: 2,
      results: [
        {
          id: 3,
          title: 'Zeta 2005',
          file_path: '/mnt/media/zeta.mp4',
          media_type: 'movie',
          created_at: '2026-05-08T00:00:00.000Z',
          updated_at: '2026-05-08T00:00:00.000Z',
        },
        {
          id: 1,
          title: 'Alpha 1999',
          file_path: '/mnt/media/alpha.mp4',
          media_type: 'movie',
          created_at: '2026-05-08T00:00:00.000Z',
          updated_at: '2026-05-08T00:00:00.000Z',
        },
      ],
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Zeta 2005')).toBeInTheDocument()
      expect(screen.getByText('Alpha 1999')).toBeInTheDocument()
    })

    expect(screen.getByRole('columnheader', { name: 'Genre' })).toBeInTheDocument()
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)

    const titleSortButton = screen.getByRole('button', { name: 'Sort by title' })
    fireEvent.click(titleSortButton)

    const dataRowsAfterTitleSort = screen.getAllByRole('row').slice(1)
    expect(within(dataRowsAfterTitleSort[0]).getByText('Zeta 2005')).toBeInTheDocument()

    const yearSortButton = screen.getByRole('button', { name: 'Sort by year' })
    fireEvent.click(yearSortButton)

    const dataRowsAfterYearAsc = screen.getAllByRole('row').slice(1)
    expect(within(dataRowsAfterYearAsc[0]).getByText('1999')).toBeInTheDocument()

    fireEvent.click(yearSortButton)

    const dataRowsAfterYearDesc = screen.getAllByRole('row').slice(1)
    expect(within(dataRowsAfterYearDesc[0]).getByText('2005')).toBeInTheDocument()
  })

  it('shows validation and API errors for search', async () => {
    mockedSearchMovies.mockRejectedValueOnce(new api.ApiError('OMDb unavailable', 502))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByText('Enter a movie title to search.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByText('OMDb unavailable')).toBeInTheDocument()
    })
  })

  it('shows generic search error when movie search throws non-API error', async () => {
    mockedSearchMovies.mockRejectedValueOnce(new Error('network down'))

    render(<App />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByText('Movie search failed. Check backend connection.')).toBeInTheDocument()
    })
  })

  it('shows catalog load error when media list request fails', async () => {
    mockedListMediaItems.mockRejectedValueOnce(new api.ApiError('Catalog unavailable', 500))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Catalog unavailable')).toBeInTheDocument()
    })
  })

  it('shows generic catalog load error when media list throws non-API error', async () => {
    mockedListMediaItems.mockRejectedValueOnce(new Error('list failed'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Could not load media items. Check backend connection.')).toBeInTheDocument()
    })
  })

  it('validates edit payload and supports canceling edits', async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const titleInput = screen.getByDisplayValue('Original Title')
    fireEvent.change(titleInput, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Title and file path are required.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Original Title')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const editingRow = screen.getByDisplayValue('Original Title').closest('tr')
    expect(editingRow).not.toBeNull()
    fireEvent.click(editingRow as HTMLTableRowElement)
    expect(screen.queryByText('movie details')).not.toBeInTheDocument()
  })

  it('updates catalog item successfully', async () => {
    mockedUpdateMediaItem.mockResolvedValueOnce({
      ...baseItem,
      title: 'Updated Title',
      file_path: '/mnt/media/updated.mp4',
    })

    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByDisplayValue('Original Title'), { target: { value: 'Updated Title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Media item updated.')).toBeInTheDocument()
    })
  })

  it('shows API error message when update fails with API error', async () => {
    mockedUpdateMediaItem.mockRejectedValueOnce(new api.ApiError('Update forbidden', 403))

    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getAllByText('Update forbidden').length).toBeGreaterThan(0)
    })
  })

  it('shows API error when delete fails with API error response', async () => {
    mockedDeleteMediaItem.mockRejectedValueOnce(new api.ApiError('Delete forbidden', 403))

    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))

    await waitFor(() => {
      expect(screen.getAllByText('Delete forbidden').length).toBeGreaterThan(0)
    })
  })

  it('deletes currently edited item and exits edit mode', async () => {
    mockedDeleteMediaItem.mockResolvedValueOnce()

    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))

    await waitFor(() => {
      expect(mockedDeleteMediaItem).toHaveBeenCalledWith(1)
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })
  })

  it('handles invalid page and limit controls without loading new pages', async () => {
    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())
    const callsBefore = mockedListMediaItems.mock.calls.length

    fireEvent.change(screen.getByLabelText('Search page'), { target: { value: '0' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Go' })[0])

    fireEvent.change(screen.getByLabelText('Items page'), { target: { value: '0' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Go' })[1])

    fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '25' } })
    expect(screen.getByLabelText('Limit')).toHaveValue(25)

    expect(mockedListMediaItems.mock.calls.length).toBe(callsBefore)
  })

  it('paginates catalog with keyboard shortcuts when not typing', async () => {
    mockedListMediaItems.mockResolvedValue({ count: 2, results: [baseItem, { ...baseItem, id: 2, title: 'Two' }] })

    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Items page'), { target: { value: '2' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Go' })[1])

    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })

    expect(mockedListMediaItems.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('renders missing-state details fallback when navigating directly', async () => {
    window.location.hash = '#/movies/tt1234567'

    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByText('No movie details in navigation state. Open a movie from the search page to view full data.'),
      ).toBeInTheDocument()
    })
  })

  it('resolves catalog-row details via IMDb lookup', async () => {
    mockedListMediaItems.mockResolvedValueOnce({
      count: 1,
      results: [
        {
          ...baseItem,
          title: 'Batman Begins',
          file_path: 'omdb://movie/tt0372784',
        },
      ],
    })

    render(<App />)

    await waitFor(() => expect(screen.getByText('Batman Begins')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Batman Begins'))

    await waitFor(() => {
      expect(screen.getByText('movie details')).toBeInTheDocument()
      expect(screen.getByText('IMDb ID: tt0372784')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Already in Catalog' })).toBeDisabled()
    })
  })

  it('falls back to title search when IMDb lookup fails for catalog row', async () => {
    mockedGetMovieByImdb.mockRejectedValueOnce(new Error('metadata lookup failed'))
    mockedGetMovieByImdb.mockRejectedValueOnce(new Error('imdb lookup failed'))
    mockedSearchMovies.mockResolvedValueOnce({
      query: 'batman begins',
      count: 1,
      results: [
        {
          Title: 'Batman Begins',
          Year: '2005',
          Rated: 'PG-13',
          Released: '15 Jun 2005',
          Runtime: '140 min',
          Genre: 'Action',
          Director: 'Christopher Nolan',
          Actors: 'Christian Bale',
          Plot: 'After training with his mentor...',
          Poster: 'https://example.com/poster.jpg',
          imdbRating: '8.2',
          imdbID: 'tt0372784',
        },
      ],
    })

    mockedListMediaItems.mockResolvedValueOnce({
      count: 1,
      results: [
        {
          ...baseItem,
          title: 'Batman Begins',
          file_path: 'omdb://movie/tt0372784',
        },
      ],
    })

    render(<App />)

    await waitFor(() => expect(screen.getByText('Batman Begins')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Batman Begins'))

    await waitFor(() => {
      expect(mockedSearchMovies).toHaveBeenCalledWith('Batman Begins', 1)
      expect(screen.getByText('After training with his mentor...')).toBeInTheDocument()
    })
  })

  it('renders poster image when movie details include a poster URL', async () => {
    mockedSearchMovies.mockResolvedValueOnce({
      query: 'batman',
      count: 1,
      results: [
        {
          Title: 'Batman Begins',
          Year: '2005',
          Rated: 'PG-13',
          Released: '15 Jun 2005',
          Runtime: '140 min',
          Genre: 'Action',
          Director: 'Christopher Nolan',
          Actors: 'Christian Bale',
          Plot: 'After training with his mentor...',
          Poster: 'https://example.com/poster.jpg',
          imdbRating: '8.2',
          imdbID: 'tt0372784',
        },
      ],
    })

    render(<App />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Batman Begins', level: 3 })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('heading', { name: 'Batman Begins', level: 3 }))

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Batman Begins poster' })).toBeInTheDocument()
    })
  })

  it('shows add-to-database API and generic errors in movie details', async () => {
    mockedCreateMediaItem.mockRejectedValueOnce(new api.ApiError('Duplicate movie', 409))
    mockedCreateMediaItem.mockRejectedValueOnce(new Error('create exploded'))

    render(<App />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Batman Begins', level: 3 })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('heading', { name: 'Batman Begins', level: 3 }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Movie to Database' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Movie to Database' }))
    await waitFor(() => {
      expect(screen.getByText('Duplicate movie')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Movie to Database' }))
    await waitFor(() => {
      expect(screen.getByText('Could not add movie to database.')).toBeInTheDocument()
    })
  })

  it('checks multiple catalog pages for membership when opening movie details', async () => {
    mockedListMediaItems.mockImplementation(async ({ limit, offset } = {}) => {
      if (limit === 100 && offset === 0) {
        return {
          count: 120,
          results: Array.from({ length: 100 }, (_, index) => ({
            ...baseItem,
            id: index + 10,
            title: `Other ${index}`,
            file_path: `/tmp/${index}.mp4`,
          })),
        }
      }

      if (limit === 100 && offset === 100) {
        return {
          count: 120,
          results: [],
        }
      }

      return {
        count: 1,
        results: [baseItem],
      }
    })

    render(<App />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Batman' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Batman Begins', level: 3 })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('heading', { name: 'Batman Begins', level: 3 }))

    await waitFor(() => {
      expect(mockedListMediaItems).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, offset: 100 }))
    })
  })
})
