
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

    if (id) {
      const movie = await tmdb(
        `/movie/${encodeURIComponent(id)}` +
        "?append_to_response=credits,videos,keywords,release_dates,external_ids"
      );

      return res.status(200).json(movie);
    }

    if (!query || !query.trim()) {
      const data = await tmdb("/trending/movie/week");
      return res.status(200).json(data);
    }

    const searchQuery = query.trim();

    const exact = await tmdb(
      `/search/movie?query=${encodeURIComponent(searchQuery)}` +
      "&include_adult=false&language=en-US"
    );

    if (exact.results?.length) {
      return res.status(200).json(exact);
    }

    // Check popular and trending movies for close title matches.
    const pages = await Promise.all([
      tmdb("/movie/popular?page=1"),
      tmdb("/movie/popular?page=2"),
      tmdb("/movie/popular?page=3"),
      tmdb("/trending/movie/week")
    ]);

    const movies = pages.flatMap(page => page.results || []);

    function normalize(value) {
      return value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    }

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

    const wanted = normalize(searchQuery);

    const matches = movies
      .filter(movie => movie.title)
      .map(movie => ({
        movie,
        score: distance(wanted, normalize(movie.title))
      }))
      .filter(item =>
        item.score <= Math.max(2, Math.floor(wanted.length * 0.25))
      )
      .sort((a, b) => a.score - b.score);

    return res.status(200).json({
      results: matches.map(item => item.movie),
      total_results: matches.length
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Something went wrong"
    });
  }
}
