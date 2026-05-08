import type {
  MediaItem,
  MediaItemListResponse,
  MediaItemPayload,
  MediaItemUpdatePayload,
  MovieSearchResponse,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload = (await response.json().catch(() => ({}))) as {
    detail?: string
    message?: string
  }

  if (!response.ok) {
    const message = payload.detail ?? payload.message ?? `Request failed with ${response.status}`
    throw new ApiError(message, response.status)
  }

  return payload as T
}

export async function searchMovies(title: string, page = 1): Promise<MovieSearchResponse> {
  const params = new URLSearchParams({ title, page: String(page) })
  return request<MovieSearchResponse>(`/movies/search?${params.toString()}`)
}

export async function listMediaItems(params?: {
  limit?: number
  offset?: number
  mediaType?: string
}): Promise<MediaItemListResponse> {
  const search = new URLSearchParams()
  if (params?.limit !== undefined) search.set('limit', String(params.limit))
  if (params?.offset !== undefined) search.set('offset', String(params.offset))
  if (params?.mediaType) search.set('media_type', params.mediaType)

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<MediaItemListResponse>(`/media-items${suffix}`)
}

export async function createMediaItem(payload: MediaItemPayload): Promise<MediaItem> {
  return request<MediaItem>('/media-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateMediaItem(
  itemId: number,
  payload: MediaItemUpdatePayload,
): Promise<MediaItem> {
  return request<MediaItem>(`/media-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteMediaItem(itemId: number): Promise<void> {
  await request<void>(`/media-items/${itemId}`, { method: 'DELETE' })
}

export { ApiError }
