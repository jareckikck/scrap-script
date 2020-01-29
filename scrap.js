const firebase = require("firebase");
const puppeteer = require("puppeteer");
// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDCUZkh4Klcm4dEjq3KyfJqXuSUA003UVo",
  authDomain: "workspace-1cdf1.firebaseapp.com",
  databaseURL: "https://workspace-1cdf1.firebaseio.com",
  projectId: "workspace-1cdf1",
  storageBucket: "workspace-1cdf1.appspot.com",
  messagingSenderId: "261466315114",
  appId: "1:261466315114:web:ffb1b2ccc2e87e15f1ed13"
};
firebase.initializeApp(firebaseConfig);

let db = firebase.firestore();
let scrapResults = db.collection("scrapResults");
let scrapSiteConfig = db.collection("scrapSiteConfig");
loadConfigAndScrap('allegro');

function getDate(){
	var today = new Date();
  var dd = String(today.getDate()).padStart(2, "0");
  var mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
  var yyyy = today.getFullYear();

  return  mm + "." + dd + "." + yyyy;
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

