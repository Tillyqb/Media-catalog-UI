import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ApiError,
  createMediaItem,
  deleteMediaItem,
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

function App() {
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

  const [newTitle, setNewTitle] = useState('')
  const [newPath, setNewPath] = useState('')
  const [newType, setNewType] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPath, setEditPath] = useState('')
  const [editType, setEditType] = useState('')
  const [updateLoading, setUpdateLoading] = useState(false)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const createFormRef = useRef<HTMLFormElement | null>(null)

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
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        createFormRef.current?.requestSubmit()
        return
      }

      if (isTypingTarget) {
        return
      }

      if (event.altKey && event.key === 'ArrowLeft' && itemsPage > 1 && !itemsLoading) {
        event.preventDefault()
        void refreshItems(itemsPage - 1)
      }

      if (event.altKey && event.key === 'ArrowRight' && !itemsLoading && items.length >= itemsLimit) {
        event.preventDefault()
        void refreshItems(itemsPage + 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [items.length, itemsLimit, itemsLoading, itemsPage])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newTitle.trim()
    const filePath = newPath.trim()
    const mediaType = newType.trim()

    if (!title || !filePath) {
      setItemsError('Title and file path are required for new items.')
      return
    }

    setItemsError('')
    setCreateLoading(true)

    const tempItem: MediaItem = {
      id: -Date.now(),
      title,
      file_path: filePath,
      media_type: mediaType || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setItems((current) => [tempItem, ...current])

    try {
      const created = await createMediaItem({
        title,
        file_path: filePath,
        media_type: mediaType || undefined,
      })

      setItems((current) => current.map((item) => (item.id === tempItem.id ? created : item)))
      setNewTitle('')
      setNewPath('')
      setNewType('')
      pushToast('Media item created.', 'success')
    } catch (error) {
      setItems((current) => current.filter((item) => item.id !== tempItem.id))
      if (error instanceof ApiError) {
        setItemsError(error.message)
        pushToast(error.message, 'error')
      } else {
        setItemsError('Could not create media item.')
        pushToast('Could not create media item.', 'error')
      }
    } finally {
      setCreateLoading(false)
    }
  }

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
        <p className="kicker">media sorter</p>
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
            placeholder="Batman"
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
              const page = Number(searchPageJump)
              if (!Number.isFinite(page) || page < 1 || !activeSearchQuery) {
                return
              }
              void executeSearch(activeSearchQuery, Math.floor(page))
            }}
            disabled={searchLoading || !activeSearchQuery}
          >
            Go
          </button>
        </div>

        <div className="card-grid">
          {searchResults.map((movie) => (
            <article key={movie.imdbID} className="movie-card">
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
            disabled={itemsLoading || items.length < itemsLimit}
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
              const page = Number(itemsPageJump)
              if (!Number.isFinite(page) || page < 1) {
                return
              }
              void refreshItems(Math.floor(page))
            }}
            disabled={itemsLoading}
          >
            Go
          </button>
        </div>

        <p className="shortcuts">Shortcuts: Ctrl/Cmd+K focus search, Ctrl/Cmd+Enter create item, Alt+Left/Right page catalog.</p>

        <form className="create-form" onSubmit={handleCreate} ref={createFormRef}>
          <h3>Create Item</h3>
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Title"
          />
          <input
            value={newPath}
            onChange={(event) => setNewPath(event.target.value)}
            placeholder="/mnt/media/movies/example.mp4"
          />
          <input
            value={newType}
            onChange={(event) => setNewType(event.target.value)}
            placeholder="movie"
          />
          <button type="submit" disabled={createLoading}>
            {createLoading ? 'Creating...' : 'Create'}
          </button>
        </form>

        {itemsError && <p className="error">{itemsError}</p>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Path</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isEditing = editingId === item.id
                return (
                  <tr key={item.id}>
                    <td>{item.id}</td>
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
                      {isEditing ? (
                        <input
                          value={editPath}
                          onChange={(event) => setEditPath(event.target.value)}
                        />
                      ) : (
                        <span className="path">{item.file_path}</span>
                      )}
                    </td>
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
                            onClick={() => submitEdit(item.id)}
                            disabled={updateLoading}
                          >
                            {updateLoading ? 'Saving...' : 'Save'}
                          </button>
                          <button type="button" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => startEdit(item)}>
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(item.id)}
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
    </div>
  )
}

export default App
