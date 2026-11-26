# ART-BRIEF — художественные ресурсы «Царской казны» v2.0

## Что есть сейчас и чего нет

В этой среде у меня не было генератора изображений, поэтому **финальных растровых иллюстраций в сборке нет**. Сцены и персонажи пока нарисованы векторной разметкой. Это **временная** отрисовка, а не замена живописи. Разметка задаёт:

- композицию кадра;
- скелет персонажей (части и шарниры);
- все позы и анимации.

Что уже готово по-настоящему:

- **Растровые материалы.** Натуральное тёмное дерево с волокнами, сучками и фаской. Волокнистая бумага и лист с живым краем. Расписные стены: лазурь, охра и фиолет с травным орнаментом. Белокаменная кладка, каменный пол, сургучная печать, резная рама.
- **Механика подключения иллюстраций** (`assets.js`). Положите WebP рядом с `index.html` и перечислите его в `art-manifest.json`. Приложение само подменит векторную часть картинкой, а шарниры и анимации сохранятся. Механика проверена автотестом: шут, собранный из 29 растровых слоёв, едет на колесе.
- **Набор для художника** `tsarskaya-kazna-art-kit.zip`. Для каждой части каждого персонажа в нём лежит эталонный PNG на полном холсте, точно в том месте, где часть стоит в покое. Там же композиции сцен без персонажей и `parts.json` с шарнирами.

## Единый стиль (для всех файлов)

Делайте так:

- Русский лубок и театральный гротеск: яркий, богатый, сказочный мир, как в театральной постановке.
- Один художник, одна рука, один фильм.
- Преувеличенные пропорции персонажей: большие носы, бороды, шапки, животы.
- Выразительная пластика. Чёткий тёмный контур переменной толщины.
- Живописная заливка, как гуашь или темпера, с видимой фактурой.
- Мягкий объёмный свет с одной стороны и тёплые блики.
- Палитра: киноварь `#c23b22`, благородный тёмно-красный `#7a1f2b`, изумруд `#1f6b52`, лазурь `#2b6a9c`, охра `#c98a2e`, старое золото `#b8923a`, сливочный `#f6ead0`, пергамент `#eadbb6`, густые чернила `#1d1a2b`, приглушённый фиолет `#5e4a7a`.
- У каждой сцены своя доминанта: подвал — тёплое золото и камень, палата казначея — фиолет и дерево, балаган — охра и киноварь, дума — лазурь с росписью, кухня — огонь и медь.
- Орнамент — травный, с завитками, листьями и цветами-розетками, в духе северной росписи и лубочных рамок.

Чего не делать:

- Не копировать персонажей, кадры и узнаваемые элементы существующих мультфильмов.
- Не делать плоский «векторный» стиль без фактуры.
- Не делать фотореализм.
- Не использовать 3D-рендер.
- Не вписывать текст в картинку (кроме надписей на документах в ларце).

**Общая приписка к любому запросу для генератора изображений:**

> Russian lubok-inspired theatrical fairy-tale illustration, rich saturated palette of cinnabar red, emerald green, azure blue, ochre and old gold on warm parchment tones, gouache/tempera painterly texture, bold expressive dark outlines of varying width, grotesque exaggerated character proportions, warm volumetric light, ornate folk floral ornament, cohesive single-artist style, high detail, no text, no photorealism, no 3D render

## Технический договор

| | Фоны сцен | Персонажи и боссы |
|---|---|---|
| Имя файла | `art-<сцена>.webp` | `ch-<персонаж>-<часть>.webp` |
| Размер | 2× от кадра сцены (таблица ниже) | 4× от холста персонажа |
| Фон | непрозрачный | прозрачный (WebP с альфой или PNG) |
| Содержимое | только окружение, **без** персонажей, сундуков, колеса, дороги и вех | одна часть на полном холсте, в позе покоя, остальное прозрачно |
| Подключение | имя в `art-manifest.json` | имя в `art-manifest.json` |

Как работает подмена:

- **Холст персонажа.** Каждая часть рисуется на холсте целиком, в том месте, где она стоит в покое. Так экспортируются слои PSD/Procreate «без обрезки». Приложение само поставит слой в группу с нужным шарниром и будет поворачивать его вокруг шарнира.
- **Перекрытие.** Часть, которая вращается (плечо, предплечье, голова, корпус), должна заходить под соседнюю на 6–10 px холста, чтобы при повороте не открывались щели. Пример — круглая «головка сустава» у плеча.
- **Варианты лица.** `e-*` (глаза), `m-*` (рот) и `b-*` (брови) — отдельные слои. Приложение показывает нужный по настроению. Если для персонажа есть растровая голова, лучше дать все варианты лица, иначе на живописной голове останутся векторные глаза.
- **Порядок слоёв** совпадает с порядком в таблицах ниже: дальняя рука → корпус → голова → ближняя рука → предметы.
- **Проверка.** Положите эталон `guide-...png` поверх своего слоя: силуэт и положение должны совпасть с точностью до нескольких пикселей. Внутри силуэта можно рисовать как угодно богаче.
- **Как подключить:** скопируйте файлы в корень репозитория и добавьте имена в `art-manifest.json`, например `{ "files": ["art-treasury.webp", "ch-jester-head.webp"] }`. После публикации на GitHub Pages приложение подхватит их само. Без интернета файлы кэшируются при первом показе. В «Настройки → Иллюстрации» видно, что подключено.

## Фоны сцен

| Файл | Кадр (ед.) | Размер файла | Что на месте персонажей (оставить свободным) |
|---|---|---|---|
| `art-treasury.webp` | 1000×560 | 2000×1120 | большой сундук x 250–550, y 230–470; ларец на подставке x 600–780, y 300–490; слуга x 860–990; таблички с суммами сверху |
| `art-office.webp` | 1000×300 | 2000×600 | казначей с конторкой x 340–660, y 50–300 |
| `art-stage.webp` | 1000×640 | 2000×1280 | колесо: центр (400, 300), радиус 255; указатель сверху (400, 46); шут справа x 640–880 |
| `art-duma.webp` | 1200×520 | 2400×1040 | 8 бояр вдоль лавки (y 360–520), центр (600, 512) — место, куда выходит говорящий |
| `art-kitchen.webp` | 1200×460 | 2400×920 | повар и стол в центре-справа |
| `art-map.webp` | 4660×430 | 9320×860 | дорога, вехи, боссы и сундуки остаются векторными поверх: оставьте читаемую полосу дороги по линии y≈290–320 |

Композиции и точная раскладка — в наборе: `guide-art-<сцена>.png` (без персонажей) и `_reference-<сцена>-with-characters.png`.

### Сокровищница (`art-treasury.webp`)
Глубокий белокаменный подвал царской казны со сводами. В центре — арка с решётчатым окном, из него падает столб пыльного света на красную дорожку. По бокам — ниши со стеллажами: мешки с монетами, кубки, ларчики, бочонок, свёрнутые грамоты, кувшины. Два стяга: киноварный и лазоревый, с золотым ключом и короной. Свечи в кованых держателях. Пол из каменных плит, кое-где рассыпаны монеты. Тёплое золото против холодного камня, глубокие тени по углам.

> Prompt: vaulted white-stone treasure cellar of a Russian fairy-tale tsar, central arched lattice window with dusty god-rays falling onto a red carpet, side niches with shelves of coin sacks, goblets, small caskets, scrolls and jugs, two hanging banners (cinnabar and azure) with golden key and crown emblems, candles in wrought-iron sconces, stone slab floor with scattered gold coins, empty space in the centre and right for a large chest and a small casket on a stand, warm gold vs cool stone, deep corner shadows, wide 16:9 — + общая приписка

### Палата казначея (`art-office.webp`)
Тесная, обжитая палата. Стены расписаны фиолетово-синим травным орнаментом, ниже — тёмная деревянная обшивка. Слева — слюдяное окно, из него ложится косой свет. Справа — полки с книгами в кожаных переплётах, песочные часы, свитки, мешочек с монетами. Висит медный фонарь. Пустое место в центре — для стола казначея. Атмосфера: усталость, бумажная пыль, вечер.

> Prompt: cramped cosy chamber of an old tsar's treasurer, walls painted with violet-blue folk floral ornament above dark carved wooden panelling, mica window on the left with slanted evening light, shelves with leather-bound ledgers, hourglass, scrolls and a coin pouch on the right, hanging copper lantern, centre left empty for a desk, dusty paper atmosphere, very wide 10:3 panorama — + общая приписка

### Балаган шута (`art-stage.webp`)
Ярмарочный театральный помост. Тяжёлые киноварные занавеси с золотыми кистями по краям кадра. Задник — охряный расписной холст. Сверху — гирлянда флажков. Пол — дощатый помост. Лучи прожекторов-«рампы» сходятся на месте колеса слева от центра. Справа — место для шута, сундучок с реквизитом, разбросанные мячики.

> Prompt: fairground puppet-theatre stage of a Russian fair, heavy cinnabar curtains with gold tassels framing both sides, painted ochre backdrop cloth with folk ornament, bunting of little flags across the top, wooden plank stage floor, warm footlight beams converging on an empty circle left of centre (for a big wheel of fortune), props chest and juggling balls on the right, theatrical and festive — + общая приписка

### Боярская дума (`art-duma.webp`)
Палата думы с лазоревыми стенами, сплошь расписанными травами и цветами. Красный фриз с золотыми арками. Резные расписные столбы. Слюдяные окна с потоками света. Справа — изразцовая печь. Вдоль стены — длинная лавка под красным сукном. Пол — тёмные доски, в центре — красная дорожка: на неё выходит говорящий боярин.

> Prompt: grand boyar council chamber, azure walls densely painted with folk herbs and flowers, red frieze with golden arches, carved painted wooden columns, mica windows with light shafts, tiled stove on the right, a long bench covered with red cloth along the back wall, dark plank floor with a red carpet in the centre, empty of people, wide 2.3:1 — + общая приписка

### Царская кухня (`art-kitchen.webp`)
Белокаменная кухня. Под потолком — тёмные балки, на них висят чеснок, лук, колбасы, травы, медные сковороды. Справа — большая русская печь с живым огнём, отсветы на стенах. Полки с горшками и банками, мешки «МУКА» и «КРУПА», бочки. Слева — окно.

> Prompt: tsar's white-stone kitchen, dark ceiling beams hung with garlic, onions, sausages, herbs and copper pans, a large Russian oven with a live fire on the right casting warm flickering light, shelves of clay pots and jars, flour and grain sacks, barrels, small window on the left, empty centre-right for a cook and table — + общая приписка

### Карта пути (`art-map.webp`, 9320×860)
Одна длинная панорама, восемь земель слева направо. Каждая земля занимает 550 ед. (1100 px) и стоит на месте своего босса:

1. Стольный град — белокаменный кремль с золотыми и синими куполами, терема, монастырь, торговые ряды с навесами.
2. Подписные горы — скалистый перевал со снежными вершинами, ступени и мостики.
3. Река и мост Мытаря — избы, мельница, заставы.
4. Ярмарка — шатры, карусели, флаги.
5. Болото — камыши, туман, гать.
6. Тёмный замок Кощея — голые деревья, вороны.
7. Дремучий лес с избушкой.
8. Морской берег — пристань, ладья, маяк.

Сверху — небо и дальний план с облаками. Внизу — передний план с травой и цветами.

Требования:

- Дорогу оставить пустой светлой полосой по линии y≈290–320 (в 2×: 580–640 px). Её, вехи, флажки, указатели, боссов и сундуки приложение рисует поверх.
- Переходы между землями плавные.
- Масштаб домиков согласован по всей карте.

> Prompt: extremely wide panoramic fairy-tale map-landscape of old Rus seen slightly from above, from left to right: white-stone kremlin with gold and blue onion domes, terems, monastery and market stalls; snowy rocky mountain pass with steps and small bridges; river with wooden bridge, watermill and izbas; colourful fair with tents and flags; misty reed marsh with plank path; dark castle with bare trees and crows; deep fir forest with a hut on chicken legs; sea shore with pier, sailing boat and lighthouse; continuous sky with clouds on top and grassy flowery foreground at the bottom, leave a light empty band for a winding road across the middle, seamless transitions — + общая приписка

## Персонажи и боссы

Общие требования:

- Все персонажи — актёры одного театра: одинаковый контур, свет и манера.
- Вид в три четверти. Персонаж смотрит туда же, куда в эталоне.
- Прозрачный фон, без теней на фоне (тень — отдельный слой `base`/`shadow`, где он есть).
- Разрешение 4× от холста.
- Количество частей:
  - слуга — 28, казначей — 27, шут — 29, повар — 28, у каждого боярина — 30;
  - у боссов — от 5 до 28.
  - Около 18 частей у каждого персонажа — это варианты лица.
- Можно сдавать по одному персонажу: каждый подключается независимо.

**Характеры:**

- Слуга Прошка — молодой простодушный ключник, связка ключей.
- Казначей — пожилой, уставший, пенсне, седая борода, красная шапка с мехом.
- Шут — гибкий, в бело-красно-золотом трико, колпак с тремя рогами и бубенцами.
- Повар — толстый, в белом колпаке и фартуке.
- Бояре:
  - восемь разных силуэтов и шапок, описания — в таблицах ниже;
  - у каждого — шарнир таза, корпуса, шеи и головы, отдельная шапка, ближняя и дальняя рука, сапоги;
  - они кланяются от бедра, поэтому кафтан разрезан по поясу на верх `torso` и полы `skirt`, а пояс перекрывает шов.
- Боссы — гротескные сказочные злодеи финансовых бед, каждый у своей земли.

## Части персонажей и шарниры

Координаты — в единицах холста (умножьте на 4 для пикселей файла). «—» в колонке шарнира: слой не вращается сам, а следует за родителем.

### Ключник Прошка (сокровищница)

Холст: 200×330 ед. (начало 0,0) → файл **800×1320 px**. Эталоны: `guide-ch-servant-*.png`, общий вид `_reference-servant.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-servant-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-servant-body.webp` | туловище с ногами/одеждой без рук и головы | base | 100, 318 |
| `ch-servant-keys.webp` | связка ключей на поясе | body | 121, 179 |
| `ch-servant-head.webp` | голова без глаз, рта и бровей | body | 100, 113 |
| `ch-servant-e-open.webp` | глаза — вариант «open» | head | 89, 81 |
| `ch-servant-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-servant-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-servant-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-servant-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-servant-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-servant-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-servant-b-n.webp` | брови — вариант «n» | head | — |
| `ch-servant-b-s.webp` | брови — вариант «s» | head | — |
| `ch-servant-b-u.webp` | брови — вариант «u» | head | — |
| `ch-servant-b-a.webp` | брови — вариант «a» | head | — |
| `ch-servant-m-n.webp` | рот — вариант «n» | head | — |
| `ch-servant-m-s.webp` | рот — вариант «s» | head | — |
| `ch-servant-m-g.webp` | рот — вариант «g» | head | — |
| `ch-servant-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-servant-m-o.webp` | рот — вариант «o» | head | 100, 104 |
| `ch-servant-m-w.webp` | рот — вариант «w» | head | — |
| `ch-servant-m-t.webp` | рот — вариант «t» | head | 100, 104 |
| `ch-servant-arm-l.webp` | левое плечо | body | 69, 129 |
| `ch-servant-arm-l-fore.webp` | левое предплечье с кистью | arm-l | 64, 175 |
| `ch-servant-held.webp` | часть «held» | arm-l-fore | — |
| `ch-servant-arm-r.webp` | правое плечо | body | 69, 129 |
| `ch-servant-arm-r-fore.webp` | правое предплечье с кистью | arm-r | 64, 175 |
| `ch-servant-puff.webp` | облачко пара/вздоха | body | — |
| `ch-servant-spark.webp` | искорка | body | — |

### Казначей Фома Счётович (палата казначея)

Холст: 320×250 ед. (начало 0,0) → файл **1280×1000 px**. Эталоны: `guide-ch-treasurer-*.png`, общий вид `_reference-treasurer.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-treasurer-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-treasurer-body.webp` | туловище с ногами/одеждой без рук и головы | base | 160, 214 |
| `ch-treasurer-head.webp` | голова без глаз, рта и бровей | body | 160, 112 |
| `ch-treasurer-e-open.webp` | глаза — вариант «open» | head | 148, 76 |
| `ch-treasurer-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-treasurer-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-treasurer-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-treasurer-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-treasurer-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-treasurer-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-treasurer-b-n.webp` | брови — вариант «n» | head | — |
| `ch-treasurer-b-s.webp` | брови — вариант «s» | head | — |
| `ch-treasurer-b-u.webp` | брови — вариант «u» | head | — |
| `ch-treasurer-b-a.webp` | брови — вариант «a» | head | — |
| `ch-treasurer-m-n.webp` | рот — вариант «n» | head | — |
| `ch-treasurer-m-s.webp` | рот — вариант «s» | head | — |
| `ch-treasurer-m-g.webp` | рот — вариант «g» | head | — |
| `ch-treasurer-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-treasurer-m-o.webp` | рот — вариант «o» | head | 160, 101 |
| `ch-treasurer-m-w.webp` | рот — вариант «w» | head | — |
| `ch-treasurer-m-t.webp` | рот — вариант «t» | head | 160, 101 |
| `ch-treasurer-pince.webp` | пенсне | head | 160, 77 |
| `ch-treasurer-arm-l.webp` | левое плечо | body | 106, 132 |
| `ch-treasurer-arm-l-fore.webp` | левое предплечье с кистью | arm-l | 95, 170 |
| `ch-treasurer-quill.webp` | гусиное перо в руке | arm-l-fore | 101, 204 |
| `ch-treasurer-arm-r.webp` | правое плечо | body | 214, 132 |
| `ch-treasurer-arm-r-fore.webp` | правое предплечье с кистью | arm-r | 225, 168 |
| `ch-treasurer-puff.webp` | облачко пара/вздоха | body | — |

### Шут Гороховый (колесо)

Холст: 200×330 ед. (начало 0,0) → файл **800×1320 px**. Эталоны: `guide-ch-jester-*.png`, общий вид `_reference-jester.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-jester-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-jester-body.webp` | туловище с ногами/одеждой без рук и головы | base | 100, 312 |
| `ch-jester-head.webp` | голова без глаз, рта и бровей | body | 100, 114 |
| `ch-jester-h1.webp` | левый рог колпака с бубенцом | head | 80, 66 |
| `ch-jester-h3.webp` | правый рог колпака | head | 120, 66 |
| `ch-jester-h2.webp` | средний рог колпака | head | 100, 56 |
| `ch-jester-e-open.webp` | глаза — вариант «open» | head | 90, 85 |
| `ch-jester-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-jester-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-jester-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-jester-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-jester-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-jester-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-jester-b-n.webp` | брови — вариант «n» | head | — |
| `ch-jester-b-s.webp` | брови — вариант «s» | head | — |
| `ch-jester-b-u.webp` | брови — вариант «u» | head | — |
| `ch-jester-b-a.webp` | брови — вариант «a» | head | — |
| `ch-jester-m-n.webp` | рот — вариант «n» | head | — |
| `ch-jester-m-s.webp` | рот — вариант «s» | head | — |
| `ch-jester-m-g.webp` | рот — вариант «g» | head | — |
| `ch-jester-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-jester-m-o.webp` | рот — вариант «o» | head | 101, 104 |
| `ch-jester-m-w.webp` | рот — вариант «w» | head | — |
| `ch-jester-m-t.webp` | рот — вариант «t» | head | 101, 104 |
| `ch-jester-arm-l.webp` | левое плечо | body | 71, 130 |
| `ch-jester-arm-l-fore.webp` | левое предплечье с кистью | arm-l | 67, 175 |
| `ch-jester-arm-r.webp` | правое плечо | body | 71, 130 |
| `ch-jester-arm-r-fore.webp` | правое предплечье с кистью | arm-r | 67, 175 |
| `ch-jester-dagger-in-hand.webp` | кинжал в руке (скрывается при броске) | arm-r-fore | — |
| `ch-jester-sweat.webp` | капля пота | body | — |

### Повар Кузьма (кухня)

Холст: 260×300 ед. (начало 0,0) → файл **1040×1200 px**. Эталоны: `guide-ch-cook-*.png`, общий вид `_reference-cook.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-cook-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-cook-body.webp` | туловище с ногами/одеждой без рук и головы | base | 130, 244 |
| `ch-cook-head.webp` | голова без глаз, рта и бровей | body | 130, 128 |
| `ch-cook-e-open.webp` | глаза — вариант «open» | head | 116, 82 |
| `ch-cook-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-cook-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-cook-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-cook-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-cook-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-cook-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-cook-b-n.webp` | брови — вариант «n» | head | — |
| `ch-cook-b-s.webp` | брови — вариант «s» | head | — |
| `ch-cook-b-u.webp` | брови — вариант «u» | head | — |
| `ch-cook-b-a.webp` | брови — вариант «a» | head | — |
| `ch-cook-m-n.webp` | рот — вариант «n» | head | — |
| `ch-cook-m-s.webp` | рот — вариант «s» | head | — |
| `ch-cook-m-g.webp` | рот — вариант «g» | head | — |
| `ch-cook-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-cook-m-o.webp` | рот — вариант «o» | head | 130, 112 |
| `ch-cook-m-w.webp` | рот — вариант «w» | head | — |
| `ch-cook-m-t.webp` | рот — вариант «t» | head | 130, 112 |
| `ch-cook-arm-l.webp` | левое плечо | body | 76, 138 |
| `ch-cook-arm-l-fore.webp` | левое предплечье с кистью | arm-l | 64, 178 |
| `ch-cook-carrot.webp` | часть «carrot» | arm-l-fore | — |
| `ch-cook-arm-r.webp` | правое плечо | body | 76, 138 |
| `ch-cook-arm-r-fore.webp` | правое предплечье с кистью | arm-r | 64, 178 |
| `ch-cook-cleaver.webp` | часть «cleaver» | arm-r-fore | — |
| `ch-cook-ladle.webp` | часть «ladle» | arm-r-fore | — |
| `ch-cook-steam-puff.webp` | часть «steam-puff» | body | — |

### Боярин Счётов — худой, высокая горлатная шапка, очки, длинная седая борода, счёты в руках; зелёный кафтан

Холст: 170×360 ед. (начало 0,0) → файл **680×1440 px**. Эталоны: `guide-ch-boyar-schetov-*.png`, общий вид `_reference-boyar-schetov.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boyar-schetov-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boyar-schetov-shadow.webp` | тень на полу | base | 80, 350 |
| `ch-boyar-schetov-body.webp` | туловище с ногами/одеждой без рук и головы | base | 80, 350 |
| `ch-boyar-schetov-boot-b.webp` | задний сапог | body | 100, 350 |
| `ch-boyar-schetov-boot-f.webp` | передний сапог | body | 50, 350 |
| `ch-boyar-schetov-skirt.webp` | полы кафтана ниже пояса | body | 80, 346 |
| `ch-boyar-schetov-pelvis.webp` | пустая группа-шарнир таза (обычно без рисунка) | body | 80, 262 |
| `ch-boyar-schetov-torso.webp` | верх кафтана выше пояса, пояс | pelvis | 80, 262 |
| `ch-boyar-schetov-arm-far.webp` | дальняя рука (за корпусом) | torso | 63.8, 168 |
| `ch-boyar-schetov-neck.webp` | шея и воротник | torso | 80, 158 |
| `ch-boyar-schetov-head.webp` | голова без глаз, рта и бровей | neck | 80, 150 |
| `ch-boyar-schetov-e-open.webp` | глаза — вариант «open» | head | 66, 120 |
| `ch-boyar-schetov-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boyar-schetov-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boyar-schetov-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boyar-schetov-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boyar-schetov-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boyar-schetov-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boyar-schetov-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boyar-schetov-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boyar-schetov-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boyar-schetov-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boyar-schetov-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boyar-schetov-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boyar-schetov-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boyar-schetov-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boyar-schetov-m-o.webp` | рот — вариант «o» | head | 72, 144 |
| `ch-boyar-schetov-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boyar-schetov-m-t.webp` | рот — вариант «t» | head | 72, 144 |
| `ch-boyar-schetov-hat.webp` | шапка (запаздывает при поклоне) | head | 80, 104 |
| `ch-boyar-schetov-arm.webp` | ближняя рука с кистью | torso | 96.2, 168 |

### Боярин Пузатов — очень тучный, лисья шапка, рыжая круглая борода, золотая цепь; парчовый красный кафтан

Холст: 170×360 ед. (начало 0,0) → файл **680×1440 px**. Эталоны: `guide-ch-boyar-puzatov-*.png`, общий вид `_reference-boyar-puzatov.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boyar-puzatov-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boyar-puzatov-shadow.webp` | тень на полу | base | 80, 350 |
| `ch-boyar-puzatov-body.webp` | туловище с ногами/одеждой без рук и головы | base | 80, 350 |
| `ch-boyar-puzatov-boot-b.webp` | задний сапог | body | 100, 350 |
| `ch-boyar-puzatov-boot-f.webp` | передний сапог | body | 50, 350 |
| `ch-boyar-puzatov-skirt.webp` | полы кафтана ниже пояса | body | 80, 346 |
| `ch-boyar-puzatov-pelvis.webp` | пустая группа-шарнир таза (обычно без рисунка) | body | 80, 262 |
| `ch-boyar-puzatov-torso.webp` | верх кафтана выше пояса, пояс | pelvis | 80, 262 |
| `ch-boyar-puzatov-arm-far.webp` | дальняя рука (за корпусом) | torso | 56.2, 168 |
| `ch-boyar-puzatov-neck.webp` | шея и воротник | torso | 80, 158 |
| `ch-boyar-puzatov-head.webp` | голова без глаз, рта и бровей | neck | 80, 150 |
| `ch-boyar-puzatov-e-open.webp` | глаза — вариант «open» | head | 66, 120 |
| `ch-boyar-puzatov-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boyar-puzatov-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boyar-puzatov-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boyar-puzatov-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boyar-puzatov-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boyar-puzatov-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boyar-puzatov-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boyar-puzatov-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boyar-puzatov-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boyar-puzatov-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boyar-puzatov-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boyar-puzatov-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boyar-puzatov-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boyar-puzatov-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boyar-puzatov-m-o.webp` | рот — вариант «o» | head | 72, 144 |
| `ch-boyar-puzatov-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boyar-puzatov-m-t.webp` | рот — вариант «t» | head | 72, 144 |
| `ch-boyar-puzatov-hat.webp` | шапка (запаздывает при поклоне) | head | 80, 104 |
| `ch-boyar-puzatov-arm.webp` | ближняя рука с кистью | torso | 103.8, 168 |

### Боярин Тревогин — тощий, нервный, огромная чёрная горлатная шапка, раздвоенная чёрная борода, свиток; лазоревый кафтан

Холст: 170×360 ед. (начало 0,0) → файл **680×1440 px**. Эталоны: `guide-ch-boyar-trevogin-*.png`, общий вид `_reference-boyar-trevogin.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boyar-trevogin-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boyar-trevogin-shadow.webp` | тень на полу | base | 80, 350 |
| `ch-boyar-trevogin-body.webp` | туловище с ногами/одеждой без рук и головы | base | 80, 350 |
| `ch-boyar-trevogin-boot-b.webp` | задний сапог | body | 100, 350 |
| `ch-boyar-trevogin-boot-f.webp` | передний сапог | body | 50, 350 |
| `ch-boyar-trevogin-skirt.webp` | полы кафтана ниже пояса | body | 80, 346 |
| `ch-boyar-trevogin-pelvis.webp` | пустая группа-шарнир таза (обычно без рисунка) | body | 80, 262 |
| `ch-boyar-trevogin-torso.webp` | верх кафтана выше пояса, пояс | pelvis | 80, 262 |
| `ch-boyar-trevogin-arm-far.webp` | дальняя рука (за корпусом) | torso | 64.5, 168 |
| `ch-boyar-trevogin-neck.webp` | шея и воротник | torso | 80, 158 |
| `ch-boyar-trevogin-head.webp` | голова без глаз, рта и бровей | neck | 80, 150 |
| `ch-boyar-trevogin-e-open.webp` | глаза — вариант «open» | head | 66, 120 |
| `ch-boyar-trevogin-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boyar-trevogin-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boyar-trevogin-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boyar-trevogin-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boyar-trevogin-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boyar-trevogin-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boyar-trevogin-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boyar-trevogin-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boyar-trevogin-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boyar-trevogin-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boyar-trevogin-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boyar-trevogin-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boyar-trevogin-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boyar-trevogin-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boyar-trevogin-m-o.webp` | рот — вариант «o» | head | 72, 144 |
| `ch-boyar-trevogin-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boyar-trevogin-m-t.webp` | рот — вариант «t» | head | 72, 144 |
| `ch-boyar-trevogin-hat.webp` | шапка (запаздывает при поклоне) | head | 80, 104 |
| `ch-boyar-trevogin-arm.webp` | ближняя рука с кистью | torso | 95.5, 168 |

### Боярин Радостин — круглолицый добряк, белая мурмолка, белая лопатой борода, кошель; охряная парча

Холст: 170×360 ед. (начало 0,0) → файл **680×1440 px**. Эталоны: `guide-ch-boyar-radostin-*.png`, общий вид `_reference-boyar-radostin.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boyar-radostin-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boyar-radostin-shadow.webp` | тень на полу | base | 80, 350 |
| `ch-boyar-radostin-body.webp` | туловище с ногами/одеждой без рук и головы | base | 80, 350 |
| `ch-boyar-radostin-boot-b.webp` | задний сапог | body | 100, 350 |
| `ch-boyar-radostin-boot-f.webp` | передний сапог | body | 50, 350 |
| `ch-boyar-radostin-skirt.webp` | полы кафтана ниже пояса | body | 80, 346 |
| `ch-boyar-radostin-pelvis.webp` | пустая группа-шарнир таза (обычно без рисунка) | body | 80, 262 |
| `ch-boyar-radostin-torso.webp` | верх кафтана выше пояса, пояс | pelvis | 80, 262 |
| `ch-boyar-radostin-arm-far.webp` | дальняя рука (за корпусом) | torso | 59.1, 168 |
| `ch-boyar-radostin-neck.webp` | шея и воротник | torso | 80, 158 |
| `ch-boyar-radostin-head.webp` | голова без глаз, рта и бровей | neck | 80, 150 |
| `ch-boyar-radostin-e-open.webp` | глаза — вариант «open» | head | 66, 120 |
| `ch-boyar-radostin-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boyar-radostin-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boyar-radostin-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boyar-radostin-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boyar-radostin-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boyar-radostin-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boyar-radostin-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boyar-radostin-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boyar-radostin-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boyar-radostin-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boyar-radostin-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boyar-radostin-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boyar-radostin-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boyar-radostin-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boyar-radostin-m-o.webp` | рот — вариант «o» | head | 72, 144 |
| `ch-boyar-radostin-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boyar-radostin-m-t.webp` | рот — вариант «t» | head | 72, 144 |
| `ch-boyar-radostin-hat.webp` | шапка (запаздывает при поклоне) | head | 80, 104 |
| `ch-boyar-radostin-arm.webp` | ближняя рука с кистью | torso | 100.9, 168 |

### Боярин Подпискин — средний, мурмолка с мехом, длинная русая борода, длинный список; изумрудный кафтан

Холст: 170×360 ед. (начало 0,0) → файл **680×1440 px**. Эталоны: `guide-ch-boyar-podpiskin-*.png`, общий вид `_reference-boyar-podpiskin.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boyar-podpiskin-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boyar-podpiskin-shadow.webp` | тень на полу | base | 80, 350 |
| `ch-boyar-podpiskin-body.webp` | туловище с ногами/одеждой без рук и головы | base | 80, 350 |
| `ch-boyar-podpiskin-boot-b.webp` | задний сапог | body | 100, 350 |
| `ch-boyar-podpiskin-boot-f.webp` | передний сапог | body | 50, 350 |
| `ch-boyar-podpiskin-skirt.webp` | полы кафтана ниже пояса | body | 80, 346 |
| `ch-boyar-podpiskin-pelvis.webp` | пустая группа-шарнир таза (обычно без рисунка) | body | 80, 262 |
| `ch-boyar-podpiskin-torso.webp` | верх кафтана выше пояса, пояс | pelvis | 80, 262 |
| `ch-boyar-podpiskin-arm-far.webp` | дальняя рука (за корпусом) | torso | 62, 168 |
| `ch-boyar-podpiskin-neck.webp` | шея и воротник | torso | 80, 158 |
| `ch-boyar-podpiskin-head.webp` | голова без глаз, рта и бровей | neck | 80, 150 |
| `ch-boyar-podpiskin-e-open.webp` | глаза — вариант «open» | head | 66, 120 |
| `ch-boyar-podpiskin-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boyar-podpiskin-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boyar-podpiskin-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boyar-podpiskin-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boyar-podpiskin-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boyar-podpiskin-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boyar-podpiskin-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boyar-podpiskin-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boyar-podpiskin-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boyar-podpiskin-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boyar-podpiskin-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boyar-podpiskin-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boyar-podpiskin-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boyar-podpiskin-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boyar-podpiskin-m-o.webp` | рот — вариант «o» | head | 72, 144 |
| `ch-boyar-podpiskin-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boyar-podpiskin-m-t.webp` | рот — вариант «t» | head | 72, 144 |
| `ch-boyar-podpiskin-hat.webp` | шапка (запаздывает при поклоне) | head | 80, 104 |
| `ch-boyar-podpiskin-arm.webp` | ближняя рука с кистью | torso | 98, 168 |

### Боярин Диковинов — любопытный, колпак, кудрявая борода, увеличительное стекло; лазурь в горошек

Холст: 170×360 ед. (начало 0,0) → файл **680×1440 px**. Эталоны: `guide-ch-boyar-dikovinov-*.png`, общий вид `_reference-boyar-dikovinov.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boyar-dikovinov-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boyar-dikovinov-shadow.webp` | тень на полу | base | 80, 350 |
| `ch-boyar-dikovinov-body.webp` | туловище с ногами/одеждой без рук и головы | base | 80, 350 |
| `ch-boyar-dikovinov-boot-b.webp` | задний сапог | body | 100, 350 |
| `ch-boyar-dikovinov-boot-f.webp` | передний сапог | body | 50, 350 |
| `ch-boyar-dikovinov-skirt.webp` | полы кафтана ниже пояса | body | 80, 346 |
| `ch-boyar-dikovinov-pelvis.webp` | пустая группа-шарнир таза (обычно без рисунка) | body | 80, 262 |
| `ch-boyar-dikovinov-torso.webp` | верх кафтана выше пояса, пояс | pelvis | 80, 262 |
| `ch-boyar-dikovinov-arm-far.webp` | дальняя рука (за корпусом) | torso | 62.9, 168 |
| `ch-boyar-dikovinov-neck.webp` | шея и воротник | torso | 80, 158 |
| `ch-boyar-dikovinov-head.webp` | голова без глаз, рта и бровей | neck | 80, 150 |
| `ch-boyar-dikovinov-e-open.webp` | глаза — вариант «open» | head | 66, 120 |
| `ch-boyar-dikovinov-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boyar-dikovinov-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boyar-dikovinov-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boyar-dikovinov-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boyar-dikovinov-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boyar-dikovinov-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boyar-dikovinov-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boyar-dikovinov-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boyar-dikovinov-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boyar-dikovinov-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boyar-dikovinov-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boyar-dikovinov-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boyar-dikovinov-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boyar-dikovinov-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boyar-dikovinov-m-o.webp` | рот — вариант «o» | head | 72, 144 |
| `ch-boyar-dikovinov-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boyar-dikovinov-m-t.webp` | рот — вариант «t» | head | 72, 144 |
| `ch-boyar-dikovinov-hat.webp` | шапка (запаздывает при поклоне) | head | 80, 104 |
| `ch-boyar-dikovinov-arm.webp` | ближняя рука с кистью | torso | 97.1, 168 |

### Боярин Чекушкин — низенький, колпак, козлиная бородка, кошель; киноварный кафтан

Холст: 170×360 ед. (начало 0,0) → файл **680×1440 px**. Эталоны: `guide-ch-boyar-chekushkin-*.png`, общий вид `_reference-boyar-chekushkin.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boyar-chekushkin-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boyar-chekushkin-shadow.webp` | тень на полу | base | 80, 350 |
| `ch-boyar-chekushkin-body.webp` | туловище с ногами/одеждой без рук и головы | base | 80, 350 |
| `ch-boyar-chekushkin-boot-b.webp` | задний сапог | body | 100, 350 |
| `ch-boyar-chekushkin-boot-f.webp` | передний сапог | body | 50, 350 |
| `ch-boyar-chekushkin-skirt.webp` | полы кафтана ниже пояса | body | 80, 346 |
| `ch-boyar-chekushkin-pelvis.webp` | пустая группа-шарнир таза (обычно без рисунка) | body | 80, 262 |
| `ch-boyar-chekushkin-torso.webp` | верх кафтана выше пояса, пояс | pelvis | 80, 262 |
| `ch-boyar-chekushkin-arm-far.webp` | дальняя рука (за корпусом) | torso | 60.6, 168 |
| `ch-boyar-chekushkin-neck.webp` | шея и воротник | torso | 80, 158 |
| `ch-boyar-chekushkin-head.webp` | голова без глаз, рта и бровей | neck | 80, 150 |
| `ch-boyar-chekushkin-e-open.webp` | глаза — вариант «open» | head | 66, 120 |
| `ch-boyar-chekushkin-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boyar-chekushkin-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boyar-chekushkin-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boyar-chekushkin-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boyar-chekushkin-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boyar-chekushkin-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boyar-chekushkin-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boyar-chekushkin-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boyar-chekushkin-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boyar-chekushkin-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boyar-chekushkin-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boyar-chekushkin-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boyar-chekushkin-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boyar-chekushkin-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boyar-chekushkin-m-o.webp` | рот — вариант «o» | head | 72, 144 |
| `ch-boyar-chekushkin-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boyar-chekushkin-m-t.webp` | рот — вариант «t» | head | 72, 144 |
| `ch-boyar-chekushkin-hat.webp` | шапка (запаздывает при поклоне) | head | 80, 104 |
| `ch-boyar-chekushkin-arm.webp` | ближняя рука с кистью | torso | 99.4, 168 |

### Боярин Летописцев — старейший, высокая меховая шапка, очень длинная белая борода, толстая книга; тёмно-красный кафтан

Холст: 170×360 ед. (начало 0,0) → файл **680×1440 px**. Эталоны: `guide-ch-boyar-letopiscev-*.png`, общий вид `_reference-boyar-letopiscev.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boyar-letopiscev-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boyar-letopiscev-shadow.webp` | тень на полу | base | 80, 350 |
| `ch-boyar-letopiscev-body.webp` | туловище с ногами/одеждой без рук и головы | base | 80, 350 |
| `ch-boyar-letopiscev-boot-b.webp` | задний сапог | body | 100, 350 |
| `ch-boyar-letopiscev-boot-f.webp` | передний сапог | body | 50, 350 |
| `ch-boyar-letopiscev-skirt.webp` | полы кафтана ниже пояса | body | 80, 346 |
| `ch-boyar-letopiscev-pelvis.webp` | пустая группа-шарнир таза (обычно без рисунка) | body | 80, 262 |
| `ch-boyar-letopiscev-torso.webp` | верх кафтана выше пояса, пояс | pelvis | 80, 262 |
| `ch-boyar-letopiscev-arm-far.webp` | дальняя рука (за корпусом) | torso | 61.6, 168 |
| `ch-boyar-letopiscev-neck.webp` | шея и воротник | torso | 80, 158 |
| `ch-boyar-letopiscev-head.webp` | голова без глаз, рта и бровей | neck | 80, 150 |
| `ch-boyar-letopiscev-e-open.webp` | глаза — вариант «open» | head | 66, 120 |
| `ch-boyar-letopiscev-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boyar-letopiscev-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boyar-letopiscev-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boyar-letopiscev-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boyar-letopiscev-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boyar-letopiscev-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boyar-letopiscev-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boyar-letopiscev-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boyar-letopiscev-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boyar-letopiscev-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boyar-letopiscev-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boyar-letopiscev-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boyar-letopiscev-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boyar-letopiscev-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boyar-letopiscev-m-o.webp` | рот — вариант «o» | head | 72, 144 |
| `ch-boyar-letopiscev-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boyar-letopiscev-m-t.webp` | рот — вариант «t» | head | 72, 144 |
| `ch-boyar-letopiscev-hat.webp` | шапка (запаздывает при поклоне) | head | 80, 104 |
| `ch-boyar-letopiscev-arm.webp` | ближняя рука с кистью | torso | 98.4, 168 |

### Босс: Купец Обдирала — торговые ряды, весы, мешки

Холст: 260×250 ед. (начало -10,-12) → файл **1040×1000 px**. Эталоны: `guide-ch-boss-kupets-*.png`, общий вид `_reference-boss-kupets.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boss-kupets-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boss-kupets-fig.webp` | часть «fig» | base | 120, 228 |
| `ch-boss-kupets-sack.webp` | часть «sack» | fig | 50, 226 |
| `ch-boss-kupets-belly.webp` | часть «belly» | fig | 120, 214 |
| `ch-boss-kupets-arm-rub.webp` | часть «arm-rub» | fig | 80, 120 |
| `ch-boss-kupets-head.webp` | голова без глаз, рта и бровей | fig | 120, 106 |
| `ch-boss-kupets-e-open.webp` | глаза — вариант «open» | head | 107, 72 |
| `ch-boss-kupets-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boss-kupets-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boss-kupets-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boss-kupets-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boss-kupets-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boss-kupets-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boss-kupets-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boss-kupets-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boss-kupets-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boss-kupets-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boss-kupets-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boss-kupets-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boss-kupets-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boss-kupets-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boss-kupets-m-o.webp` | рот — вариант «o» | head | 120, 96 |
| `ch-boss-kupets-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boss-kupets-m-t.webp` | рот — вариант «t» | head | 120, 96 |
| `ch-boss-kupets-arm-scale.webp` | часть «arm-scale» | fig | 160, 110 |
| `ch-boss-kupets-scales.webp` | часть «scales» | fig | 191, 70 |
| `ch-boss-kupets-p1.webp` | часть «p1» | scales | 154, 70 |
| `ch-boss-kupets-p2.webp` | часть «p2» | scales | 228, 70 |
| `ch-boss-kupets-stars.webp` | часть «stars» | base | 120, 22 |

### Босс: Змей Подписочный — горы, трёхглавый

Холст: 260×250 ед. (начало -10,-12) → файл **1040×1000 px**. Эталоны: `guide-ch-boss-zmey-*.png`, общий вид `_reference-boss-zmey.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boss-zmey-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boss-zmey-fig.webp` | часть «fig» | base | 120, 228 |
| `ch-boss-zmey-tail.webp` | часть «tail» | fig | 166, 190 |
| `ch-boss-zmey-wings.webp` | часть «wings» | fig | 120, 124 |
| `ch-boss-zmey-n1.webp` | часть «n1» | fig | 104, 126 |
| `ch-boss-zmey-e-x-on.webp` | глаза — вариант «x-on» | n1 | — |
| `ch-boss-zmey-n3.webp` | часть «n3» | fig | 136, 126 |
| `ch-boss-zmey-n2.webp` | часть «n2» | fig | 120, 120 |
| `ch-boss-zmey-stars.webp` | часть «stars» | base | 120, 8 |

### Босс: Мытарь Пошлинник — у моста, с книгой пошлин

Холст: 260×250 ед. (начало -10,-12) → файл **1040×1000 px**. Эталоны: `guide-ch-boss-mytar-*.png`, общий вид `_reference-boss-mytar.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boss-mytar-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boss-mytar-fig.webp` | часть «fig» | base | 120, 228 |
| `ch-boss-mytar-barrier.webp` | часть «barrier» | fig | 42, 126 |
| `ch-boss-mytar-ledger.webp` | часть «ledger» | fig | 84, 144 |
| `ch-boss-mytar-head.webp` | голова без глаз, рта и бровей | fig | 120, 88 |
| `ch-boss-mytar-e-open.webp` | глаза — вариант «open» | head | 112, 56 |
| `ch-boss-mytar-e-sad.webp` | глаза — вариант «sad» | head | — |
| `ch-boss-mytar-e-sly.webp` | глаза — вариант «sly» | head | — |
| `ch-boss-mytar-e-closed.webp` | глаза — вариант «closed» | head | — |
| `ch-boss-mytar-e-happy.webp` | глаза — вариант «happy» | head | — |
| `ch-boss-mytar-e-wide.webp` | глаза — вариант «wide» | head | — |
| `ch-boss-mytar-e-x.webp` | глаза — вариант «x» | head | — |
| `ch-boss-mytar-b-n.webp` | брови — вариант «n» | head | — |
| `ch-boss-mytar-b-s.webp` | брови — вариант «s» | head | — |
| `ch-boss-mytar-b-u.webp` | брови — вариант «u» | head | — |
| `ch-boss-mytar-b-a.webp` | брови — вариант «a» | head | — |
| `ch-boss-mytar-m-n.webp` | рот — вариант «n» | head | — |
| `ch-boss-mytar-m-s.webp` | рот — вариант «s» | head | — |
| `ch-boss-mytar-m-g.webp` | рот — вариант «g» | head | — |
| `ch-boss-mytar-m-sad.webp` | рот — вариант «sad» | head | — |
| `ch-boss-mytar-m-o.webp` | рот — вариант «o» | head | 118, 78 |
| `ch-boss-mytar-m-w.webp` | рот — вариант «w» | head | — |
| `ch-boss-mytar-m-t.webp` | рот — вариант «t» | head | 118, 78 |
| `ch-boss-mytar-stamp-arm.webp` | часть «stamp-arm» | fig | 146, 110 |
| `ch-boss-mytar-stamp.webp` | часть «stamp» | stamp-arm | 189, 70 |
| `ch-boss-mytar-stars.webp` | часть «stars» | base | 120, 14 |

### Босс: Кот Транжира — ярмарка

Холст: 260×250 ед. (начало -10,-12) → файл **1040×1000 px**. Эталоны: `guide-ch-boss-kot-*.png`, общий вид `_reference-boss-kot.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boss-kot-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boss-kot-fig.webp` | часть «fig» | base | 120, 228 |
| `ch-boss-kot-tail.webp` | часть «tail» | fig | 164, 200 |
| `ch-boss-kot-basket.webp` | часть «basket» | fig | 62, 184 |
| `ch-boss-kot-paw.webp` | часть «paw» | fig | 160, 124 |
| `ch-boss-kot-head.webp` | голова без глаз, рта и бровей | fig | 120, 104 |
| `ch-boss-kot-cateyes.webp` | часть «cateyes» | head | 120, 70 |
| `ch-boss-kot-e-x-on.webp` | глаза — вариант «x-on» | head | — |
| `ch-boss-kot-cathat.webp` | часть «cathat» | head | 120, 40 |
| `ch-boss-kot-stars.webp` | часть «stars» | base | 120, 14 |

### Босс: Улита Проволочка — болото

Холст: 260×250 ед. (начало -10,-12) → файл **1040×1000 px**. Эталоны: `guide-ch-boss-ulita-*.png`, общий вид `_reference-boss-ulita.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boss-ulita-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boss-ulita-fig.webp` | часть «fig» | base | 120, 228 |
| `ch-boss-ulita-fig-foot.webp` | часть «fig-foot» | fig | 210, 210 |
| `ch-boss-ulita-neck.webp` | шея и воротник | fig | 60, 200 |
| `ch-boss-ulita-s1.webp` | часть «s1» | neck | 57, 130 |
| `ch-boss-ulita-s2.webp` | часть «s2» | neck | 69, 132 |
| `ch-boss-ulita-shell.webp` | часть «shell» | fig | 144, 194 |
| `ch-boss-ulita-flag.webp` | часть «flag» | shell | 168, 76 |
| `ch-boss-ulita-stars.webp` | часть «stars» | base | 64, 60 |

### Босс: Кощей Скупой — тёмный замок, корона

Холст: 260×250 ед. (начало -10,-12) → файл **1040×1000 px**. Эталоны: `guide-ch-boss-koschey-*.png`, общий вид `_reference-boss-koschey.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boss-koschey-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boss-koschey-fig.webp` | часть «fig» | base | 120, 228 |
| `ch-boss-koschey-cloak.webp` | часть «cloak» | fig | 120, 184 |
| `ch-boss-koschey-head.webp` | голова без глаз, рта и бровей | fig | 120, 84 |
| `ch-boss-koschey-e-x-on.webp` | глаза — вариант «x-on» | head | — |
| `ch-boss-koschey-crown.webp` | часть «crown» | head | 120, 30 |
| `ch-boss-koschey-hands.webp` | часть «hands» | fig | 120, 140 |
| `ch-boss-koschey-chest.webp` | часть «chest» | fig | 120, 228 |
| `ch-boss-koschey-stars.webp` | часть «stars» | base | 120, 4 |

### Босс: Баба Яга Процентная — избушка в лесу

Холст: 260×250 ед. (начало -10,-12) → файл **1040×1000 px**. Эталоны: `guide-ch-boss-yaga-*.png`, общий вид `_reference-boss-yaga.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boss-yaga-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boss-yaga-fig.webp` | часть «fig» | base | 120, 214 |
| `ch-boss-yaga-fly.webp` | часть «fly» | fig | 120, 214 |
| `ch-boss-yaga-broom.webp` | часть «broom» | fly | 150, 160 |
| `ch-boss-yaga-head.webp` | голова без глаз, рта и бровей | fly | 120, 106 |
| `ch-boss-yaga-e-x-on.webp` | глаза — вариант «x-on» | head | — |
| `ch-boss-yaga-pestle-arm.webp` | часть «pestle-arm» | fly | 138, 112 |
| `ch-boss-yaga-stars.webp` | часть «stars» | base | 120, 36 |

### Босс: Чудо-Юдо Инфляция — у моря

Холст: 260×250 ед. (начало -10,-12) → файл **1040×1000 px**. Эталоны: `guide-ch-boss-chudo-*.png`, общий вид `_reference-boss-chudo.png`.

| Файл | Что нарисовать | Родитель | Шарнир (x, y) |
|---|---|---|---|
| `ch-boss-chudo-base.webp` | всё, что не относится к другим частям (тень на полу и т. п.) | — | — |
| `ch-boss-chudo-beast.webp` | часть «beast» | base | 120, 236 |
| `ch-boss-chudo-jaw.webp` | часть «jaw» | beast | 112, 166 |
| `ch-boss-chudo-e-x-on.webp` | глаза — вариант «x-on» | beast | — |
| `ch-boss-chudo-spout.webp` | часть «spout» | beast | 196, 68 |
| `ch-boss-chudo-stars.webp` | часть «stars» | base | 124, 92 |


## Порядок работы для художника

1. Распакуйте `tsarskaya-kazna-art-kit.zip`. Откройте `_reference-*.png` и `guide-*.png` нужного персонажа.
2. Нарисуйте части на холсте нужного размера. Каждая часть — отдельный слой, в позе покоя. Слои, которые вращаются, должны заходить под соседние.
3. Экспортируйте каждый слой во весь холст (без обрезки) в WebP с альфой. Имена — строго по таблице.
4. Положите файлы в корень сайта и впишите их в `art-manifest.json`.
5. Откройте приложение и проверьте позы и анимации:
   - бояре — экран «Бояре», поклон;
   - шут — «Колесо», поездка на ободе;
   - слуга — «Главная», доход и перевод в ларец;
   - казначей — «Казначей», подождите 10–15 секунд, он начнёт считать монеты и поправлять пенсне.
