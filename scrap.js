const config = require("./config");
const firebase = require("firebase");
const puppeteer = require("puppeteer");

firebase.initializeApp(config.firebase);

let db = firebase.firestore();
let scrapResults = db.collection("scrapResults");
let scrapSiteConfig = db.collection("scrapSiteConfig");

loginToFirebase();

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    loadConfigAndScrap("allegro");
  }
});

function getDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
  const yyyy = today.getFullYear();

  return mm + "." + dd + "." + yyyy;
}

function loadConfigAndScrap(name) {
  scrapSiteConfig
    .where("name", "==", name)
    .get()
    .then(function(querySnapshot) {
      querySnapshot.forEach(function(doc) {
        console.log("doc data retrived");
        allegro = doc.data();
        scrapData(allegro);
      });
    })
    .catch(function(error) {
      console.log("Error getting documents: ", error);
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

function saveData(id, data) {
  console.log("start SaveData");
  scrapResults
    .doc(id)
    .set(data)
    .then(function() {
      console.log("Document successfully written!");
      process.exit();
    })
    .catch(function(error) {
      console.error("Error writing document: ", error);
      process.abort();
    });
}

function scrapData(allegro) {
  try {
    (async () => {
      let queryResult = [];

      //open browser
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(allegro.url);

      //close pop up
      if ((await page.$(allegro.popUpAccClass)) !== null) {
        console.log("close pop up");
        await page.click(allegro.popUpAccClass);
      } else {
        console.log("pop up not found");
      }

      //search for query
      await page.type(allegro.searchForm, allegro.searchQuery);
      await page.click(allegro.searchInput);

      //get results
      await page.waitForSelector(allegro.itemContainer);
      const item = await page.$$(allegro.item);
      for (let i = 0; i < allegro.resultsLimit; i++) {
        let title = await item[i].$eval(allegro.itemTitle, t => t.innerText);
        let price = await item[i].$eval(allegro.itemPrice, p => p.innerText);
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
        searchQuery: allegro.searchQuery,
        srappedFrom: allegro.name,
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
