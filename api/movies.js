
export default async function handler(req, res) {
  try {
    const token = process.env.TMDB_ACCESS_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: "TMDB token is not configured"
      });
    }

    const { query, id } = req.query;

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

    // Movie details
    if (id) {
      const movie = await tmdb(
        `/movie/${encodeURIComponent(id)}` +
        "?append_to_response=credits,videos,keywords,release_dates,external_ids"
      );

      return res.status(200).json(movie);
    }

    // Trending movies
    if (!query || !query.trim()) {
      return res.status(200).json(
        await tmdb("/trending/movie/week")
      );
    }

    const search = query.trim();

    // Search the entered spelling
    const exact = await tmdb(
      `/search/movie?query=${encodeURIComponent(search)}` +
      "&include_adult=false&language=en-US"
    );

    // Also search popular and trending movies
    const pages = await Promise.all([
      tmdb("/movie/popular?page=1"),
      tmdb("/movie/popular?page=2"),
      tmdb("/movie/popular?page=3"),
      tmdb("/trending/movie/week")
    ]);

    const allMovies = [
      ...(exact.results || []),
      ...pages.flatMap(page => page.results || [])
    ];

    // Remove duplicate movies
    const uniqueMovies = [
      ...new Map(
        allMovies.map(movie => [movie.id, movie])
      ).values()
    ];

    function normalize(value) {
      return value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    }

    // Calculate spelling difference
    function distance(a, b) {
      const row = Array.from(
        { length: b.length + 1 },
        (_, i) => i
      );

      for (let i = 1; i <= a.length; i++) {
        let previous = row[0];
        row[0] = i;

        for (let j = 1; j <= b.length; j++) {
          const old = row[j];

          row[j] = Math.min(
            row[j] + 1,
            row[j - 1] + 1,
            previous + (a[i - 1] === b[j - 1] ? 0 : 1)
          );

          previous = old;
        }
      }

      return row[b.length];
    }

    const wanted = normalize(search);

    // Rank spelling similarity and movie popularity
    const ranked = uniqueMovies
      .filter(movie => movie.title)
      .map(movie => {
        const title = normalize(movie.title);
        const maxLength = Math.max(wanted.length, title.length);

        const similarity = maxLength
          ? 1 - distance(wanted, title) / maxLength
          : 0;

        const popularityBonus =
          Math.min(Math.log10((movie.popularity || 0) + 1) / 4, 1) * 0.25;

        const votesBonus =
          Math.min(Math.log10((movie.vote_count || 0) + 1) / 5, 1) * 0.10;

        return {
          movie,
          score: similarity + popularityBonus + votesBonus
        };
      })
      .filter(item => item.score >= 0.55)
      .sort((a, b) => b.score - a.score);

    return res.status(200).json({
      page: 1,
      results: ranked.slice(0, 20).map(item => item.movie),
      total_results: ranked.length,
      total_pages: 1
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Something went wrong"
    });
  }
}
