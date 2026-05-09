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

  it('rolls back optimistic create when API fails', async () => {
    mockedCreateMediaItem.mockRejectedValueOnce(new Error('create failed'))

    render(<App />)

    await waitFor(() => expect(screen.getByText('Original Title')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'New Item' } })
    fireEvent.change(screen.getByPlaceholderText('/mnt/media/movies/example.mp4'), {
      target: { value: '/tmp/new.mp4' },
    })
    fireEvent.change(screen.getByPlaceholderText('movie'), { target: { value: 'movie' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(screen.queryByText('New Item')).not.toBeInTheDocument()
    })

    expect(screen.getAllByText('Could not create media item.').length).toBeGreaterThan(0)
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

    const titleSortButton = screen.getByRole('button', { name: 'Sort by title' })
    fireEvent.click(titleSortButton)

    const dataRowsAfterTitleSort = screen.getAllByRole('row').slice(1)
    expect(within(dataRowsAfterTitleSort[0]).getByText('Alpha 1999')).toBeInTheDocument()

    const yearSortButton = screen.getByRole('button', { name: 'Sort by year' })
    fireEvent.click(yearSortButton)

    const dataRowsAfterYearAsc = screen.getAllByRole('row').slice(1)
    expect(within(dataRowsAfterYearAsc[0]).getByText('1999')).toBeInTheDocument()

    fireEvent.click(yearSortButton)

    const dataRowsAfterYearDesc = screen.getAllByRole('row').slice(1)
    expect(within(dataRowsAfterYearDesc[0]).getByText('2005')).toBeInTheDocument()
  })
})
