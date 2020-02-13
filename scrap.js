const config = require("./config");
const firebase = require("firebase");
const puppeteer = require("puppeteer");

firebase.initializeApp(config.firebase);

let db = firebase.firestore();
let collectionScrapResults = db.collection("scrapResults");
let collectionScrapSiteConfig = db.collection("scrapSiteConfig");
let collectionSearchQuery = db.collection("searchQuery");

let providers = new Map();
let queries;
let runIterator = 0;

loginToFirebase();
start();

async function start() {
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      loadSearchQueries().then(res => {
        queries = res;
        queries.forEach(doc => {
          if (providers.has(doc.provider)) return;
          providers.set(doc.provider, null); 
          loadConfig(doc.provider)
            .then(config => {
              providers.set(doc.provider, config);
            })
            .then(() => {
              queries.forEach(q => {
                query = {
                  provider: providers.get(q.provider),
                  searchQuery: q.searchQuery
                };
                scrapData(query);
                runIterator++;
              });
            });
        });
      });
    }
  });
}

function loginToFirebase() {
  firebase
    .auth()
    .signInWithEmailAndPassword(
      config.credentials.email,
      config.credentials.pass
    )
    .catch(function(error) {
      console.log(error.code, error.message);
    });
}

async function loadSearchQueries() {
  const snapshot = await collectionSearchQuery.get();
  return snapshot.docs.map(doc => doc.data());
}

async function loadConfig(id) {
  const snapshot = await collectionScrapSiteConfig.doc(id).get();
  return snapshot.data();
}

function saveData(id, data) {
  console.log("start SaveData");
  collectionScrapResults
    .doc(id)
    .set(data)
    .then(function() {
      console.log("Document successfully written!");
      runIterator--;      
      if (runIterator !== 0) return
			process.exit();      
    })
    .catch(function(error) {
      console.error("Error writing document: ", error);
      process.abort();
    });
}

function scrapData({ provider, searchQuery }) {
  try {
    (async () => {
      let queryResult = [];

      //open browser
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(provider.url);

      //close pop up
      if ((await page.$(provider.popUpAccClass)) !== null) {
        console.log("close pop up");
        await page.click(provider.popUpAccClass);
      } else {
        console.log("pop up not found");
      }

      //search for query
      await page.type(provider.searchForm, searchQuery);
      await page.click(provider.searchInput);

      //get results
      await page.waitForSelector(provider.itemContainer);
      const item = await page.$$(provider.item);
      for (let i = 0; i < provider.resultsLimit; i++) {
        let title = await item[i].$eval(provider.itemTitle, t => t.innerText);
        let price = await item[i].$eval(provider.itemPrice, p => p.innerText);
        let position = {
          title: title,
          price: price
        };
        queryResult.push(position);
        console.log(`${i} item:  title - ${title}, price -  ${price}`);
      }
      //  close browser
      await browser.close();

      //prepare firebase objec
      let firebaseData = {
        queryResult: queryResult,
        searchQuery: searchQuery,
        srappedFrom: provider.name,
        date: getDate()
      };

      //save data to firebase
      saveData(Date.now().toString(), firebaseData);
    })();
  } catch (err) {
    console.error(err);
    process.abort();
  }
}

function getDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
  const yyyy = today.getFullYear();

  return mm + "." + dd + "." + yyyy;
}
