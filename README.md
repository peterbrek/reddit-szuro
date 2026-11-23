# Reddit-szűrő

Böngészős kiegészítő (userscript), amely a reddit.com feedjéből elrejti azokat a posztokat, amelyekben a megadott kulcsszavak szerepelnek. A saját Reddit-belépéseddel, a böngészőben fut. Adatot nem küld sehová, és a Reddit API-ját sem használja.

| Fájl | Hova kerül | Mi ez |
|---|---|---|
| [`reddit-szuro.user.js`](reddit-szuro.user.js) | Userscripts (Safari, iPhone/Mac) vagy Tampermonkey (Chrome, Edge, Firefox) | Maga a szűrő |

## Miért nem önálló app

A Reddit 2025 novembere óta nem ad új API-kulcsot. 2026 május vége óta a belépés nélküli adatlekérés (`.json`) 403-as hibát ad, 2026. november 13-tól pedig az RSS is megszűnt. 2027 márciusában a régi API-hozzáférések is lezárulnak. Saját olvasóapp ezért nem tudja letölteni a feedet. A szűrő ezért magán a reddit.com oldalon fut, és elrejti, amit nem akarsz látni.

**A hivatalos Reddit appban nem működik**, oda semmilyen külső szűrő nem tud belenyúlni. A szűrt feedet a Safariban látod.

## Telepítés iPhone-ra

1. App Store: **Userscripts** (fejlesztő: Justin Wasack), ingyenes. Nyisd meg egyszer.
2. **Beállítások › Alkalmazások › Safari › Bővítmények › Userscripts:** kapcsold be. Régebbi iOS-en: **Beállítások › Safari › Bővítmények**.
3. Safariban nyisd meg ezt a linket: [https://raw.githubusercontent.com/peterbrek/reddit-szuro/main/reddit-szuro.user.js](https://raw.githubusercontent.com/peterbrek/reddit-szuro/main/reddit-szuro.user.js)
   Megjelenik a szkript szövege. Koppints a címsor bővítmény-menüjére (puzzle vagy **aA** ikon) › **Userscripts**, majd **Install**.
4. Nyisd meg a `reddit.com`-ot, és lépj be. Ugyanebben a menüben a Userscripts-nél engedélyezd a reddit.com-ot (**Mindig engedélyezés ezen a webhelyen**).
5. Frissítsd az oldalt. Bal alul megjelenik a 🙈 gomb, rajta az elrejtett posztok száma.

Ha a 3. lépés nem kínálja fel a telepítést: töltsd le a fájlt, és **Megosztás › Mentés a Fájlokba** paranccsal tedd a Userscripts mappájába (**Az én iPhone-omon › Userscripts**).

Tippek:

- Ha a Redditet a főképernyőre teszed, Safariban nyíljon, ne külön webappként, mert a webappban nem futnak a Safari-bővítmények.
- Más appokból a Reddit-linkek a Reddit appban nyílnak meg, ha az fel van telepítve. A szűrt feedhez a Safariból indulj.

## Telepítés számítógépre

- **Mac, Safari:** Userscripts a Mac App Storeból. **Safari › Beállítások › Bővítmények**: kapcsold be. Utána ugyanúgy, mint iPhone-on: telepítőlink, majd a Userscripts ikonja a Safari eszközsorában › **Install**.
- **Chrome, Edge, Firefox:** Tampermonkey vagy Violentmonkey bővítmény. Utána nyisd meg a [telepítőlinket](https://raw.githubusercontent.com/peterbrek/reddit-szuro/main/reddit-szuro.user.js), és a bővítmény felajánlja a telepítést.

## Használat

A 🙈 gombra koppintva nyílik a panel. A kulcsszavakat soronként írod be, a **Mentés** után a feed azonnal újraszűrődik.

| Sor | Hatás |
|---|---|
| `trump` | A szó elejére illeszt: Trump, Trump's, Trumpról, anti-Trump |
| `"musk"` | Csak pontosan ez a szó (és a birtokos 's), a Muskot már nem |
| `-trumpet` | Kivétel: ez a szó nem számít találatnak, így a trombitás poszt marad |
| `nvidia vezér` | Kifejezés. A szavak közt szóköz vagy kötőjel is lehet: Nvidia-vezér, Nvidia vezérigazgatója |
| `r/politics` | Az egész subreddit |
| `# Politika` | Megjegyzés, csak a rendezéshez |

A kis- és nagybetű és az ékezet nem számít (`putyin` = Putyin).

**Mit néz:** a poszt címét, a flairt, a szövegét, a hivatkozott cikk címét (URL), és áthúzott posztnál az eredeti címét.

**Mit nem:** a kommenteket. A megnyitott poszt saját oldalán magát a posztot nem rejti el, csak a mellette ajánlottakat.

**Ellenőrzés:** az **Elrejtett posztok mutatása halványan** pipával a rejtett posztok halványan, piros szaggatott kerettel látszanak, fölöttük a kulcsszóval, ami miatt kiestek. A panel alján ugyanez listában is megvan. Ha valami tévedésből esik ki, vegyél fel rá kivételt (`-szó`), vagy tedd idézőjelbe a kulcsszót.

### Alap lista

```
# Politika
trump
-trumpet
putin
putyin

# Tech-vezérek
elon
-elongat
musk
-muskát
-muskotály
-musket
altman
huang
nvidia ceo
nvidia vezér
```

A kivételek a gyakori téves találatokat engedik át: trumpet, elongated, muskátli, muskotály, musket.

## Hol tárolódik a lista

Eszközönként külön, a Userscripts saját tárolójában és a reddit.com helyi tárolójában. Az iPhone és a Mac között nem szinkronizál. Ha mindkettőn ugyanazt akarod, a panelen jelöld ki és másold ki a teljes szöveget, és a másik eszközön illeszd be.

## Ha nem szűr

- **Nincs 🙈 gomb:** a bővítmény nincs engedélyezve a reddit.com-on, vagy a fájl nem a Userscripts mappájában van.
- **Van gomb, de 0, és látszanak a kulcsszavas posztok:** a Reddit valószínűleg átalakította az oldal felépítését. A szűrő az új felületen a `shreddit-post` elemeket figyeli (a kártya az őt körülvevő `article`, utána egy `hr`), az old.reddit.com-on a `.thing.link` elemeket. Ilyenkor a szkriptet frissíteni kell.

## Korlátok

- A hivatalos Reddit appban nem működik.
- Csak a feedet szűri, a kommenteket nem.
- Élő reddit.com-on nem volt tesztelve (az ottani böngészőpanel nem nyitja meg). A Reddit jelenlegi oldalszerkezetét utánzó tesztoldalon ment végig minden eset: ragos alakok, kivételek, késve betöltődő szöveg, végtelen görgetés, a megnyitott poszt oldala, régi Reddit, mobil és asztali nézet, sötét mód.

## Frissítés

A szkript fejlécében benne van a frissítési cím, így a Userscripts és a Tampermonkey innen tölti le az új verziót. Ha egy javítás nem jön meg magától, nyisd meg újra a telepítőlinket, és telepítsd rá a régire. A kulcsszólistád megmarad.

## Verziók

- **1.0.0** (2026-11-23): első változat.
