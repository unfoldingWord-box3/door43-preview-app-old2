import Path from 'path';
import yaml from 'yaml';
import localforage from 'localforage';
import { setup } from 'axios-cache-adapter';
//import _ from "lodash";
import { base_url, apiPath } from '../common/constants'
import * as books from '../common/books'

const baseURL = base_url+'/';

// caches http file fetches done by fetchFileFromServer()
const cacheStore = localforage.createInstance({
  driver: [localforage.INDEXEDDB],
  name: 'web-cache',
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



export async function fetchBook(username, repository, branch, bookid, isTcRepo) {
  //https://qa.door43.org/Door43-Catalog/en_ult/raw/branch/master/57-TIT.usfm
  let usfmFile = books.usfmNumberName(bookid)+'.usfm';
  if (isTcRepo) {
    usfmFile = `${repository}.usfm`;
  }
  //const uri = Path.join(base_url,apiPath,username,repository,'raw','branch','master', usfmid);
  const uri = base_url+'/'+username+'/'+repository+'/raw/branch/'+branch+'/'+usfmFile;
  console.log("uri=", uri);
  let results;
  try {
    const { data } = await Door43Api.get(uri, {});
 
    if ( data ) results = data;
    else results = 'Error: results empty';

  } catch (geterror) {
    results = geterror;
  }
  return results;
}

/*
export async function repoExists(username, repository, tokenid) {

  // example: https://qa.door43.org/api/v1/repos/translate_test/en_tn 
  const uri = Path.join(base_url,apiPath,'repos',username,repository) ;
  const res = await fetch(uri+'?token='+tokenid, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  let repoExistsFlag = false;
  if (res.status === 200) {
    // success
    repoExistsFlag = true;
  } 
  return repoExistsFlag;
}
*/

export async function fetchManifest(username, repository, branch) {

  // example: https://qa.door43.org/api/v1/repos/translate_test/en_ta/raw/manifest.yaml
  //          https://qa.door43.org/translate_test/en_ta/raw/branch/master/manifest.yaml
  const uri = Path.join(username, repository, 'raw', 'branch', branch, 'manifest.yaml');
  try {
    const { data } = await Door43Api.get(uri, {});
    if ( data ) {
      // success
      try {
        return yaml.parse(data);
      }
      catch (yamlError) {
        console.error(`${username} ${repository} manifest yaml parse error: ${yamlError.message}`);
      }
    } 
  } catch (geterror) {
    console.error("Error:",geterror,"on:",uri);
  }
  return null;
}

export async function fetchGitRefs(username, repository, ref) {
  const uri = Path.join(apiPath, "repos", username, repository, "git", ref);
  try {
    const { data } = await Door43Api.get(uri, {});
    if ( data ) {
      // success
      return data;
    } 
  } catch (geterror) {
    console.error("Error:",geterror,"on:",uri);
  }
  return null;
}

export async function fetchTCManifest(username, repository, ref) {

  // example: https://qa.door43.org/api/v1/repos/translate_test/en_ta/raw/manifest.yaml
  //          https://qa.door43.org/translate_test/en_ta/raw/branch/master/manifest.yaml
  const uri = Path.join(username, repository, 'raw', 'branch', ref, 'manifest.json');
  try {
    const { data } = await Door43Api.get(uri, {});
    if ( data ) {
      // success
      return data;
    } 
  } catch (geterror) {
    console.error("Error:",geterror,"on:",uri);
  }
  return null;
}

/*
export async function repoCreate({username, repository, tokenid}) {
  const uri = Path.join(base_url,apiPath,'orgs',username,'repos') ;
  const res = await fetch(uri+'?token='+tokenid, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: `{
      "auto_init": true,
      "default_branch": "master",
      "description": "Init New Repo by Admin App",
      "gitignores": "macOS",
      "issue_labels": "",
      "license": "CC-BY-SA-4.0.md",
      "name": "${repository}",
      "private": false,
      "readme": "",
      "template": true,
      "trust_model": "default"
    }`
  })

  return res
}

// swagger: https://qa.door43.org/api/v1/swagger#/repository/repoCreateFile
// template: /repos/{owner}/{repo}/contents/{filepath}
export async function manifestCreate({username, repository, tokenid}) {
  const resourceId = repository.split('_')[1];
  const manifest = getResourceManifest( {resourceId} );
  const content = base64.encode(utf8.encode(manifest));
  const uri = Path.join(base_url,apiPath,'repos',username,repository,'contents','manifest.yaml') ;
  const date = new Date(Date.now());
  const dateString = date.toISOString();
  const res = await fetch(uri+'?token='+tokenid, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, 
    body: `{
      "author": {
        "email": "info@unfoldingword.org",
        "name": "unfoldingWord"
      },
      "branch": "master",
      "committer": {
        "email": "info@unfoldingword.org",
        "name": "unfoldingWord"
      },
      "content": "${content}",
      "dates": {
        "author": "${dateString}",
        "committer": "${dateString}"
      },
      "message": "Initialize Manifest - must be updated",
      "new_branch": "master"
    }`
  })

  return res
}
*/

