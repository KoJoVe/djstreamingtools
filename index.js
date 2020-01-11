const axios = require('axios');
const express = require('express');
const qs = require('querystring');

const app = express();
const port = 8080;

const clientId = 'c0cb13fa99664134952779a19b74bff2';
const secredId = '77c5dc80e8c3436aa4079e12f378857d';
const scopes = 'user-read-private user-read-email playlist-read-private';
const encodedScopes = encodeURIComponent(scopes);
const redirect = 'http://localhost:8080/callback';
const encodedRedirect = encodeURIComponent(redirect);
const authUrl = 'https://accounts.spotify.com/authorize';
const loginUrl = `${authUrl}?response_type=code&client_id=${clientId}&scope=${encodedScopes}&redirect_uri=${encodedRedirect}`;

let userInfo = {
  token: '',
  playlists: []
};

const logMessage = (message) => {
  console.log(message);
}

const listPlaylistTrackInfo = (playlist, index = 0) => {
  return new Promise((resolve, reject) => {

    if (playlist.extractedTracks.length < 1) {
      logMessage(`SKIPPED TRACKS INFO FOR PLAYLIST ${playlist.name}`);
      resolve(true);
      return;
    }

    const rejectFn = (error) => {
      logMessage(`AN ERROR HAS OCCURED LOADING TRACK ${playlist.extractedTracks[index].name} INFO FROM PLAYLIST ${playlist.name}`);
      reject(error);
    }
  
    const resolveFn = (data) => {
      logMessage(`SUCCESSFULLY LOADED TRACK ${playlist.extractedTracks[index].name} INFO FROM PLAYLIST ${playlist.name}`);
      playlist.extractedTracks[index].info = data;
      if (index + 1 === playlist.extractedTracks.length) {
        resolve(data);
        return;
      }
      listPlaylistTrackInfo(playlist, index + 1)
        .then(resolve)
        .catch(rejectFn);
    }

    logMessage(`RETRIEVING TRACK ${playlist.extractedTracks[index].name} INFO FROM PLAYLIST ${playlist.name}`);
    axios.get(
      `https://api.spotify.com/v1/audio-features/${playlist.extractedTracks[index].id}`,
      {
        headers: {
          "Authorization": `Bearer ${userInfo.token}`,
          "Content-Type": "application/json"
        }
      })
      .then(resolveFn)
      .catch(rejectFn);

  });
}

const loadTracksInfo = () => {
  return new Promise((resolve, reject) => {

    let index = 0;

    const rejectFn = (error) => {
      logMessage("AN ERROR HAS OCCURED DURING PLAYLISTS TRACK INFO LOADING")
      reject(error);
    }

    const resolveFn = (skip) => {
      if (!skip) {
        logMessage(`SUCCESSFULLY LOADED INFO FOR ALL TRACKS IN PLAYLIST ${userInfo.playlists[index].name}`);
      }

      if (index + 1 === userInfo.playlists.length) {
        logMessage("ALL PLAYLISTS TRACKS INFO LOADED");
        resolve(true);
      } else {
        index += 1;
        logMessage(`RETRIEVING TRACKS INFO FROM PLAYLIST: ${userInfo.playlists[index].name}`);
        listPlaylistTrackInfo(userInfo.playlists[index])
          .then(resolveFn)
          .catch(rejectFn);
      }
    }

    logMessage(`RETRIEVING TRACKS INFO FROM PLAYLIST: ${userInfo.playlists[index].name}`);
    listPlaylistTrackInfo(userInfo.playlists[index])
      .then(resolveFn)
      .catch(rejectFn);

  });
}

const listPlaylistTracks = (playlist, offset = 0) => {
  return new Promise((resolve, reject) => {

    if (playlist.name !== "Balde") {
      logMessage(`SKIPED PLAYLIST ${playlist.name}`);
      resolve(true);
      return;
    }

    const rejectFn = (error) => {
      logMessage(`AN ERROR HAS OCCURED RETRIEVING TRACK PAGE ${offset} FROM PLAYLIST ${playlist.name}`);
      reject(error);
    }

    const resolveFn = (response) => {
      if (!response.data || !Array.isArray(response.data.items)) {
        rejectFn({ message: "SPOTIFY DID NOT RETURN AN ARRAY" });
        return;
      }

      // logMessage(`TRACKS PAGE ${offset} FROM PLAYLIST ${playlist.name} SUCCESSFULLY RETRIEVED`);

      if (response.data.items.length === 0) {
        resolve(response);
      } else if (response.data.items.length > 0) {
        if (!playlist.extractedTracks) {
          playlist.extractedTracks = [];
        }
        playlist.extractedTracks.concat(response.data.items);
        listPlaylistTracks(playlist, offset + 1)
          .then(resolveFn)
          .catch(rejectFn);
      }
    }

    // logMessage(`RETRIEVING TRACKS PAGE ${offset} FROM PLAYLIST: ${playlist.name}`);
    axios.get(
      `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=100&offset=${offset * 100}`,
      {
        headers: {
          "Authorization": `Bearer ${userInfo.token}`,
          "Content-Type": "application/json"
        }
      })
      .then(resolveFn)
      .catch(rejectFn);
  });
}

const loadPlaylistsTracks = () => {
  return new Promise((resolve, reject) => {

    let index = 0;

    const rejectFn = (error) => {
      logMessage("AN ERROR HAS OCCURED DURING PLAYLISTS TRACK LOADING")
      reject(error);
    }

    const resolveFn = (skip) => {
      if (!skip) {
        logMessage(`ALL TRACKS FROM PLAYLIST ${userInfo.playlists[index].name} LOADED`);
      }

      if (index + 1 === userInfo.playlists.length) {
        logMessage("ALL PLAYLISTS TRACKS LOADED");
        loadTracksInfo()
          .then(resolve)
          .catch(rejectFn)
      } else {
        index += 1;
        logMessage(`RETRIEVING TRACKS FROM PLAYLIST: ${userInfo.playlists[index].name}`);
        listPlaylistTracks(userInfo.playlists[index])
          .then(resolveFn)
          .catch(rejectFn);
      }
    }

    logMessage(`RETRIEVING TRACKS FROM PLAYLIST: ${userInfo.playlists[index].name}`);
    listPlaylistTracks(userInfo.playlists[index])
      .then(resolveFn)
      .catch(rejectFn);

  });
}

const listUserPlaylists = (offset = 0) => {
  return new Promise((resolve, reject) => {

    const rejectFn = (error) => {
      logMessage("AN ERROR HAS OCCURED DURING PLAYLISTS GET")
      reject(error);
    }

    const resolveFn = (response) => {
      if (!response.data || !Array.isArray(response.data.items)) {
        rejectFn({ message: "SPOTIFY DID NOT RETURN AN ARRAY" });
        return;
      }

      // logMessage(`PLAYLIST PAGE ${offset} SUCCESSFULLY RETRIEVED`);

      if (response.data.items.length === 0) {
        logMessage("ALL PLAYLISTS RETRIEVED");
        loadPlaylistsTracks()
          .then(resolve)
          .catch(rejectFn);
      } else if (response.data.items.length > 0) {
        userInfo.playlists = userInfo.playlists.concat(response.data.items);
        listUserPlaylists(offset + 1)
          .then(resolveFn)
          .catch(rejectFn);
      }
    }

    // logMessage(`RETRIEVING PLAYLISTS PAGE: ${offset}`);
    axios.get(
      `https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset * 50}`,
      {
        headers: {
          "Authorization": `Bearer ${userInfo.token}`,
          "Content-Type": "application/json"
        }
      })
      .then(resolveFn)
      .catch(rejectFn);
  });
}

const start = () => {
  logMessage("RETREIVEING USER PLAYLISTS");
  return listUserPlaylists();
}

app.get('/callback', (req, res) => {
  const auth =  Buffer.from(clientId + ':' + secredId).toString('base64');
  axios.post("https://accounts.spotify.com/api/token", qs.stringify({
    grant_type: "authorization_code",
    code: req.query.code,
    redirect_uri: redirect
  }), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${auth}`
    }
  }).then(response => {
    res.send('Authorization Succeded. See log for progress status.');
    userInfo.token = response.data.access_token;
    start()
      .then(logMessage)
      .catch(e => logMessage(e.message));
  }).catch(e => {
    logMessage("ERROR CONNECTING TO SPOTIFY AUTHORIZATION");
    logMessage(e.message);
  });
});

app.get('/login', (req, res) => {
  res.redirect(loginUrl);
});

app.listen(port, () => logMessage(`App listening on port ${port}!`));


