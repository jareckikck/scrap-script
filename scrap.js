const firebase = require("firebase");
const puppeteer = require("puppeteer");
// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "FIREABASE_API_KEY",
  authDomain: "xxx",
  databaseURL: "xxx",
  projectId: "xxx",
  storageBucket: "xxx",
  messagingSenderId: "xxx",
  appId: "xxx"
};
const credentials = {
  email: "dummy@email.com",
  pass: "dummyPass"
};
firebase.initializeApp(firebaseConfig);

let db = firebase.firestore();
let scrapResults = db.collection("scrapResults");
let scrapSiteConfig = db.collection("scrapSiteConfig");

loginToFirebase();

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
		console.log('scrap')
		loadConfigAndScrap("allegro");
  } 
});

function getDate() {
  var today = new Date();
  var dd = String(today.getDate()).padStart(2, "0");
  var mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
  var yyyy = today.getFullYear();

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
// function
function loginToFirebase() {	
  firebase
    .auth()
    .signInWithEmailAndPassword(credentials.email, credentials.pass)
    .catch(function(error) {
			console.log(error.code, error.message);			
    });
}
//
function saveData(id, data) {
  console.log("start SaveData");
  scrapResults
    .doc(id)
    .set(data)
    .then(function() {
      console.log("Document successfully written!");
    })
    .catch(function(error) {
      console.error("Error writing document: ", error);
    });
}

function scrapData(allegro) {
  try {
    (async () => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      let queryResult = [];

      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(allegro.url);

      if ((await page.$(allegro.popUpAccClass)) !== null) {
        console.log("close pop up");
        await page.click(allegro.popUpAccClass);
      } else {
        console.log("pop up not found");
      }

      await page.type(allegro.searchForm, allegro.searchQuery);
      await page.click(allegro.searchInput);

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

      await browser.close();

      let firebaseData = {
        queryResult: queryResult,
        searchQuery: allegro.searchQuery,
        srappedFrom: allegro.name,
        date: getDate()
      };		
      saveData(Date.now().toString(), firebaseData);
    })();
  } catch (err) {
    console.error(err);
  }
}