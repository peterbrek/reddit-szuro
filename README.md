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

A kis- és nagybetű és az ékezet nem számít (`putyin` = Putyin). Emiatt egy rövid kulcsszó magyar szavak elejére is ráillhet: az `elon` például az „elönt”-re is, ezért van a listában `elon musk`. Ilyenkor írj hosszabb kifejezést, tedd idézőjelbe, vagy vegyél fel kivételt.

**Mit néz:** a poszt címét, a flairt, a szövegét, a hivatkozott cikk címét (URL), és áthúzott posztnál az eredeti címét.

**Mit nem:** a kommenteket. A megnyitott poszt saját oldalán magát a posztot nem rejti el, csak a mellette ajánlottakat.

**Ellenőrzés:** az **Elrejtett posztok mutatása halványan** pipával a rejtett posztok halványan, piros szaggatott kerettel látszanak, fölöttük a kulcsszóval, ami miatt kiestek. A panel alján ugyanez listában is megvan. Ha valami tévedésből esik ki, vegyél fel rá kivételt (`-szó`), vagy tedd idézőjelbe a kulcsszót.

### Kártyanézet

A panelen, a többi kapcsoló között a **Kártyanézet** kapcsolóval a feed TikTok-szerű lesz: minden poszt egy képernyőnyi kártya. Húzás közben a kártya követi az ujjadat; elengedéskor egy határozott húzás vagy gyors pöccintés a következő (lefelé húzva az előző) kártyára lép, egy rövid húzás visszaugrik. Macen a görgő vagy a trackpad egy mozdulata, illetve a le/fel nyíl, PageDown/PageUp és a szóköz lapoz egy kártyát.

A kártyán csak ennyi van:

- **felül** a subreddit neve, alatta nagy betűkkel a poszt címe (legfeljebb hat sor, a hosszabb „…”-tal végződik);
- **a háttérben, kitöltve** a poszt képe vagy videója (a videó némítva, ismétlődve megy, és csak akkor játszik, amikor a kártya látszik);
- **alul** a poszt szövege kisebb betűvel, legfeljebb 200 karakter (a hosszabbat szóhatáron levágja, „…”-tal), alatta sötét színátmenettel, hogy olvasható legyen;
- **jobb alul** a hozzászólások száma.

A kártyára koppintva a poszt oldalára jutsz.

Kártyanézetben a Reddit fejléce (menü, logó, értesítések), a kereső és a „For You / Following” fülsor eltűnik, csak a kártyák maradnak. Ezekhez a 🙈 panelen kapcsold ki a kártyanézetet. A legutóbb kiválasztott fül marad érvényben. Kép nélküli posztnál a háttér egy, a subreddithez igazodó színátmenet. Az apró bélyegképeket nem nyújtja szét, az NSFW- és spoilerképeket elmosva, címkével mutatja. Ha a Safari nem tudja lejátszani a videót, a videó előnézeti képe lesz a háttér.

Egyszerre csak egy kártya látszik: a kártya kitölti a látható magasságot, és az a kártya, amelyikből csak egy kis csík látszik (például az átlátszó Safari-eszköztár mögött), rejtve marad. Húzás közben a beúszó kártya hamar megjelenik.

A kártyák csak fel-le lapozhatók: oldalra nem húzhatók, és a kép vagy a link sem fogható meg. (A képernyő legszéléről indított oldalra húzás a Safari saját vissza/előre mozdulata, azt egy weboldal nem tudja letiltani.)

Az elrejtett posztokat átugorja. A reklámposztok is külön kártyát kapnak, de azokat a Reddit rajzolja. A megnyitott poszt oldalán normál a görgetés. A betöltött posztok végén a lapozás lejjebb gördül, hogy a Reddit betöltse a következő adagot, és amint megjöttek, magától az elsőre lép. A beállítás eszközönként külön tárolódik.

### App-reklámok

A panelen **A Reddit app-reklámjainak elrejtése** kapcsoló alapból be van kapcsolva. Ez eltünteti a Reddit saját app-ajánlóit: az alsó „Get the Reddit app” sávot, a fejléc „Open app” gombját és a teljes képernyős „Open in app / Continue in browser” ablakot. Ha ezek letiltanák a görgetést, újra engedélyezi.

A felső, magyar nyelvű „Megnyitás a Reddit appban” sávot nem a Reddit rajzolja, hanem a Safari (Smart App Banner), mert a Reddit app telepítve van. A szűrő kiveszi az oldalból azt a jelzést, amiből a Safari ezt a sávot készíti, de telepített appnál a Safari általában így is megjeleníti. Biztosan csak akkor tűnik el, ha törlöd a Reddit appot.

### Alap lista

```
# Politika
trump
-trumpet
putin
putyin

# Tech-vezérek
elon musk
musk
-muskát
-muskotály
-musket
altman
huang
nvidia ceo
nvidia vezér

# Játékok
gta 6
gta6
"gta vi"
"gtavi"
grand theft auto 6
"grand theft auto vi"
r/GTA6
r/GTAVI
```

A kivételek a gyakori téves találatokat engedik át: trumpet, muskátli, muskotály, musket. A `"gta vi"` idézőjelben áll, hogy a GTA Vice City-s posztok maradjanak.

## Hol tárolódik a lista

Eszközönként külön, a Userscripts saját tárolójában és a reddit.com helyi tárolójában. Az iPhone és a Mac között nem szinkronizál. Ha mindkettőn ugyanazt akarod, a panelen jelöld ki és másold ki a teljes szöveget, és a másik eszközön illeszd be.

## Ha nem szűr

- **Nincs 🙈 gomb:** a bővítmény nincs engedélyezve a reddit.com-on, vagy a fájl nem a Userscripts mappájában van.
- **Van gomb, de 0, és látszanak a kulcsszavas posztok:** a Reddit valószínűleg átalakította az oldal felépítését. A szűrő az új felületen a `shreddit-post` elemeket figyeli (a kártya az őt körülvevő `article`, utána egy `hr`), az old.reddit.com-on a `.thing.link` elemeket. Ilyenkor a szkriptet frissíteni kell.

## Megjegyzés a Safarihoz (fejlesztéshez)

A kártyanézet lapozását a szkript maga végzi (érintés, görgő és billentyűzet figyelése, majd animált `scrollTo`), nem a böngésző CSS `scroll-snap`-je: iOS Safariban az egész oldalas beugró lapozás megbízhatatlan (dinamikus magasság, a gyökérelemre tett snap és a görgetés közbeni stílusváltás egyaránt elrontja). A kártyákon `touch-action: none` van, a koppintás így is megnyitja a posztot. A html/body `overflow`-jához ne nyúlj.

## Korlátok

- A hivatalos Reddit appban nem működik.
- Csak a feedet szűri, a kommenteket nem.
- Élő reddit.com-on nem volt tesztelve (az ottani böngészőpanel nem nyitja meg). A Reddit jelenlegi oldalszerkezetét utánzó tesztoldalon ment végig minden eset: ragos alakok, kivételek, késve betöltődő szöveg, végtelen görgetés, a megnyitott poszt oldala, régi Reddit, mobil és asztali nézet, sötét mód.

## Frissítés

A szkript fejlécében benne van a frissítési cím, így a Userscripts és a Tampermonkey innen tölti le az új verziót. Ha egy javítás nem jön meg magától, nyisd meg újra a telepítőlinket, és telepítsd rá a régire. A kulcsszólistád megmarad. Ha egy új verzió az alap listán is változtat, azt a változást a már elmentett listádon is elvégzi, a saját sorodhoz nem nyúl.

## Verziók

- **1.7.0** (2026-11-26): saját lapozás a Safari beugró görgetése helyett: húzás közben követi az ujjat, elengedve egy kártyát lép; görgő és billentyűzet is.
- **1.6.1** (2026-11-26): javítva, hogy iPhone-on a kártyák újra beugranak (az 1.5.3–1.6.0 egy Safari-hiba miatt szabad görgetést okozott).
- **1.6.0** (2026-11-26): egyszerre csak egy kártya látszik, a következő teteje nem lóg be.
- **1.5.3** (2026-11-26): kártyanézetben csak fel-le lehet lapozni, oldalra nem mozdul az oldal.
- **1.5.2** (2026-11-26): a cím a korábbi méret 80%-a, a szöveg kisebb és legfeljebb 200 karakter.
- **1.5.1** (2026-11-26): kétszer akkora cím a kártyán, fölötte a subreddit neve.
- **1.5.0** (2026-11-26): kártyanézetben eltűnik a Reddit fejléce, keresője és fülsora, csak a kártyák maradnak.
- **1.4.0** (2026-11-26): új kártyák: cím felül, kép vagy videó kitöltve a háttérben, szöveg alul sötét átmeneten, hozzászólásszám; koppintásra a poszthoz visz.
- **1.3.1** (2026-11-26): a kártyanézet kapcsolója a többi kapcsoló mellé került.
- **1.3.0** (2026-11-26): kártyanézet, TikTok-szerű lapozással.
- **1.2.0** (2026-11-26): a Reddit app-reklámjainak elrejtése (alsó „Get the Reddit app” sáv, „Open app” gomb, app-választó ablak), kapcsolóval a panelen.
- **1.1.0** (2026-11-24): `elon` helyett `elon musk` (az `elon` az „elönt”-re is illett), új GTA 6-os sorok. A már elmentett listák maguktól frissülnek.
- **1.0.0** (2026-11-23): első változat.
