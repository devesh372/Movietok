
export default async function handler(req, res) {
  try {
    const token = process.env.TMDB_ACCESS_TOKEN;

    if (!token) {
      return res.status(500).json({ error: "TMDB token missing" });
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
      return res.status(200).json(
        await tmdb("/trending/movie/week")
      );
    }

    const input = query.trim();

    function normalize(value) {
      return value.toLowerCase().replace(/[^a-z0-9]/g, "");
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

    const words = new Set([input]);

    // Generate possible corrections for a single word.
    const clean = normalize(input);

    if (clean.length >= 5 && clean.length <= 18) {
      const alphabet = "abcdefghijklmnopqrstuvwxyz";

      for (let i = 0; i < clean.length; i++) {
        const removed = clean.slice(0, i) + clean.slice(i + 1);
        words.add(removed);

        for (const letter of alphabet) {
          const changed =
            clean.slice(0, i) + letter + clean.slice(i + 1);

          words.add(changed);
        }

        for (const letter of alphabet) {
          const inserted =
            clean.slice(0, i) + letter + clean.slice(i);

          words.add(inserted);
        }
      }
    }

    const candidates = [...words]
      .filter(word => normalize(word).length >= 3)
      .slice(0, 60);

    const searches = await Promise.all(
      candidates.map(async word => {
        try {
          return await tmdb(
            `/search/movie?query=${encodeURIComponent(word)}` +
            "&include_adult=false&language=en-US"
          );
        } catch {
          return { results: [] };
        }
      })
    );

    const movies = [
      ...new Map(
        searches
          .flatMap(result => result.results || [])
          .map(movie => [movie.id, movie])
      ).values()
    ];

    const wanted = normalize(input);

    const ranked = movies
      .map(movie => {
        const title = normalize(movie.title || "");
        const difference = distance(wanted, title);
        const longest = Math.max(wanted.length, title.length);

        const similarity = longest
          ? 1 - difference / longest
          : 0;

        return { movie, similarity, difference };
      })
      .filter(item =>
        item.difference <= Math.max(2, Math.floor(wanted.length * 0.2))
      )
      .sort((a, b) => {
        if (a.difference !== b.difference) {
          return a.difference - b.difference;
        }

        return (
          (b.movie.vote_count || 0) -
          (a.movie.vote_count || 0)
        );
      });

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
