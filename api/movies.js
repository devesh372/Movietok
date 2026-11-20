
export default async function handler(req, res) {
  try {
    const token = process.env.TMDB_ACCESS_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: "TMDB token is not configured"
      });
    }

    const { query, id } = req.query;

    let endpoint;

    if (id) {
      endpoint =
        `https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}` +
        "?append_to_response=credits,videos,keywords,release_dates,external_ids";

    } else if (query) {
      const params = new URLSearchParams({
        query: query,
        include_adult: "false"
      });

      endpoint =
        `https://api.themoviedb.org/3/search/movie?${params.toString()}`;

    } else {
      endpoint =
        "https://api.themoviedb.org/3/trending/movie/week";
    }

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json"
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "TMDB request failed"
      });
    }

    const data = await response.json();

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      error: "Something went wrong"
    });
  }
}
