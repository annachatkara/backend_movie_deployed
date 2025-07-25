require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

const API_KEY = process.env.API_KEY;

// API endpoints
const API_ENDPOINTS = {
  movie: `https://backend-movie-deployed.onrender.com/api/folder/list?key=${API_KEY}&fld_id=117449&files=1`,
  series: `https://backend-movie-deployed.onrender.com/api/folder/list?key=${API_KEY}&fld_id=117450`,
  anime: `https://backend-movie-deployed.onrender.com/api/folder/list?key=${API_KEY}&fld_id=117451`
};

function decodeHtmlEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
    .replace(/&amp;/g, '&');
}

function parseFldDescrToJson(fld_descr) {
  try {
    const decoded = decodeHtmlEntities(fld_descr);
    return JSON.parse(`{${decoded}}`);
  } catch (e) {
    return null;
  }
}

function cleanTitle(title) {
  return (title || "")
    .replace(/&#[0-9]+;/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/(?:1080P|720P|HDRip|WEB-DL|x264|Leaked|NF|DDP5[\.\d]*|Atmos|to|is|shoes)/gi, '')
    .replace(/Downloaded From.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function enhanceData(data) {
  const movieFiles = data.movie?.result?.files || [];
  movieFiles.forEach(file => {
    const parsed = parseFldDescrToJson(file.description);
    file.parsedDescription = parsed;
  });

  const seriesFolders = data.series?.result?.folders || [];
  seriesFolders.forEach(folder => {
    const parsed = parseFldDescrToJson(folder.fld_descr);
    folder.parsedDescription = parsed;
  });

  const animeFolders = data.anime?.result?.folders || [];
  animeFolders.forEach(folder => {
    const parsed = parseFldDescrToJson(folder.fld_descr);
    folder.parsedDescription = parsed;
  });

  return data;
}

function createContentArray(data) {
  const arr = [];

  (data.movie?.result?.files || []).forEach(file => {
    const d = file.parsedDescription || {};
    const { parsedDescription, ...fileWithoutParsed } = file;
    arr.push({
      ...fileWithoutParsed,
      title: cleanTitle(file.title) || d.name || "",
      type: "movie",
      description: d.description || "",
      poster: d.image || file.thumbnail || "",
      adult: "no",
      videoLink: file.link || "",
      seasons: []
    });
  });

  (data.series?.result?.folders || []).forEach(folder => {
    const d = folder.parsedDescription || {};
    const { parsedDescription, ...folderWithoutParsed } = folder;
    arr.push({
      ...folderWithoutParsed,
      title: d.alternateName || d.name || cleanTitle(folder.name) || "",
      type: "series",
      description: d.description || "",
      poster: d.image || "",
      adult: "no",
      videoLink: "",
      seasons: []
    });
  });

  (data.anime?.result?.folders || []).forEach(folder => {
    const d = folder.parsedDescription || {};
    const { parsedDescription, ...folderWithoutParsed } = folder;
    arr.push({
      ...folderWithoutParsed,
      title: d.name || cleanTitle(folder.name) || "",
      type: "anime",
      description: d.description || "",
      poster: d.image || "",
      adult: "no",
      videoLink: "",
      seasons: []
    });
  });

  return arr;
}
app.get("/", (req, res) => {
  res.send("Server is alive!");
});


setInterval(() => {
  axios.get("https://backend-movie-deployed.onrender.com")
    .then(() => {
      console.log("🔁 Self-ping sent to keep server awake");
    })
    .catch((err) => {
      console.error("⚠️ Self-ping failed:", err.message);
    });
}, 12 * 60 * 1000); // 12 minutes

app.get('/api/content', async (req, res) => {
  const { type } = req.query;

  try {
    let result;

    if (!type) {
      const [movieRes, seriesRes, animeRes] = await Promise.all([
        axios.get(API_ENDPOINTS.movie),
        axios.get(API_ENDPOINTS.series),
        axios.get(API_ENDPOINTS.anime)
      ]);

      result = {
        movie: movieRes.data,
        series: seriesRes.data,
        anime: animeRes.data
      };
    } else {
      const types = type.split(',').map(t => t.trim());
      result = {};

      await Promise.all(
        types.map(async (t) => {
          if (API_ENDPOINTS[t]) {
            const response = await axios.get(API_ENDPOINTS[t]);
            result[t] = response.data;
          }
        })
      );
    }

    enhanceData(result);
    const contentArray = createContentArray(result);
    res.json(contentArray);

  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/get-folder-data/:fldId', async (req, res) => {
  const { fldId } = req.params;
  const apiUrl = `https://backend-movie-deployed.onrender.com/api/folder/list?key=${API_KEY}&fld_id=${fldId}&files=1`;

  try {
    const response = await axios.get(apiUrl);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching folder data:', error.message);
    res.status(500).json({ error: 'Failed to fetch folder data' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
