const puppeteer = require("puppeteer");
let mysql;
let connection;
let page;

(async () => {
  const browser = await puppeteer.launch();

  page = await browser.newPage();

  // ハローワークのページに遷移
  await page.goto(
    "https://www.hellowork.mhlw.go.jp/kensaku/GECA110010.do?action=initDisp&screenId=GECA110010"
  );

  // MySQL接続
  mysql = require("mysql");
  connection = mysql.createConnection({
    host: "",
    user: "",
    password: "",
    database: ""
  });
  connection.connect();

  // 検索する都道府県を選択（ここでは鳥取県）
  await page.select('select[name="tDFK1CmbBox"]', "31");

  // 市区町村選択
  // const script2 = `openCodeAssist('5','9','siku1Hidden','tDFK_Uchi1Label','1','','-1','','tDFK1CmbBox','')`;
  // await page.addScriptTag({ content: script2 });
  // await page.waitForSelector(".modal_content");
  // await page.select('select[name="rank1CodeMulti"]', "31372");
  // await page.click("#ID_ok");

  //  職種選択画面
  const script = `openCodeAssist('3','7','kiboSuruSKSU1Hidden','kiboSuruSKSU1Label','1','','-1','','','')`;
  await page.addScriptTag({ content: script });

  await page.waitForSelector(".modal_content");

  // 検索する職種大分類を選択（ここでは技術職）
  await page.select('select[name="rank1Code"]', "09");

  await page.waitForSelector('select[name="rank2Codes"] option[value="4 "]');
  // 職種詳細選択（ここでは「ソフトウェア開発技術者、プログラマー」と「その他の情報処理・通信技術者」）
  await page.select('select[name="rank2Codes"]', "4 ", "5 ");

  // 決定クリック
  await page.click("#ID_ok");

  // 検索クリック
  await page.waitForSelector("#ID_ok", { hidden: true });
  // await page.click('input[name="searchBtn"]');
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('input[name="searchBtn"]')
  ]);

  // 求人情報取得
  while (true) {
    // 各種求人情報の個別ページURL取得
    await page.waitForSelector('a[href*="GECA110010"]');
    const kyujinInfos = await page.$$('a[href*="GECA110010"]');
    var kyujinUrls = [];
    for (let i = 0; i < kyujinInfos.length; i++) {
      kyujinUrls.push(await (await kyujinInfos[i].getProperty("href")).jsonValue());
    }

    // 各種求人情報の個別ページ遷移
    for (let i = 0; i < kyujinUrls.length; i++) {
      await page.goto(kyujinUrls[i]);
      await page.waitForSelector("#ID_kjNo");

      // データインサート
      connection.query(
        "INSERT INTO HOMEMARKET VALUES(?,?,?)",
        [kyujinUrls[i].substring(1, 100), "a", "bdd"],
        function(error, results, fields) {
          if (error) {
            connection.rollback(function() {
              throw err;
            });
          }
        }
      );

      // ブラウザバック
      await page.goBack();
      await page.waitForSelector(".kyujin.mt1.noborder");
    }

    // 次へボタンクリック
    try {
      await page.click('input[name="fwListNaviBtnNext"]:not([disabled])');
    } catch (err) {
      break;
    }
  }

  // コミット
  connection.commit(function(err) {
    if (err) { 
      connection.rollback(function() {
        throw err;
      });
    }
  });

  // MySQLクローズ
  connection.end();

  // ブラウザ閉じる
  await browser.close();
})();
