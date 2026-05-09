import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  type CatalogSortKey,
  type SortDirection,
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
import {
  ApiError,
  createMediaItem,
  deleteMediaItem,
  getMovieByImdb,
  listMediaItems,
  searchMovies,
  updateMediaItem,
} from './api'
import type { MediaItem, MovieDetails } from './types'
import './App.css'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const DEFAULT_ITEMS_LIMIT = 20
const PAGE_SIZE_PRESETS = [10, 20, 50]
const ALL_ITEMS_PAGE_SIZE = 100

interface MovieRouteState {
  movie?: MovieDetails
  catalogItem?: MediaItem
  fromCatalog?: boolean
}

type ThemeMode = 'light' | 'dark'

interface ThemeControls {
  theme: ThemeMode
  onToggleTheme: () => void
}

function DashboardPage({ theme, onToggleTheme }: ThemeControls) {
  const navigate = useNavigate()
  const [searchTitle, setSearchTitle] = useState('')
  const [activeSearchQuery, setActiveSearchQuery] = useState('')
  const [searchPage, setSearchPage] = useState(1)
  const [searchPageJump, setSearchPageJump] = useState('1')
  const [searchResults, setSearchResults] = useState<MovieDetails[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [items, setItems] = useState<MediaItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState('')
  const [filterMediaType, setFilterMediaType] = useState('')
  const [itemsPage, setItemsPage] = useState(1)
  const [itemsPageJump, setItemsPageJump] = useState('1')
  const [itemsLimit, setItemsLimit] = useState(DEFAULT_ITEMS_LIMIT)
  const [showAllItems, setShowAllItems] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPath, setEditPath] = useState('')
  const [editType, setEditType] = useState('')
  const [updateLoading, setUpdateLoading] = useState(false)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<MediaItem | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [catalogYears, setCatalogYears] = useState<Record<number, string>>({})
  const [catalogGenres, setCatalogGenres] = useState<Record<number, string>>({})
  const [catalogSortKey, setCatalogSortKey] = useState<CatalogSortKey>('title')
  const [catalogSortDirection, setCatalogSortDirection] = useState<SortDirection>('asc')

  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const activeFilter = useMemo(() => filterMediaType.trim(), [filterMediaType])

  function pushToast(message: string, kind: ToastKind = 'info') {
    const toast: Toast = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      kind,
      message,
    }

    setToasts((current) => [...current, toast])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id))
    }, 2800)
  }

  async function executeSearch(query: string, page: number) {
    setSearchError('')
    setSearchLoading(true)
    try {
      const response = await searchMovies(query, page)
      setSearchResults(response.results)
      setSearchPage(page)
      setSearchPageJump(String(page))
      setActiveSearchQuery(query)
    } catch (error) {
      if (error instanceof ApiError) {
        setSearchError(error.message)
      } else {
        setSearchError('Movie search failed. Check backend connection.')
      }
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = searchTitle.trim()
    if (!query) {
      setSearchError('Enter a movie title to search.')
      return
    }

    await executeSearch(query, 1)
  }

  async function refreshItems(page = itemsPage, limit = itemsLimit) {
    setItemsError('')
    setItemsLoading(true)
    try {
      const offset = (page - 1) * limit
      const response = await listMediaItems({
        limit,
        offset,
        mediaType: activeFilter,
      })
      setItems(response.results)
      setItemsPage(page)
      setItemsPageJump(String(page))
      setShowAllItems(false)
    } catch (error) {
      if (error instanceof ApiError) {
        setItemsError(error.message)
      } else {
        setItemsError('Could not load media items. Check backend connection.')
      }
    } finally {
      setItemsLoading(false)
    }
  }

  async function refreshAllItems() {
    setItemsError('')
    setItemsLoading(true)
    try {
      let offset = 0
      const allItems: MediaItem[] = []

      while (true) {
        const response = await listMediaItems({
          limit: ALL_ITEMS_PAGE_SIZE,
          offset,
          mediaType: activeFilter,
        })
        allItems.push(...response.results)

        if (response.results.length < ALL_ITEMS_PAGE_SIZE || allItems.length >= response.count) {
          break
        }

        offset += ALL_ITEMS_PAGE_SIZE
      }

      setItems(allItems)
      setItemsPage(1)
      setItemsPageJump('1')
      setShowAllItems(true)
    } catch (error) {
      if (error instanceof ApiError) {
        setItemsError(error.message)
      } else {
        setItemsError('Could not load media items. Check backend connection.')
      }
    } finally {
      setItemsLoading(false)
    }
  }

  useEffect(() => {
    void refreshItems(1, itemsLimit)
  }, [])

  useEffect(() => {
    const pendingItems = items.filter((item) => {
      const imdbId = getImdbIdFromFilePath(item.file_path)
      return Boolean(imdbId) && (catalogYears[item.id] === undefined || catalogGenres[item.id] === undefined)
    })

    if (pendingItems.length === 0) {
      return
    }

    let cancelled = false

    async function resolveCatalogYears() {
      const entries = await Promise.all(
        pendingItems.map(async (item) => {
          const imdbId = getImdbIdFromFilePath(item.file_path)
          try {
            const movie = await getMovieByImdb(imdbId as string)
            return [item.id, extractYear(movie.Year) ?? getCatalogReleaseYear(item), getCatalogGenre(movie.Genre)] as const
          } catch {
            return [item.id, getCatalogReleaseYear(item), getCatalogGenre()] as const
          }
        }),
      )

      if (cancelled) {
        return
      }

      setCatalogYears((current) => {
        const next = { ...current }
        entries.forEach(([itemId, year]) => {
          next[itemId] = year
        })
        return next
      })

      setCatalogGenres((current) => {
        const next = { ...current }
        entries.forEach(([itemId, _year, genre]) => {
          next[itemId] = genre
        })
        return next
      })
    }

    void resolveCatalogYears()

    return () => {
      cancelled = true
    }
  }, [catalogGenres, catalogYears, items])

  const sortedItems = useMemo(() => {
    return sortCatalogItems(items, catalogSortKey, catalogSortDirection, catalogYears)
  }, [catalogSortDirection, catalogSortKey, catalogYears, items])

  function toggleCatalogSort(nextSortKey: CatalogSortKey) {
    if (catalogSortKey === nextSortKey) {
      setCatalogSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setCatalogSortKey(nextSortKey)
    setCatalogSortDirection('asc')
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = isTypingTarget(target?.tagName, target?.isContentEditable)

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (typing) {
        return
      }

      if (event.altKey && event.key === 'ArrowLeft' && itemsPage > 1 && !itemsLoading) {
        event.preventDefault()
        void refreshItems(itemsPage - 1)
      }

      if (
        event.altKey &&
        event.key === 'ArrowRight' &&
        !itemsLoading &&
        !showAllItems &&
        items.length >= itemsLimit
      ) {
        event.preventDefault()
        void refreshItems(itemsPage + 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [items.length, itemsLimit, itemsLoading, itemsPage, showAllItems])

  function startEdit(item: MediaItem) {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditPath(item.file_path)
    setEditType(item.media_type ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
    setEditPath('')
    setEditType('')
  }

  async function submitEdit(itemId: number) {
    const previous = items.find((item) => item.id === itemId)
    if (!previous) {
      setItemsError('Media item not found in local state.')
      return
    }

    const payload = {
      title: editTitle.trim(),
      file_path: editPath.trim(),
      media_type: editType.trim() || undefined,
    }

    if (!payload.title || !payload.file_path) {
      setItemsError('Title and file path are required.')
      return
    }

    setItemsError('')
    setUpdateLoading(true)
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              title: payload.title,
              file_path: payload.file_path,
              media_type: payload.media_type ?? null,
              updated_at: new Date().toISOString(),
            }
          : item,
      ),
    )

    try {
      const updated = await updateMediaItem(itemId, payload)
      setItems((current) => current.map((item) => (item.id === itemId ? updated : item)))
      cancelEdit()
      pushToast('Media item updated.', 'success')
    } catch (error) {
      setItems((current) => current.map((item) => (item.id === itemId ? previous : item)))
      setEditTitle(previous.title)
      setEditPath(previous.file_path)
      setEditType(previous.media_type ?? '')
      if (error instanceof ApiError) {
        setItemsError(error.message)
        pushToast(error.message, 'error')
      } else {
        setItemsError('Could not update media item.')
        pushToast('Could not update media item.', 'error')
      }
    } finally {
      setUpdateLoading(false)
    }
  }

  async function handleDelete(itemId: number) {
    setItemsError('')
    setDeletingId(itemId)

    const previous = items
    setItems((current) => current.filter((item) => item.id !== itemId))

    try {
      await deleteMediaItem(itemId)
      if (editingId === itemId) {
        cancelEdit()
      }
      pushToast('Media item deleted.', 'success')
    } catch (error) {
      setItems(previous)
      if (error instanceof ApiError) {
        setItemsError(error.message)
        pushToast(error.message, 'error')
      } else {
        setItemsError('Could not delete media item.')
        pushToast('Could not delete media item.', 'error')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead-top">
          <p className="kicker">media sorter</p>
          <button type="button" className="secondary theme-toggle" onClick={onToggleTheme}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
        <h1>Media Catalog Browser UI</h1>
        <p className="intro">
          Search OMDb, then manage your local catalog records from the Flask backend.
        </p>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Movie Search</h2>
          <p>Endpoint: GET /movies/search</p>
        </div>

        <form className="inline-form" onSubmit={handleSearch}>
          <label htmlFor="search-title">Title</label>
          <input
            id="search-title"
            ref={searchInputRef}
            value={searchTitle}
            onChange={(event) => setSearchTitle(event.target.value)}
            placeholder="Dune"
            autoComplete="off"
          />
          <button type="submit" disabled={searchLoading}>
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchError && <p className="error">{searchError}</p>}

        <div className="pager">
          <button
            type="button"
            onClick={() => executeSearch(activeSearchQuery, searchPage - 1)}
            disabled={searchLoading || searchPage <= 1 || !activeSearchQuery}
          >
            Previous
          </button>
          <p>Page {searchPage}</p>
          <button
            type="button"
            onClick={() => executeSearch(activeSearchQuery, searchPage + 1)}
            disabled={searchLoading || !activeSearchQuery || searchResults.length === 0}
          >
            Next
          </button>
          <input
            aria-label="Search page"
            type="number"
            min={1}
            value={searchPageJump}
            onChange={(event) => setSearchPageJump(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              if (!isValidPage(searchPageJump) || !activeSearchQuery) {
                return
              }
              const page = Number(searchPageJump)
              void executeSearch(activeSearchQuery, Math.floor(page))
            }}
            disabled={searchLoading || !activeSearchQuery}
          >
            Go
          </button>
        </div>

        <div className="card-grid">
          {searchResults.map((movie) => (
            <Link
              key={movie.imdbID}
              to={`/movies/${movie.imdbID}`}
              state={{ movie }}
              className="movie-link"
            >
              <article className="movie-card">
                <img
                  src={movie.Poster !== 'N/A' ? movie.Poster : undefined}
                  alt={`${movie.Title} poster`}
                  loading="lazy"
                />
                <div>
                  <h3>{movie.Title}</h3>
                  <p>
                    {movie.Year} • {movie.Runtime} • {movie.imdbRating}
                  </p>
                  <p>{movie.Genre}</p>
                  <p className="muted">{movie.Plot}</p>
                </div>
              </article>
            </Link>
          ))}
          {!searchLoading && searchResults.length === 0 && (
            <p className="empty">No movie results yet. Run a search above.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Catalog Manager</h2>
          <p>Endpoint: /media-items CRUD</p>
        </div>

        <div className="toolbar">
          <label htmlFor="media-filter">Filter by media_type</label>
          <input
            id="media-filter"
            value={filterMediaType}
            onChange={(event) => setFilterMediaType(event.target.value)}
            placeholder="movie, image, ..."
          />
          <button type="button" onClick={() => refreshItems(1)} disabled={itemsLoading}>
            {itemsLoading ? 'Loading...' : 'Load Items'}
          </button>
          <label htmlFor="limit">Limit</label>
          <input
            id="limit"
            type="number"
            min={1}
            max={200}
            value={itemsLimit}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next) && next > 0) {
                setItemsLimit(next)
                setItemsPage(1)
              }
            }}
          />
        </div>

        <div className="limit-presets" role="group" aria-label="Page size presets">
          {PAGE_SIZE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={itemsLimit === preset ? 'secondary active' : 'secondary'}
              onClick={() => {
                setItemsLimit(preset)
                setItemsPage(1)
                void refreshItems(1, preset)
              }}
            >
              {preset}/page
            </button>
          ))}
          <button
            type="button"
            className={showAllItems ? 'secondary active' : 'secondary'}
            onClick={() => {
              void refreshAllItems()
            }}
          >
            All
          </button>
        </div>

        <div className="pager">
          <button
            type="button"
            onClick={() => refreshItems(itemsPage - 1)}
            disabled={itemsLoading || itemsPage <= 1}
          >
            Previous
          </button>
          <p>Page {itemsPage}</p>
          <button
            type="button"
            onClick={() => refreshItems(itemsPage + 1)}
            disabled={itemsLoading || showAllItems || items.length < itemsLimit}
          >
            Next
          </button>
          <input
            aria-label="Items page"
            type="number"
            min={1}
            value={itemsPageJump}
            onChange={(event) => setItemsPageJump(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              if (!isValidPage(itemsPageJump)) {
                return
              }
              const page = Number(itemsPageJump)
              void refreshItems(Math.floor(page))
            }}
            disabled={itemsLoading}
          >
            Go
          </button>
        </div>

        <p className="shortcuts">Shortcuts: Ctrl/Cmd+K focus search, Alt+Left/Right page catalog.</p>

        {itemsError && <p className="error">{itemsError}</p>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className="sort-button"
                    aria-label="Sort by title"
                    onClick={() => toggleCatalogSort('title')}
                  >
                    Title <span aria-hidden="true">{getSortIndicator(catalogSortKey, catalogSortDirection, 'title')}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="sort-button"
                    aria-label="Sort by year"
                    onClick={() => toggleCatalogSort('year')}
                  >
                    YEAR <span aria-hidden="true">{getSortIndicator(catalogSortKey, catalogSortDirection, 'year')}</span>
                  </button>
                </th>
                <th>Genre</th>
                <th>
                  <button
                    type="button"
                    className="sort-button"
                    aria-label="Sort by type"
                    onClick={() => toggleCatalogSort('type')}
                  >
                    Type <span aria-hidden="true">{getSortIndicator(catalogSortKey, catalogSortDirection, 'type')}</span>
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const isEditing = editingId === item.id
                return (
                  <tr
                    key={item.id}
                    className={!isEditing ? 'clickable-row' : undefined}
                    onClick={() => {
                      if (isEditing) {
                        return
                      }
                      navigate(`/movies/${getRouteMovieId(item)}`, {
                        state: {
                          catalogItem: item,
                          fromCatalog: true,
                        } satisfies MovieRouteState,
                      })
                    }}
                  >
                    <td>
                      {isEditing ? (
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                        />
                      ) : (
                        item.title
                      )}
                    </td>
                    <td>
                      {getCatalogReleaseYear(item, catalogYears[item.id])}
                    </td>
                    <td>{getCatalogGenre(catalogGenres[item.id])}</td>
                    <td>
                      {isEditing ? (
                        <input
                          value={editType}
                          onChange={(event) => setEditType(event.target.value)}
                        />
                      ) : (
                        item.media_type ?? '-'
                      )}
                    </td>
                    <td className="actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void submitEdit(item.id)
                            }}
                            disabled={updateLoading}
                          >
                            {updateLoading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              cancelEdit()
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            startEdit(item)
                          }}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleteCandidate(item)
                        }}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!itemsLoading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No stored media items loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {deleteCandidate && (
        <div className="modal-overlay" role="presentation" onClick={() => setDeleteCandidate(null)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-modal-title">Delete media item?</h3>
            <p>
              This will permanently delete <strong>{deleteCandidate.title}</strong> from the catalog.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  const itemId = deleteCandidate.id
                  setDeleteCandidate(null)
                  void handleDelete(itemId)
                }}
              >
                Confirm Delete
              </button>
              <button type="button" className="secondary" onClick={() => setDeleteCandidate(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MovieDetailsPage({ theme, onToggleTheme }: ThemeControls) {
  const navigate = useNavigate()
  const { imdbID } = useParams<{ imdbID: string }>()
  const location = useLocation()
  const state = location.state as MovieRouteState | null
  const movie = state?.movie
  const catalogItem = state?.catalogItem
  const fromCatalog = Boolean(state?.fromCatalog)
  const [resolvedMovie, setResolvedMovie] = useState<MovieDetails | undefined>(movie)
  const [resolvingCatalogMovie, setResolvingCatalogMovie] = useState(false)
  const [checkingCatalogMembership, setCheckingCatalogMembership] = useState(false)
  const [alreadyInCatalog, setAlreadyInCatalog] = useState(fromCatalog)
  const displayMovie = movie ?? resolvedMovie
  const posterUrl = displayMovie?.Poster && displayMovie.Poster !== 'N/A' ? displayMovie.Poster : null
  const [addingMovie, setAddingMovie] = useState(false)
  const [addMovieMessage, setAddMovieMessage] = useState('')
  const [addMovieError, setAddMovieError] = useState('')

  useEffect(() => {
    setResolvedMovie(movie)
  }, [movie])

  useEffect(() => {
    setAlreadyInCatalog(fromCatalog)
  }, [fromCatalog])

  useEffect(() => {
    const movieImdbId = movie?.imdbID
    const movieTitle = movie?.Title
    if (!movieImdbId || !movieTitle || fromCatalog) {
      return
    }

    let cancelled = false
    setCheckingCatalogMembership(true)

    async function checkCatalogMembership() {
      const pageSize = 100
      let offset = 0

      while (true) {
        const response = await listMediaItems({
          limit: pageSize,
          offset,
          mediaType: 'movie',
        })

        const found = response.results.some(
          (item) => item.file_path === `omdb://movie/${movieImdbId}` || item.title === movieTitle,
        )

        if (found) {
          if (!cancelled) {
            setAlreadyInCatalog(true)
          }
          return
        }

        if (response.results.length < pageSize) {
          if (!cancelled) {
            setAlreadyInCatalog(false)
          }
          return
        }

        offset += pageSize
      }
    }

    void checkCatalogMembership()
      .catch(() => {
        if (!cancelled) {
          setAlreadyInCatalog(false)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingCatalogMembership(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [fromCatalog, movie?.Title, movie?.imdbID])

  useEffect(() => {
    const catalogTitle = catalogItem?.title
    if (movie || !catalogTitle) {
      return
    }
    const resolvedCatalogTitle = catalogTitle

    let cancelled = false
    setResolvingCatalogMovie(true)

    async function resolveCatalogMovie() {
      if (imdbID && imdbID.startsWith('tt')) {
        try {
          const byIdMovie = await getMovieByImdb(imdbID)
          if (!cancelled) {
            setResolvedMovie(byIdMovie)
          }
          return
        } catch {
          // Fall back to title search when direct IMDb lookup fails.
        }
      }

      const response = await searchMovies(resolvedCatalogTitle, 1)
      if (cancelled) {
        return
      }

      const imdbMatch =
        imdbID && imdbID.startsWith('tt')
          ? response.results.find((item) => item.imdbID === imdbID)
          : undefined
      const titleMatch = response.results.find(
        (item) => item.Title.toLowerCase() === resolvedCatalogTitle.toLowerCase(),
      )

      setResolvedMovie(imdbMatch ?? titleMatch ?? response.results[0])
    }

    void resolveCatalogMovie()
      .catch(() => {
        if (!cancelled) {
          setResolvedMovie(undefined)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResolvingCatalogMovie(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [catalogItem?.title, imdbID, movie])

  async function handleAddMovieToDatabase(targetMovie: MovieDetails) {
    setAddMovieError('')
    setAddMovieMessage('')
    setAddingMovie(true)

    try {
      await createMediaItem({
        title: targetMovie.Title,
        file_path: `omdb://movie/${targetMovie.imdbID}`,
        media_type: 'movie',
      })
      setAlreadyInCatalog(true)
      setAddMovieMessage('Movie added to catalog database.')
    } catch (error) {
      if (error instanceof ApiError) {
        setAddMovieError(error.message)
      } else {
        setAddMovieError('Could not add movie to database.')
      }
    } finally {
      setAddingMovie(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead-top">
          <p className="kicker">movie details</p>
          <button type="button" className="secondary theme-toggle" onClick={onToggleTheme}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
        <h1>{displayMovie?.Title ?? catalogItem?.title ?? 'Movie details unavailable'}</h1>
        <p className="intro">IMDb ID: {imdbID}</p>
      </header>

      <section className="panel details-page">
        <div className="panel-head">
          <h2>Details</h2>
          <div className="details-actions">
            <button
              type="button"
              onClick={() => {
                if (movie) {
                  void handleAddMovieToDatabase(movie)
                }
              }}
              disabled={!movie || fromCatalog || alreadyInCatalog || addingMovie || checkingCatalogMembership}
            >
              {fromCatalog || alreadyInCatalog
                ? 'Already in Catalog'
                : checkingCatalogMembership
                  ? 'Checking Catalog...'
                  : addingMovie
                    ? 'Adding...'
                    : 'Add Movie to Database'}
            </button>
            <button type="button" onClick={() => navigate(-1)}>
              Back to Search
            </button>
          </div>
        </div>

        {addMovieMessage && <p className="success-note">{addMovieMessage}</p>}
        {addMovieError && <p className="error">{addMovieError}</p>}

        {!displayMovie && !catalogItem ? (
          <p className="error">
            No movie details in navigation state. Open a movie from the search page to view full data.
          </p>
        ) : (
          <div className="details-grid">
            {posterUrl ? (
              <img
                className="details-poster"
                src={posterUrl}
                alt={`${displayMovie?.Title ?? catalogItem?.title ?? 'Movie'} poster`}
              />
            ) : (
              <div className="details-poster details-poster-fallback">
                {resolvingCatalogMovie ? 'Loading poster...' : 'No poster available'}
              </div>
            )}
            <div className="details-list">
              <p>
                <strong>Title:</strong> {displayMovie?.Title ?? catalogItem?.title ?? 'Unknown'}
              </p>
              <p>
                <strong>Year:</strong> {displayMovie?.Year ?? 'Unknown'}
              </p>
              <p>
                <strong>Rated:</strong> {displayMovie?.Rated ?? 'Unknown'}
              </p>
              <p>
                <strong>Released:</strong> {displayMovie?.Released ?? 'Unknown'}
              </p>
              <p>
                <strong>Runtime:</strong> {displayMovie?.Runtime ?? 'Unknown'}
              </p>
              <p>
                <strong>Genre:</strong> {displayMovie?.Genre ?? catalogItem?.media_type ?? 'Unknown'}
              </p>
              <p>
                <strong>Director:</strong> {displayMovie?.Director ?? 'Unknown'}
              </p>
              <p>
                <strong>Actors:</strong> {displayMovie?.Actors ?? 'Unknown'}
              </p>
              <p>
                <strong>IMDb Rating:</strong> {displayMovie?.imdbRating ?? 'Unknown'}
              </p>
              <p>
                <strong>Catalog Path:</strong> {catalogItem?.file_path ?? 'n/a'}
              </p>
              <p>
                <strong>Plot:</strong>{' '}
                {displayMovie?.Plot ?? 'No OMDb plot available for this catalog row.'}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const storedTheme = window.localStorage.getItem('media-catalog-theme')
    return storedTheme === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('media-catalog-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DashboardPage theme={theme} onToggleTheme={toggleTheme} />} />
        <Route
          path="/movies/:imdbID"
          element={<MovieDetailsPage theme={theme} onToggleTheme={toggleTheme} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
