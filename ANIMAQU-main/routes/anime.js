const express = require('express');
const router = express.Router();
const axios = require('axios');
const {load} = require('cheerio');
const animeApi = require('../services/animeApi');

router.get('/', async (req, res) => {
  try {
    const [ongoingAnime, completedAnime] = await Promise.all([
      animeApi.getOngoingAnime(),
      animeApi.getCompleteAnime()
    ]);

    res.render('anime', {
      title: 'Anime - Animaqu',
      description: 'Nonton anime subtitle Indonesia',
      ongoingAnime: ongoingAnime.data,
      completedAnime: completedAnime.data,
      currentPage: 'anime'
    });
  } catch (error) {
    console.error('Anime page error:', error);
    res.status(500).render('error', {
      title: 'Terjadi Kesalahan - Animaqu',
      error: {
        status: 500,
        message: 'Tidak dapat memuat halaman anime'
      }
    });
  }
});

router.get('/ongoing', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const ongoingAnime = await animeApi.getOngoingAnime(page);

    res.render('anime-ongoing', {
      title: 'Ongoing Anime - Animaqu',
      description: 'Nonton anime ongoing subtitle Indonesia',
      animeList: ongoingAnime.data,
      pagination: ongoingAnime.pagination,
      currentPage: 'anime'
    });
  } catch (error) {
    console.error('Ongoing anime page error:', error);
    res.status(500).render('error', {
      title: 'Terjadi Kesalahan - Animaqu',
      error: {
        status: 500,
        message: 'Tidak dapat memuat halaman anime ongoing'
      }
    });
  }
});

router.get('/complete', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const completedAnime = await animeApi.getCompleteAnime(page);

    res.render('anime-complete', {
      title: 'Completed Anime - Animaqu',
      description: 'Nonton anime completed subtitle Indonesia',
      animeList: completedAnime.data,
      pagination: completedAnime.pagination,
      currentPage: 'anime'
    });
  } catch (error) {
    console.error('Completed anime page error:', error);
    res.status(500).render('error', {
      title: 'Terjadi Kesalahan - Animaqu',
      error: {
        status: 500,
        message: 'Tidak dapat memuat halaman anime completed'
      }
    });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const animeData = await animeApi.getAnimeDetails(slug);

    if (!animeData) {
      return res.status(404).render('error', {
        title: 'Anime Tidak Ditemukan - Animaqu',
        error: {
          status: 404,
          message: 'Anime yang Anda cari tidak ditemukan'
        }
      });
    }

    const sanitizedAnime = animeApi.validateAnimeData(animeData, slug);
    const clean = sanitizedAnime.episodes.map(ep => {
      const match = ep.episode.match(/Episode\s+(\d+)/i);
      const num = match ? match[1] : null;

      return {
        ...ep,
        episode: num
      };
    });
    sanitizedAnime.episodes = clean;
    res.render('anime-detail', {
      title: `${sanitizedAnime.title} - Animaqu`,
      description: sanitizedAnime.synopsis ?
        sanitizedAnime.synopsis.substring(0, 160) + '...' :
        `Nonton ${sanitizedAnime.title} subtitle Indonesia`,
      anime: sanitizedAnime,
      currentPage: 'anime'
    });
  } catch (error) {
    console.error('Anime detail page error:', error);
    res.status(500).render('error', {
      title: 'Terjadi Kesalahan - Animaqu',
      error: {
        status: 500,
        message: 'Tidak dapat memuat detail anime'
      }
    });
  }
});

router.get('/:slug/episodes', async (req, res) => {
  try {
    const slug = req.params.slug;
    const [animeData, episodesData] = await Promise.all([
      animeApi.getAnimeDetails(slug),
      animeApi.getAnimeEpisodes(slug)
    ]);

    if (!animeData) {
      return res.status(404).render('error', {
        title: 'Anime Tidak Ditemukan - Animaqu',
        error: {
          status: 404,
          message: 'Anime yang Anda cari tidak ditemukan'
        }
      });
    }

    const sanitizedAnime = animeApi.validateAnimeData(animeData, slug);
    const clean = sanitizedAnime.episodes.map(ep => {
      const match = ep.episode.match(/Episode\s+(\d+)/i);
      const num = match ? match[1] : null;

      return {
        ...ep,
        episode: num
      };
    });
    res.render('anime-episodes', {
      title: `Episode ${sanitizedAnime.title} - Animaqu`,
      description: `Daftar episode ${sanitizedAnime.title} subtitle Indonesia`,
      anime: sanitizedAnime,
      episodes: clean || [],
      currentPage: 'anime'
    });
  } catch (error) {
    console.error('Anime episodes page error:', error);
    res.status(500).render('error', {
      title: 'Terjadi Kesalahan - Animaqu',
      error: {
        status: 500,
        message: 'Tidak dapat memuat daftar episode'
      }
    });
  }
});

router.get('/:slug/episode/:episode', async (req, res) => {
  try {
    const slug = req.params.slug;
    const episodeNumber = req.params.episode;

    const [animeData, episodeData] = await Promise.all([
      animeApi.getAnimeDetails(slug),
      animeApi.getEpisodeDetails(slug, episodeNumber)
    ]);

    if (!animeData || !episodeData) {
      return res.status(404).render('error', {
        title: 'Episode Tidak Ditemukan - Animaqu',
        error: {
          status: 404,
          message: 'Episode yang Anda cari tidak ditemukan'
        }
      });
    }

    const sanitizedAnime = animeApi.validateAnimeData(animeData, slug);

    const allEpisodes = episodeData.all_episodes || [];
    const currentEpisodeIndex = allEpisodes.findIndex(ep =>
      ep.episode_number == episodeNumber
    );
    const getEpisodeDetails = await animeApi.getEpisodeDetails(slug, episodeNumber);
    console.log(episodeData.next_episode);
    const modifiedStreamList = {};
    var qlist = [];
    for (const quality in getEpisodeDetails.steramList) {
      qlist.push(parseInt(quality.replace('p', '')));
      modifiedStreamList[parseInt(quality.replace('p', ''))] = `${getEpisodeDetails.steramList[quality]}`;
    }
    if(Object.keys(getEpisodeDetails.steramList).length == 0 || getEpisodeDetails.steramList['720'] == null){
      qlist.push('480');
      modifiedStreamList['480'] = getEpisodeDetails.stream_url;
    }
    if(!modifiedStreamList['480']){
      modifiedStreamList['480'] = getEpisodeDetails.stream_url;
    }
    console.log(modifiedStreamList)
    
    var episodeDatas = {
        title: `${sanitizedAnime.title} Episode ${episodeNumber} - Animaqu`,
        description: `Nonton ${sanitizedAnime.title} Episode ${episodeNumber} subtitle Indonesia`,
        anime: sanitizedAnime,
        episode: {
          number: episodeNumber,
          title: episodeData.episode_title || `Episode ${episodeNumber}`,
          video_sources: getEpisodeDetails.stream_url || [],
          qlist,
          quality: modifiedStreamList || [],
          subtitles: episodeData.stream_url || [],
          download_links: getEpisodeDetails.download_urls || []
        },
        navigation: {
          isNext: episodeData.has_next_episode,
          isPrev: episodeData.has_previous_episode,
          prev: episodeData.previous_episode,
          next: episodeData.next_episode,
          all_episodes: sanitizedAnime.episodes
        },
        currentPage: 'anime'
    }
    res.render('episode-player', episodeDatas);
  } catch (error) {
    console.error('Episode player page error:', error);
    res.status(500).render('error', {
      title: 'Terjadi Kesalahan - Animaqu',
      error: {
        status: 500,
        message: 'Tidak dapat memuat episode'
      }
    });
  }
});

router.get('/:slug/batch', async (req, res) => {
  try {
    const slug = req.params.slug;
    const animeData = await animeApi.getAnimeDetails(slug);

    if (!animeData) {
      return res.status(404).render('error', {
        title: 'Anime Tidak Ditemukan - Animaqu',
        error: {
          status: 404,
          message: 'Anime yang Anda cari tidak ditemukan'
        }
      });
    }

    const sanitizedAnime = animeApi.validateAnimeData(animeData, slug);

    res.render('anime-batch', {
      title: `Download Batch ${sanitizedAnime.title} - Animaqu`,
      description: `Download batch ${sanitizedAnime.title} subtitle Indonesia`,
      anime: sanitizedAnime,
      batchLinks: animeData.batch_links || [],
      currentPage: 'anime'
    });
  } catch (error) {
    console.error('Batch download page error:', error);
    res.status(500).render('error', {
      title: 'Terjadi Kesalahan - Animaqu',
      error: {
        status: 500,
        message: 'Tidak dapat memuat halaman batch download'
      }
    });
  }
});

module.exports = router;
