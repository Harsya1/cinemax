import { buildTmdbImageUrl } from '@cinemax/shared';
import { parseEnv } from '../env.js';

export interface TmdbRawMovie {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  vote_average?: number;
}

export interface TmdbDetailedMovie extends TmdbRawMovie {
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  videos?: {
    results?: Array<{
      key: string;
      site: string;
      type: string;
      official?: boolean;
    }>;
  };
}

export interface TmdbClient {
  browse(category: 'now_playing' | 'upcoming' | 'popular', page?: number): Promise<{
    results: TmdbRawMovie[];
    totalPages: number;
    totalResults: number;
  }>;
  search(query: string, page?: number): Promise<{
    results: TmdbRawMovie[];
    totalPages: number;
    totalResults: number;
  }>;
  getMovieDetails(tmdbId: number): Promise<TmdbDetailedMovie | null>;
}

export function createTmdbClient(): TmdbClient {
  const env = parseEnv(process.env);
  const cache = new Map<string, { data: unknown; expiresAt: number }>();
  const TTL_MS = 15 * 60 * 1000; // 15 mins

  async function tmdbFetch<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const cacheKey = `${endpoint}?${new URLSearchParams(params as Record<string, string>).toString()}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
    };

    if (env.TMDB_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${env.TMDB_ACCESS_TOKEN}`;
    } else if (env.TMDB_API_KEY) {
      url.searchParams.set('api_key', env.TMDB_API_KEY);
    } else {
      throw new Error('TMDb credentials not configured in environment');
    }

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      if (res.status === 404) return null as T;
      throw new Error(`TMDb request failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as T;
    cache.set(cacheKey, { data, expiresAt: Date.now() + TTL_MS });
    return data;
  }

  return {
    async browse(category, page = 1) {
      const endpoint = `movie/${category}`;
      const res = await tmdbFetch<{
        results: TmdbRawMovie[];
        total_pages: number;
        total_results: number;
      }>(endpoint, {
        language: 'id-ID',
        region: 'ID',
        page,
      });
      return {
        results: res?.results ?? [],
        totalPages: res?.total_pages ?? 1,
        totalResults: res?.total_results ?? 0,
      };
    },

    async search(query, page = 1) {
      const res = await tmdbFetch<{
        results: TmdbRawMovie[];
        total_pages: number;
        total_results: number;
      }>('search/movie', {
        query,
        language: 'id-ID',
        page,
      });
      return {
        results: res?.results ?? [],
        totalPages: res?.total_pages ?? 1,
        totalResults: res?.total_results ?? 0,
      };
    },

    async getMovieDetails(tmdbId) {
      // 1. Fetch with id-ID
      const idData = await tmdbFetch<TmdbDetailedMovie>(`movie/${tmdbId}`, {
        language: 'id-ID',
        append_to_response: 'videos',
      });

      if (!idData) return null;

      // 2. If overview is empty, fallback to en-US overview
      if (!idData.overview || idData.overview.trim().length === 0) {
        const enData = await tmdbFetch<TmdbDetailedMovie>(`movie/${tmdbId}`, {
          language: 'en-US',
        });
        if (enData?.overview) {
          idData.overview = enData.overview;
        }
      }

      return idData;
    },
  };
}
