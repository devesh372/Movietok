
export default async function handler(req, res) {
  const token = process.env.TMDB_ACCESS_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: "TMDB API token is missing."
    });
  }

  const { query, id, type, movieGenre, tvGenre } = req.query;

  const headers = {
    accept: "application/json",
    Authorization: `Bearer ${token}`
  };

  async function tmdb(path) {
    const response = await fetch(
      `https://api.themoviedb.org/3${path}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`TMDB error: ${response.status}`);
    }

    return response.json();
  }

  try {
    // MOVIE OR TV DETAILS
    if (id) {
      const mediaType = type === "tv" ? "tv" : "movie";

      const details = await tmdb(
        `/${mediaType}/${encodeURIComponent(id)}?append_to_response=credits,videos,keywords,release_dates,external_ids`
      );

      return res.status(200).json({
        ...details,
        media_type: mediaType
      });
    }

    // SEARCH BY GENRE
    if (movieGenre || tvGenre) {
      const requests = [];

      if (movieGenre) {
        requests.push(
          tmdb(
            `/discover/movie?with_genres=${encodeURIComponent(movieGenre)}&sort_by=popularity.desc&include_adult=false&language=en-US&page=1`
          ).then(data =>
            data.results.map(item => ({
              ...item,
              media_type: "movie"
            }))
          )
        );
      }

      if (tvGenre) {
        requests.push(
          tmdb(
            `/discover/tv?with_genres=${encodeURIComponent(tvGenre)}&sort_by=popularity.desc&language=en-US&page=1`
          ).then(data =>
            data.results.map(item => ({
              ...item,
              media_type: "tv"
            }))
          )
        );
      }

      const results = (await Promise.all(requests))
        .flat()
        .sort((a, b) => b.popularity - a.popularity);

      return res.status(200).json({
        results,
        total_results: results.length
      });
    }

    // SEARCH MOVIES AND TV SERIES
    if (query) {
      const encodedQuery = encodeURIComponent(query);

      const [movies, shows] = await Promise.all([
        tmdb(
          `/search/movie?query=${encodedQuery}&include_adult=false&language=en-US&page=1`
        ),
        tmdb(
          `/search/tv?query=${encodedQuery}&language=en-US&page=1`
        )
      ]);

      const results = [
        ...movies.results.map(item => ({
          ...item,
          media_type: "movie"
        })),
        ...shows.results.map(item => ({
          ...item,
          media_type: "tv"
        }))
      ].sort((a, b) => b.popularity - a.popularity);

      return res.status(200).json({
        results,
        total_results: results.length
      });
    }

    // TRENDING MOVIES AND TV SERIES
    const trending = await tmdb(
      "/trending/all/week?language=en-US"
    );

    return res.status(200).json(trending);

  } catch (error) {
    return res.status(500).json({
      error: "Unable to fetch data from TMDB.",
      details: error.message
    });
  }
}
