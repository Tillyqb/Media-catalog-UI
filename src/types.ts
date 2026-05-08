export interface MovieDetails {
  Title: string
  Year: string
  Rated: string
  Released: string
  Runtime: string
  Genre: string
  Director: string
  Actors: string
  Plot: string
  Poster: string
  imdbRating: string
  imdbID: string
}

export interface MovieSearchResponse {
  query: string
  count: number
  results: MovieDetails[]
}

export interface MediaItem {
  id: number
  title: string
  file_path: string
  media_type: string | null
  created_at: string
  updated_at: string
}

export interface MediaItemListResponse {
  count: number
  results: MediaItem[]
}

export interface MediaItemPayload {
  title: string
  file_path: string
  media_type?: string
}

export interface MediaItemUpdatePayload {
  title?: string
  file_path?: string
  media_type?: string
}
