
export default async function handler(req, res) {
  try {
    const token = process.env.TMDB_ACCESS_TOKEN;

    if (!token) {
      return res.status(500).json({ error: "TMDB token missing" });
    }

    const { query, id, type } = req.query;

    const headers = {
      Authorization: `Bearer ${token}`,
      accept: "application/json"
    };

    async function tmdb(path) {
      const response = await fetch(
        `https://api.themoviedb.org/3${path}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error("TMDB request failed");
      }

      return response.json();
    }

    // Fetch details
    if (id) {
      const mediaType = type === "tv" ? "tv" : "movie";

      const append = mediaType === "tv"
        ? "credits,videos,keywords"
        : "credits,videos,keywords,release_dates,external_ids";

      const details = await tmdb(
        `/${mediaType}/${encodeURIComponent(id)}?append_to_response=${append}`
      );

      return res.status(200).json({
        ...details,
        media_type: mediaType
      });
    }

    // Trending movies and TV shows
    if (!query || !query.trim()) {
      const data = await tmdb("/trending/all/week");

      return res.status(200).json({
        ...data,
        results: (data.results || []).filter(
          item => item.media_type === "movie" || item.media_type === "tv"
        )
      });
    }

    // Search movies and TV shows
    const search = encodeURIComponent(query.trim());

    const [movies, shows] = await Promise.all([
      tmdb(`/search/movie?query=${search}&include_adult=false&language=en-US`),
      tmdb(`/search/tv?query=${search}&include_adult=false&language=en-US`)
    ]);

    const results = [
      ...(movies.results || []).map(item => ({
        ...item,
        media_type: "movie"
      })),
      ...(shows.results || []).map(item => ({
        ...item,
        media_type: "tv"
      }))
    ].sort((a, b) =>
      (b.popularity || 0) - (a.popularity || 0)
    );

    return res.status(200).json({
      page: 1,
      results,
      total_results: results.length,
      total_pages: 1
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Something went wrong"
    });
  }
}
