import Path from 'path';
import yaml from 'yaml';
import localforage from 'localforage';
import { setup } from 'axios-cache-adapter';
import JSZip from 'jszip';
import _ from "lodash";

const baseURL = 'https://git.door43.org/';
const apiPath = 'api/v1';

const repoDefaultMap = {
  // format is organization and then repoName
  hbo: {
    UHB: "unfoldingWord/hbo_uhb",
  },
  'el-x-koine': {
    UGNT: "unfoldingWord/el-x-koine_ugnt",
  },
  en: {
    label: "English (unfoldingWord)",
    UHB: "unfoldingWord/hbo_uhb",
    UGNT: "unfoldingWord/el-x-koine_ugnt",
    TA: "unfoldingWord/en_ta",
    TN: "unfoldingWord/en_tn",
    TW: "unfoldingWord/en_tw",
    TQ: "unfoldingWord/en_tq",
    ST: "unfoldingWord/en_ust",
    LT: "unfoldingWord/en_ult",
  },
  hi: {
    label: "Hindi (translationCore-Create-BCS)",
    UHB: "unfoldingWord/hbo_uhb",
    UGNT: "unfoldingWord/el-x-koine_ugnt",
    TA: "translationCore-Create-BCS/hi_ta",
    TN: "translationCore-Create-BCS/hi_tn",
    TW: "translationCore-Create-BCS/hi_tw",
    TQ: "translationCore-Create-BCS/hi_tq",
    ST: "translationCore-Create-BCS/hi_gst",
    LT: "translationCore-Create-BCS/hi_glt",
  },
  kn: {
    label: "Kannada (translationCore-Create-BCS)",
    UHB: "unfoldingWord/hbo_uhb",
    UGNT: "unfoldingWord/el-x-koine_ugnt",
    TA: "translationCore-Create-BCS/kn_ta",
    TN: "translationCore-Create-BCS/kn_tn",
    TW: "translationCore-Create-BCS/kn_tw",
    TQ: "translationCore-Create-BCS/kn_tq",
    ST: "translationCore-Create-BCS/kn_gst",
    LT: "translationCore-Create-BCS/kn_glt",
  },
  'es-419': {
    label: "Latin-American Spanish (Es-419_gl)",
    UHB: "unfoldingWord/hbo_uhb",
    UGNT: "unfoldingWord/el-x-koine_ugnt",
    TA: "Es-419_gl/es-419_ta",
    TN: "Es-419_gl/es-419_tn",
    TW: "Es-419_gl/es-419_tw",
    TQ: "Es-419_gl/es-419_tq",
    ST: "Es-419_gl/es-419_gst",
    LT: "Es-419_gl/es-419_glt",
  },
  ru: {
    label: "Russian (ru_gl)",
    UHB: "unfoldingWord/hbo_uhb",
    UGNT: "unfoldingWord/el-x-koine_ugnt",
    TA: "ru_gl/ru_ta",
    TN: "ru_gl/ru_tn",
    TW: "ru_gl/ru_tw",
    TQ: "ru_gl/ru_tq",
    ST: "ru_gl/ru_rsob",
    LT: "ru_gl/ru_rlob",
  }
};

let repoMap = repoDefaultMap;

/**
 * initialize repo map to new value or reset to default
 * @param {object} newRepoMap - defaults to defaultRepoMap
 * @return {*}
 */
export function initRepoMap(newRepoMap = repoDefaultMap) {
  //console.log(`initRepoMap() - setting repo map to ${JSON.stringify(newRepoMap)}`)
  repoMap = _.cloneDeep(newRepoMap);
}

/**
 * find settings for the language
 * @return {object} current repoMap
 */
export function getRepoMap() {
  return _.cloneDeep(repoMap);
}

/**
 * verify existence valid repo manifest - missing repos are added to error
 * @param {string} username
 * @param {string} repository
 * @param {Array} errors
 * @param {string} repoType
 * @param {string} language
 * @param {string} ref
 * @return {Promise<Array>}
 */
export async function verifyRepo(username, repository, errors, repoType, language, ref = 'master') {
  console.log(`verifyRepo(${username}, ${repository}, ${repoType}, ${language})`)
  // verify that repo exists and that it has a manifest
  let { repoExists, manifestValid } = await verifyManifest({ username, repository });
  let manifestFound = manifestValid, repoFound = repoExists, manifestParseFailed = false;

  let message;

  if ( repoFound ) {
    // check if repo manifest exists
    const manifestContents = await getFileCached({ username, repository, path: 'manifest.yaml', ref });
    if (manifestContents) {
      manifestFound = true;
      // see if manifest is parseable
      const manifestJSON = await cachedGetManifest({ username, repository, ref });
      if (manifestJSON) {
        manifestParseFailed = false;
        // see if manifest is minimally sufficient
        if (manifestJSON.projects && manifestJSON.projects.length) {
          manifestValid = true;
          message = 'repo and manifest OK';
        } else {
          manifestValid = false;
          message = 'manifest is imcomplete';
        }
        errors.push({repoType, 
          username,
          repository,
          language,
          message, 
          manifestFound, 
          manifestValid, 
          manifestParseFailed, 
          repoFound
        });
      } else {
        manifestParseFailed = true;
        message = 'manifest is not parseable';
        errors.push({repoType, 
          username,
          repository,
          language,
          message, 
          manifestFound, 
          manifestValid, 
          manifestParseFailed, 
          repoFound
        });
      }
    } else {
      message = 'manifest is missing';
      errors.push({repoType, 
        username,
        repository,
        language,
        message, 
        manifestFound, 
        manifestValid, 
        manifestParseFailed, 
        repoFound
      });
    }
  } else {
    message = 'repo does not exist';
    errors.push({repoType, 
      username,
      repository,
      language,
      message, 
      manifestFound, 
      manifestValid, 
      manifestParseFailed, 
      repoFound
    });
  } 
  return errors;

}

/**
 * check server to see if repository with valid manifest exists on server.
 * @param {string} username
 * @param {string} repository
 * @return {Promise<{repoExists: boolean, manifestValid: boolean}>}
 */
async function verifyManifest({ username, repository }) {

  const params = { };
  // console.log(`repositoryExists params=${JSON.stringify(params)}`);
  // https://git.door43.org/api/v1/repos/unfoldingword/en_tq
  const uri = Path.join(apiPath, 'repos', username, repository);
  // console.log(`repositoryExists uri=${uri}`);
  let response, repoExists = false, manifestValid = false;
  try {
    response = await cachedGet({uri, params});
    if (response) {
      repoExists = true;
      if (!response.subject) {
        manifestValid = false;
      } else {
        manifestValid = true;
      }
    } else {
      repoExists = false;
    }
  } catch (e) {
    repoExists = false;
    if (e && e.response && (e.response.status === 404)) {
      console.log(`verifyManifest(${username}, ${repository}) - repo does not exist`);
    } else {
      console.error(`verifyManifest(${username}, ${repository}) - query error`, e);
    }
  }
  return { repoExists, manifestValid };
}

/**
 * make sure we find repos on DCS for a language
 * @param {string} username
 * @param {string} language
 * @param {Array} repoTypes
 * @param {string} ref
 * @return {Promise<Array>} list of repo types that were not found on DCS
 */
export async function verifyRepos(username, language, repoTypes, ref = 'master') {
  const errors = [];
  const promises = [];
  const startTime = new Date();
  for (let repoType of repoTypes) {
    const path = findPathForRepo(username, language, repoType, repoType);
    if (!path) {
      errors.push({ repoType, message: `could not find path for ${language}/${repoType}`});
      continue;
    }
    let orgName, repo;
    [ orgName, repo ] = path.split('/');
    // console.log(`verifying ${path}`)
    promises.push(verifyRepo(orgName, repo, errors, repoType, language, ref)); // run each check in parallel
  }
  await Promise.all(promises); // wait for all repos to be verified
  if (errors.length) {
    //console.log(`verifyRepos(${username}, ${language}, ${JSON.stringify(repoTypes)}) - missing repos for ${JSON.stringify(errors)}`)
  }
  const elapsedSeconds = (new Date() - startTime) / 1000; // seconds
  console.log(`verifyRepos(${username}, ${language}..) finished ${elapsedSeconds} seconds`);
  return errors;
}

/**
 * make sure we find repos on DCS for all languages
 * @param {string} username
 * @param {Array} repoTypes
 * @param {Object} results
 * @param {string} ref
 * @return {Promise<*>} list of repo types that were not found on DCS
 */
export async function verifyReposForLanguages(username, repoTypes, results, ref = 'master') {
  const startTime = new Date();
  const promises = [];
  results.finished = false;
  for (let langID of Object.keys(repoMap)) {
    if (!repoMap[langID].label) { // don't validate languages that don't have a label
      continue;
    }
    const langResults = {
      finished: false,
    };
    results[langID] = langResults;
    promises.push(verifyRepos(username, langID, repoTypes, ref ).then((errors) => {
      langResults.finished = true;
      langResults.errors = errors;
    }));
  }
  await Promise.all(promises); // wait for all repos to be verified
  results.finished = true;
  const elapsedSeconds = (new Date() - startTime) / 1000; // seconds
  console.log(`verifyReposForLanguages() finished in ${elapsedSeconds} seconds`);
}

/**
 * change the path for the repo
 * @param {string} language
 * @param {string} repoType
 * @param {string} username
 * @param {string} repoName
 */
export function setPathForRepo(language, repoType, username, repoName) {
  //    console.log(`setPathForRepo('${username}', '${repo}')…`);
  let path;
  const { langRepos } = findSettingsForLanguage(repoType, language);
  if (langRepos) {
    langRepos[repoType] = `${username}/${repoName}`;
    //console.error(`setPathForRepo(${language}, ${repoType}) - setting repo path to ${langRepos[repoType]}`);
    return
  }
  //console.error(`setPathForRepo(${language}, ${repoType}) - cannot find repo path`);
  return path;
}

/**
 * find settings for the language
 * @param {string} language
 * @param {string} repoType
 * @return {*}
 */
function findSettingsForLanguage(repoType, language) {
  repoType = repoType.toUpperCase();
  if (['ULT', 'GLT'].includes(repoType)) repoType = 'LT';
  if (['UST', 'GST'].includes(repoType)) repoType = 'ST';
  const langRepos = repoMap[language.toLowerCase()];
  return {repoType, langRepos};
}

/**
 * look up the username/repoName for the repo based on language
 * @param {string} language
 * @param {string} repoType
 * @return {string}
 */
export function findPathForRepo(username, language, repoType, repoName) {
  //    console.log(`findPathForRepo('${language}', '${repoType}')…`);
  const { langRepos, repoType: repoType_ } = findSettingsForLanguage(repoType, language);
  if (langRepos) {
    const location = langRepos[repoType_];
    if (location) {
      return location;
    }
  }
  //console.log(`findPathForRepo(${language}, ${repoType}) - not overriding default`);
  return `${username}/${repoName}`; // fall back to original
}

/**
 *
 * @param {string} username
 * @param {string} repoName (e.g. hi_tn)
 * @return {{username: string, repoName: string}} username and repoName to use
 */
export function getOverridesForRepo(username, repoName) {
  //    console.log(`getOverridesForRepo('${username}', '${repo}')…`);
  // const originalUsername = username;
  const divider = repoName.indexOf('_');
  if (divider >= 0) {
    const language = repoName.substr(0, divider);
    const repoType = repoName.substr(divider + 1);
    const path = findPathForRepo(username, language, repoType, repoName);
    if (path) {
      [username, repoName] = path.split('/');
    }
  }

  // if (username.toLowerCase() !== originalUsername.toLowerCase()) {
  //   console.log(`getOverridesForRepo('${originalUsername}', '${repoName}') - changing username to ${username}`);
  // }
  return { username, repoName };
}

// caches failed http file fetches so we don't waste time with repeated attempts
const failedStore = localforage.createInstance({
  driver: [localforage.INDEXEDDB],
  name: 'failed-store',
});

// caches zip file fetches done by fetchRepositoryZipFile()
const zipStore = localforage.createInstance({
  driver: [localforage.INDEXEDDB],
  name: 'zip-store',
});

// caches http file fetches done by fetchFileFromServer()
const cacheStore = localforage.createInstance({
  driver: [localforage.INDEXEDDB],
  name: 'web-cache',
});

// caches the unzipped files requested so we don't do repeated unzipping of the same file which is slow in JS
const unzipStore = localforage.createInstance({
  driver: [localforage.INDEXEDDB],
  name: 'unzip-store',
});


// API for http requests
const Door43Api = setup({
  baseURL: baseURL,
  cache: {
    store: cacheStore,
    maxAge: 5 * 60 * 1000, // 5-minutes
    exclude: { query: false },
    key: req => {
      // if (req.params) debugger
      let serialized = req.params instanceof URLSearchParams ?
        req.params.toString() : JSON.stringify(req.params) || '';
      return req.url + serialized;
    },
  },
});

/**
 * try to get previously unzipped file from cache
 * @param {string} path
 * @return {Promise<unknown>} resolves to file contents or null if not found
 */
export async function getUnZippedFile(path) {
  // console.log(`getUnZippedFile(${path})`);
  const contents = await unzipStore.getItem(path.toLowerCase());
  return contents;
}

/**
 * searches for files in this order:
 *   - cache of uncompressed files (unzipStore)
 *   - cache of zipped repos (zipStore)
 *   - and finally calls fetchFileFromServer() which firts checks in cacheStore to see if already fetched.
 * @param {String} username
 * @param {String} repository
 * @param {String} path
 * @param {String} ref
 * @return {Promise<*>}
 */
export async function getFileCached({ username, repository, path, ref }) {

  const { username: username_, repoName } = getOverridesForRepo(username, repository);
  username = username_;
  repository = repoName;

  const filePath = Path.join(username, repository, ref, path);
  // console.log(`getFileCached(${username}, ${repository}, ${path}, ${ref})…`);
  let contents = await getUnZippedFile(filePath);
  if (contents) {
    // console.log(`in cache - ${filePath}`);
    return contents;
  }

  contents = await getFileFromZip({ username, repository, path, ref });
  if (!contents) {
    contents = await fetchFileFromServer({ username, repository, path, ref });
  }

  if (contents) {
    // save unzipped file in cache to speed later retrieval
    await unzipStore.setItem(filePath.toLowerCase(), contents);
    // console.log(`saving to cache - ${filePath}`);
  } else {
    console.log(`getFileCached(${username}, ${repository}, ${path}, ${ref}) - failed to get file`);
  }

  return contents;
}

/**
 * Retrieve manifest.yaml from requested repo
 * @param {string} username
 * @param {string} repository
 * @param {string} ref
 * @return {Promise<[]|*[]>} resolves to manifest contents if downloaded (else undefined)
 */
export async function cachedGetManifest({ username, repository, ref }) {
  // console.log(`cachedGetManifest(${username}, ${repository}, ${ref})…`);
  const manifestContents = await getFileCached({ username, repository, path: 'manifest.yaml', ref });
  let formData;
  try {
    formData = yaml.parse(manifestContents);
    // console.log("yaml.parse(YAMLText) got formData", JSON.stringify(formData));
  }
  catch (yamlError) {
    console.error(`${username} ${repository} ${ref} manifest yaml parse error: ${yamlError.message}`);
  }
  return formData;
}


/**
 * Retrieve manifest.yaml from requested repo
 * @param {string} username
 * @param {string} repository
 * @param {string} ref
 * @param {string} bookID -- 3-character USFM book code
 * @return {Promise<[]|*[]>} resolves to filename from the manifest for the book (else undefined)
 */
export async function cachedGetBookFilenameFromManifest({ username, repository, ref, bookID }) {
  // console.log(`cachedGetBookFilenameFromManifest(${username}, ${repository}, ${ref}, ${bookID})…`);
  const manifestJSON = await cachedGetManifest({ username, repository, ref });
  for (const projectEntry of manifestJSON.projects) {
    if (projectEntry.identifier === bookID) {
      let bookPath = projectEntry.path;
      if (bookPath.startsWith('./')) bookPath = bookPath.substring(2);
      return bookPath;
    }
  }
}

/**
 * clear all the stores
 * @return {Promise<void>}
 */
export async function clearCaches() {
  //console.log("Clearing localforage.INDEXEDDB zipStore, cacheStore, etc. caches…");
  // const tasks = [zipStore, cacheStore].map(localforage.clear);
  // const results = await Promise.all(tasks);
  // results.forEach(x => console.log("Done it", x));
  await failedStore.clear();
  await zipStore.clear();
  await cacheStore.clear();
  await unzipStore.clear();
}

/**
 * @description - Forms and returns a Door43 repoName string
 * @param {String} languageCode - the language code, e.g., 'en'
 * @param {String} repoCode - the repo code, e.g., 'TQ'
 * @return {String} - the Door43 repoName string
 */
export function formRepoName(languageCode, repoCode) {
  //    console.log(`formRepoName('${languageCode}', '${repoCode}')…`);
  repoCode = repoCode.toUpperCase();

  // TODO: Should we also check the username 'unfoldingWord' and/or 'Door43-Catalog' here???
  //        (We don't currently have the username available in this function.)
  if (repoCode === 'LT') repoCode = languageCode === 'en' ? 'ULT' : 'GLT';
  if (repoCode === 'ST') repoCode = languageCode === 'en' ? 'UST' : 'GST';

  let repo_languageCode = languageCode;
  if (repoCode === 'UHB') repo_languageCode = 'hbo';
  else if (repoCode === 'UGNT') repo_languageCode = 'el-x-koine';
  const repoName = `${repo_languageCode}_${repoCode.toLowerCase()}`;
  return repoName;
}

/**
 * add new repo to list if missing
 * @param {string} repos
 * @param {string} newRepo
 * @param {boolean} addToStart - if true add to start
 */
function addIfMissing(repos, newRepo, addToStart = true) {
  if (!repos.includes(newRepo)) {
    if (addToStart) {
      repos.unshift(newRepo);
    } else {
      repos.push(newRepo);
    }
  }
}

/**
 * preloads repo zips, before running book package checks.
 *   TRICKY: note that even if the user is super fast in selecting books and clicking next, it will not hurt anything.  getFile() would just be fetching files directly from repo until the zips are loaded.  After that the files would be pulled out of zipStore.
 * @param {string} username
 * @param {string} languageCode
 * @param {string} ref - optional, defaults to master
 * @param {Array} repos - optional, list of additional repos to pre-load
 * @param {boolean} loadOriginalLangs - if true will download original language books
 * @param {boolean} loadUltAndUst
 * @return {Promise<Boolean>} resolves to true if file loads are successful
 */
export async function PreLoadRepos(username, languageCode, ref = 'master', repos = [],
                                   loadOriginalLangs = false,
                                   loadUltAndUst = false) {
  //console.log(`PreLoadRepos(${username}, ${languageCode}, ${ref}, ${repos}, ${loadOriginalLangs})…`);

  let success = true;
  const repos_ = repos.map((repo) => (formRepoName(languageCode, repo)));

  if (loadOriginalLangs) {
    // make sure we have the original languages needed
    for (const origLangBibles of [ 'UHB', 'UGNT' ]) {
      addIfMissing(repos_, formRepoName(languageCode, origLangBibles), true);
    }
  }

  if (loadUltAndUst) {
    const LT = languageCode === 'en' ? 'ULT' : 'GLT';
    const ST = languageCode === 'en' ? 'UST' : 'GST';
    addIfMissing(repos_, formRepoName(languageCode, LT), false);
    addIfMissing(repos_, formRepoName(languageCode, ST), false);
  }

  // load all the repos needed
  for (const repoName of repos_) {
    //console.log(`PreLoadRepos: preloading zip file for ${repoName}…`);
    const zipFetchSucceeded = await fetchRepositoryZipFile({ username, repository: repoName, ref });
    if (!zipFetchSucceeded) {
      //console.log(`PreLoadRepos: misfetched zip file for ${repoName} repo with ${zipFetchSucceeded}`);
      success = false;
    }
  }

  return success;
}

/**
 * does http file fetch from server  uses cacheStore to minimize repeated fetches of same file
 * @param {string} username
 * @param {string} repository
 * @param {string} path
 * @param {string} ref
 * @return {Promise<null|any>} resolves to file content
 */
async function fetchFileFromServer({ username, repository, path, ref = 'master' }) {
  //console.log(`fetchFileFromServer(${username}, ${repository}, ${path}, ${ref})…`);
  const uri = Path.join(username, repository, 'raw/ref', ref, path);
  const failMessage = await failedStore.getItem(uri.toLowerCase());
  if (failMessage) {
    // console.log(`fetchFileFromServer failed previously for ${uri}: ${failMessage}`);
    return null;
  }
  try {
    // console.log("URI=",uri);
    const data = await cachedGet({ uri });
    // console.log("Got data", data);
    return data;
  }
  catch (fffsError) {
    console.log(`ERROR: fetchFileFromServer could not fetch ${path}: ${fffsError}`)
    /* await */ failedStore.setItem(uri.toLowerCase(), fffsError.message);
    return null;
  }
}

/**
 *  older getFile without that doesn't use the unzipStore
 * @param {string} username
 * @param {string} repository
 * @param {string} path
 * @param {string} ref
 * @return {Promise<*>}
 */
// eslint-disable-next-line no-unused-vars
async function getFile({ username, repository, path, ref }) {
  //console.log(`getFile(${username}, ${repository}, ${path}, ${ref})…`);
  let file;
  file = await getFileFromZip({ username, repository, path, ref });
  if (!file) {
    file = await fetchFileFromServer({ username, repository, path, ref });
  }
  return file;
}

// async function getUID({ username }) {
//   // console.log(`getUID(${username})…`);
//   const uri = Path.join(apiPath, 'users', username);
//   // console.log(`getUID uri=${uri}`);
//   const user = await cachedGet({ uri });
//   // console.log(`getUID user=${user}`);
//   const { id: uid } = user;
//   // console.log(`  getUID returning: ${uid}`);
//   return uid;
// }

/**
 * check server to see if repository exists on server.  Do this before we try to download
 * @param {string} username
 * @param {string} repository
 * @return {Promise<boolean>}
 */
// eslint-disable-next-line no-unused-vars
async function repositoryExists({ username, repository }) {
  // console.log(`repositoryExists(${username}, ${repository})…`);
  // https://qa.door43.org/api/v1/repos/search?repo=kn_tn&owner=translationCore-Create-BCS
  // TODO: we probably want to change this to do paging since we cannot be sure of future size limits on fetches
  const params = { repo: repository, owner: username };
  // console.log(`repositoryExists params=${JSON.stringify(params)}`);
  const uri = Path.join(apiPath, 'repos', `search`);
  // console.log(`repositoryExists uri=${uri}`);
  const { data: repos } = await cachedGet({ uri, params });
  // console.log(`repositoryExists repos (${repos.length})=${repos}`);
  // for (const thisRepo of repos) console.log(`  thisRepo (${JSON.stringify(Object.keys(thisRepo))}) =${JSON.stringify(thisRepo.name)}`);
  const match = `${username}/${repository}`.toLowerCase();
  const repoList = repos.filter(repo => repo.full_name.toLowerCase() === match);
  const repo = repoList[0];
  // console.log(`repositoryExists repo=${repo}`);
  // console.log(`  repositoryExists returning: ${!!repo}`);
  if (!repo) {
    console.log(`repositoryExists(${username}, ${repository}) - repo not found`, repos, repoList);
  }
  return !!repo;
}

async function cachedGet({ uri, params }) {
  // console.log(`cachedGet(${uri}, ${JSON.stringify(params)})…`);
  // console.log(`  get querying: ${baseURL+uri}`);
  const { data } = await Door43Api.get(baseURL + uri, { params });
  // console.log(`  cachedGet returning: ${JSON.stringify(data)}`);
  return data;
}

export async function cachedGetURL({ uri, params }) {
  // console.log(`cachedGetURL(${uri}, ${params})…`);
  const { data } = await Door43Api.get(uri, { params });
  // console.log(`  cachedGetURL returning: ${data}`);
  return data;
}

/*
function fetchRepositoriesZipFiles({username, languageId, ref}) {
  const repositories = resourceRepositories({languageId});
  const promises = Object.values(repositories).map(repository => {
    return fetchRepositoryZipFile({username, repository, ref});
  });
  const zipArray = await Promise.all(promises);
  return zipArray;
};
*/


/**
 * retrieve repo as zip file
 * @param {string} username
 * @param {string} repository
 * @param {string} ref
 * @param {boolean} forceLoad - if not true, then use existing repo in zipstore
 * @return {Promise<[]|*[]>} resolves to true if downloaded
 */
export async function fetchRepositoryZipFile({ username, repository, ref }, forceLoad = false) {
  // https://git.door43.org/{username}/{repository}/archive/{ref}.zip
  //console.log(`fetchRepositoryZipFile(${username}, ${repository}, ${ref})…`);

  const { username: username_, repoName } = getOverridesForRepo(username, repository);
  username = username_;
  repository = repoName;

  if (!forceLoad) { // see if we already have in zipStore
    const zipBlob = await getZipFromStore(username, repository, ref);
    if (zipBlob) {
      //console.log(`fetchRepositoryZipFile(${username}, ${repository}, ${ref})… - already loaded`);
      return true;
    }
  }

  const uri = zipUri({ username, repository, ref });
  const response = await fetch(uri);
  if (response.status === 200 || response.status === 0) {
    const zipArrayBuffer = await response.arrayBuffer(); // blob storage not supported on mobile
    //console.log(`fetchRepositoryZipFile(${username}, ${repository}, ${ref}) - saving zip: ${uri}`);
    await zipStore.setItem(uri.toLowerCase(), zipArrayBuffer);
    return true;
  } else {
    //console.log(`fetchRepositoryZipFile(${username}, ${repository}, ${ref}) - got response status: ${response.status}`);
    return false;
  }
}

/**
 * pull repo from zipstore and get a file list
 * @param {string} username
 * @param {string} repository
 * @param {string} ref
 * @param {string} optionalPrefix - to filter by book, etc.
 * @return {Promise<[]>}  resolves to file list
 */
export async function getFileListFromZip({ username, repository, ref, optionalPrefix }) {
  // console.log(`getFileListFromZip(${username}, ${repository}, ${ref}, ${optionalPrefix})…`);

  const { username: username_, repoName } = getOverridesForRepo(username, repository);
  username = username_;
  repository = repoName;

  const uri = zipUri({ username, repository, ref });
  let zipBlob = await getZipFromStore(username, repository, ref);

  if (!zipBlob) { // Seems that we need to load the zip file first
    const response = await fetch(uri);
    if (response.status === 200 || response.status === 0) {
      const zipArrayBuffer = await response.arrayBuffer(); // blob storage not supported on mobile
      zipBlob = await zipStore.setItem(uri.toLowerCase(), zipArrayBuffer);
    } else {
      //console.log(`ERROR: getFilelistFromZip got response status: ${response.status}`);
      return [];
    }
  }

  const pathList = [];
  try {
    if (zipBlob) {
      // console.log(`  Got zipBlob for uri=${uri}`);
      const zip = await JSZip.loadAsync(zipBlob);
      // console.log(`  Got zip`);
      // Now we need to fetch the list of files from the repo
      // zip.forEach(function (relativePath, fileObject) {
      zip.forEach(function (relativePath) {
        // console.log(`relPath=${relativePath}`)
        // consoleLogObject('fileObject', fileObject);
        if (!relativePath.endsWith('/')) // it's not a folder
        {
          if (relativePath.startsWith(`${repository}/`)) // remove repo name prefix
            relativePath = relativePath.substring(repository.length + 1);
          if (relativePath.length
            && !relativePath.startsWith('.git') // skips files in these folders
            && !relativePath.startsWith('.apps') // skips files in this folder
            && (!optionalPrefix || relativePath.toLowerCase().startsWith(optionalPrefix))) // it's the correct prefix
            pathList.push(relativePath);
        }
      })
    }
    // else console.log("  getFileListFromZip: No zipBlob");
  } catch (error) {
    console.log(`ERROR: getFilelistFromZip got: ${error.message}`);
  }

  // console.log(`getFileListFromZip is returning (${pathList.length}) entries: ${pathList}`);
  return pathList;
}

/**
 * try to get zip file from cache
 * @param {string} username
 * @param {string} repository
 * @param {string} ref
 * @return {Promise<unknown>} resolves to null if not found
 */
export async function getZipFromStore(username, repository, ref) {
  const uri = zipUri({username, repository, ref});
  const zipBlob = await zipStore.getItem(uri.toLowerCase());
  // console.log(`getZipFromStore(${uri} - empty: ${!zipBlob}`);
  return zipBlob;
}

/**
 * pull repo from zipstore and get the unzipped file
 * @param {string} username
 * @param {string} repository
 * @param {string} ref
 * @param {object} optionalPrefix
 * @return {Promise<[]|null>} resolves to unzipped file if found or null
 */
async function getFileFromZip({ username, repository, path, ref }) {
  // console.log(`getFileFromZip(${username}, ${repository}, ${path}, ${ref})…`);
  let file, zipPath, zip, fileData;
  const zipBlob = await getZipFromStore(username, repository, ref);
  try {
    if (zipBlob) {
      // console.log(`  Got zipBlob for uri=${uri}`);
      zip = await JSZip.loadAsync(zipBlob);
      zipPath = Path.join(repository.toLowerCase(), path);
      // console.log(`  zipPath=${zipPath}`);
      fileData = zip.file(zipPath);
      if (fileData) { // if file was found
        file = await fileData.async('string');
        // console.log(`    Got zipBlob ${file.length} bytes`);
      } else {
        console.log(`getFileFromZip - file not found for ${username} ${repository} ${encodeURI(path)} ${ref}`);
        file = null;
      }
    }
    // else console.log("  No zipBlob");
  } catch (error) {
    console.error(`getFileFromZip for ${username} ${repository} ${path} ${ref} got: ${error.message}`);
    file = null;
  }
  return file;
};


export function zipUri({ username, repository, ref = 'master' }) {
  // console.log(`zipUri(${username}, ${repository}, ${ref})…`);
  const zipPath = Path.join(username, repository, 'archive', `${ref}.zip`);
  const zipUri = baseURL + zipPath;
  return zipUri;
};


export async function fetchTree({ username, repository, sha = 'master' }) {
  // console.log(`fetchTree(${username}, ${repository}, ${sha})…`);
  let data;
  try {
    const uri = Path.join('api/v1/repos', username, repository, 'git/trees', sha);
    // console.log(`  uri='${uri}'`);
    data = await cachedGet({ uri });
    // console.log(`  data (${typeof data})`);
    return data;
    // const tree = JSON.parse(data); // RJH: Why was this here???
    // console.log(`  tree (${typeof tree})`);
    // return tree;
  } catch (error) {
    console.log(`ERROR: fetchTree got: ${error.message}`);
    console.log(`  Data was: ${JSON.stringify(data)}`);
    return null;
  }
};


/*
async function recursiveTree({username, repository, path, sha}) {
  console.log("recurse tree args:",username,repository,path,sha)
  let tree = {};
  const pathArray = path.split();
  const results = fetchTree({username, repository, sha});
  const result = results.tree.filter(item => item.path === pathArray[0])[0];
  if (result) {
    if (result.type === 'tree') {
      const childPath = pathArray.slice(1).join('/');
      const children = recursiveTree({username, repository, path: childPath, sha: result.sha});
      tree[result.path] = children;
    } else if (result.type === 'blob') {
      tree[result.path] = true;
    }
  }
};

async function fileExists({username, repository, path, ref}) {
  // get root listing
  recursiveTree()
  // get recursive path listing
}
*/