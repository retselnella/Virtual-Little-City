# Little City: World Tour

An open-world action game that runs in your web browser. Sail or fly between seven island cities, each on an island with its own landscape, ride the metro, drive out past the city limits to beaches, forests, farmland and mountains, fight, escape the police, finish contracts, and meet other players in the same city. Every day at 12:00 Philippine time a giant **Kaiju** rises off one of the cities, and everyone fights it together for a place on the weekly leaderboard. Day and night follow the time in the Philippines, and the whole world shares one weather.

**Contents**

1. [Getting started](#1-getting-started)
2. [Creating your character](#2-creating-your-character)
3. [Controls](#3-controls)
4. [Reading the screen](#4-reading-the-screen)
5. [Cities and travel](#5-cities-and-travel)
   - [The islands](#the-islands)
   - [The metro](#the-metro)
   - [Boats and sailing](#boats-and-sailing)
   - [Day, night and weather](#day-night-and-weather)
6. [Contracts](#6-contracts)
7. [Fighting](#7-fighting)
8. [Kaiju: the world boss](#8-kaiju-the-world-boss)
9. [Police and your wanted level](#9-police-and-your-wanted-level)
10. [Driving](#10-driving)
11. [Life on the streets](#11-life-on-the-streets)
12. [Playing together](#12-playing-together)
13. [Saves and settings](#13-saves-and-settings)
14. [Troubleshooting](#14-troubleshooting)
15. [For site owners: running, online play and deployment](#15-for-site-owners-running-online-play-and-deployment)

---

## 1. Getting started

Open the game's web address in a recent desktop or mobile browser (Chrome, Edge, Firefox or Safari). The game needs **WebGL** (hardware graphics). There is nothing to install and no account to create: you play as a guest, and this browser remembers you (see [Saves and settings](#13-saves-and-settings)).

The first time you play, you design your character. After that, the game opens straight into your city.

## 2. Creating your character

The character creator appears before your first game.

- **Name**: up to 24 characters. It appears in your HUD and above your head for other players. Leave it blank to be called "Newcomer".
- **Look**: skin tone, hair style (short, long, buzz cut, bun, cap or bald), hair colour (a cap takes the hair colour), shirt, trousers and shoes.
- **Build**: compact, average or tall. This changes your size in the game, not just how you look.
- **Preview**: the 3D model updates as you choose. Drag it to turn it around.
- **Randomize** picks a random look (it keeps your name). **Reset** returns to the default look.
- Press **Start playing** to begin.

You can change your look at any time: pause the game (**Esc** or the **Ⅱ** button) and choose **Edit character**. The game waits while you edit. Your cash, contracts and position stay as they are. **Cancel** or **Esc** closes the editor without changes.

## 3. Controls

### Keyboard

| Key | On foot | In a car | In the boat |
| --- | --- | --- | --- |
| **W A S D** or arrows | Walk | Accelerate, brake/reverse, steer | Throttle, reverse, rudder |
| **Shift** | Sprint | | Full speed |
| **Space** | Jump | Handbrake (slides the rear for drifting) | |
| **F** | Get into your car or the boat (stand next to it) | Get out (stop first) | Go ashore (slow down next to a beach or the marina) |
| **J** | Shoot or punch; hold to keep attacking | | |
| **Q** | Switch between pistol and fists | | |
| **R** | Reload the pistol | | |
| **E** | Collect, deliver, heal at the City Hub, or take the metro at a station | | |
| **M** | World map, island map and travel | World map, island map and travel | World map, island map and travel |
| **L** | Contract board | Contract board | Contract board |
| **B** | Kaiju event and rankings | Kaiju event and rankings | Kaiju event and rankings |
| **Esc** | Pause menu and controls | Pause menu | Pause menu |
| **Mouse drag / scroll** | Turn and zoom the camera | Turn and zoom the camera | Turn and zoom the camera |

A button above the controls bar always shows what you can do right where you are (for example **F Take the boat** or **E Take the metro · North station**); you can also click or tap it.

Movement follows the camera: **W** always walks the way the camera faces.

### Touch screens

On phones and tablets, on-screen arrows move you, **Run** sprints, and **Jump** (or **Brake** in a car) is next to them. The buttons at the bottom right enter and exit the car, attack, interact, switch weapon and reload. Drag the city to turn the camera, and pinch to zoom.

Opening any menu pauses the game.

## 4. Reading the screen

- **Top centre**: the **sky chip**: the time in the Philippines (PH time) and the current weather.
- **Top left**: the country and region, the city, the part of the island you are in (a district such as *Neon Crossing*, or *Ring road*, *Beach*, *Lighthouse*, *Open sea* and so on), and your connection to other players (see [Playing together](#12-playing-together)).
- **Top right**: your name, **wanted stars**, cash, **health** (it glows red when low), and your weapon with ammunition, or your speed while driving.
- **Left panel**: your current objective and the distance to the gold marker. **Find a contract** or **Contract details** opens the contract board. On a sea voyage it shows your course, and on the metro the next stop. The **GPS** buttons on the island map set the gold marker to a place such as the marina or the airport.
- **Kaiju banner** (under the sky chip, from an hour before the event): the countdown, then the Kaiju's health, the time left, and your damage and rank. See [Kaiju: the world boss](#8-kaiju-the-world-boss).
- **Police panel** (while wanted): what the police are doing, such as dispatching, en route, searching your last known location, on scene, or trying to arrest you.
- **Minimap** (bottom left): a round map centred on you, with north up. It zooms out as you drive faster, and a gold arrow on its edge points to an objective that is off the map. **Map ↗** opens the full island map.
  - white arrow: you
  - cyan dot: your car
  - green dot: the City Hub forecourt (spawn); the hub building is the mint block beside it
  - gold dot and dashed line: your objective
  - red dots: gang members
  - blue dots: police officers
  - squares: police cars, flashing when responding
  - pale yellow dots: other players
  - light blue dot: your boat; brown strip: the marina pier
  - blue dashed square and blue dots: the elevated metro loop and its four stations
  - orange dot: the lighthouse; coloured shapes: hills, mountains, dunes and volcanoes (white tops are snow); dark green: forest; teal: lakes and rice paddies; brown squares: houses
- **Ring on the ground**: who your next attack will hit. Red means a threat, white means a bystander.
- **Messages** appear briefly at the top of the screen.

## 5. Cities and travel

Seven cities are available: **Miami, Tokyo, Manila, London, Dubai, Rio de Janeiro and Cape Town**. Each is a large district with its own skyline, colours, traffic, pedestrians and waterfront, on its own island.

Press **M** for the **World map**: the whole world at once, with every city by its usual name, a pulsing **YOU ARE HERE** marker on your city, how many players are online in each, and, around event time, where the Kaiju is. Below the map, each city has a card with two ways to get there:

- **Sail**: sets a course for that city. Take your boat from the marina, head out to open sea, and follow the course; the left panel shows the heading and the distance left. The voyage only counts while you are in open sea and roughly on course. When you arrive, you come in by boat offshore of the new island, heading for its marina.
- **Fly**: instant, but only from the **airport** (walk or drive to it; the **Airport** GPS chip shows the way, and a prompt appears when you are there).

You cannot travel while you have an unfinished contract, while you are wanted, or while you are down. The map's second tab, named after your city (for example **Miami map**), is the full map of the island you are on, with GPS buttons for the marina, airport, metro and City Hub.

Everyone starts at the **City Hub**, a glass-fronted public office on the corner of the two central avenues. Its forecourt (the mint-green pad with your cyan car parked outside) is where you arrive, respawn and heal, and because every player arrives there too, it is the natural place to meet colleagues and friends.

### The islands

Every city stands on the east shore of its own island, and no two islands are alike. Each has its own coastline and landscape:

| City | Island |
| --- | --- |
| Miami | Barrier key, dunes, mangrove lagoons, citrus groves |
| Tokyo | Snow-capped volcano, cedar and cherry forest, rice paddies, shrine |
| Manila | Perfect-cone volcano, rice terraces, rainforest, bay |
| London | Rolling chalk downs, oak woods, hedged farms, estuary |
| Dubai | Desert dunes, red mesas, oasis, date-palm groves, fort |
| Rio de Janeiro | Granite domes, Atlantic rainforest, beaches, hillside favela |
| Cape Town | Flat-topped mesa, peaks, fynbos, vineyards, manor |

On every island you will also find:

- the **Ring road**, which leaves the city and loops round the island, lit by street lamps at night, with side streets through a **suburb** of houses
- **beaches** round the coast, a **lighthouse** on its cape, a **campsite**, forests with rocks, logs, bushes, flowers and long grass, fields, lakes and hills
- the **marina** on the east waterfront, where your boat is moored, and the **airport** on the west side of the city

Hills and gentle slopes can be walked and driven over; volcano cones, cliffs and mesa walls are too steep. Trees, rocks, logs, houses and fences are solid, and the sea and lakes stop you at the shore. When trees come between you and the camera, they are hidden so you can always see yourself. Press **M** and open the island tab for the full map with place names.

### The metro

An elevated metro loop runs above the city streets, with four stations: **North, East, South and West**. Walk to a station (a prompt appears) and press **E** to wait on the platform; the prompt counts down to the next train, which boards automatically. On board, press **E** when the train stops at a station to get off there. The trains run to a timetable, so every player sees the same train at the same place.

### Boats and sailing

Your speedboat is moored at the end of the **marina** pier on the east waterfront. Stand next to it and press **F**. **W/S** is throttle and reverse, **A/D** the rudder (it only bites when you are moving), and **Shift** gives full speed. Sail round your island, or set a course from the World map and sail to another one. To land, slow down next to a beach or the marina and press **F** again; your boat stays where you left it.

### Day, night and weather

- **Time of day follows the Philippines** (Philippine time, UTC+8) and the real position of the sun over Manila, so sunrise and sunset match Manila's. The sky chip shows the PH time.
- At night, windows light up, street lamps cast pools of light, neon glows on the shop fronts, car lights come on and the lighthouse beam sweeps the cape.
- **The weather is shared by the whole world.** It is worked out from the time alone, so every city and every player has the same weather at the same moment: when it rains in one city, it rains in all of them. It drifts between clear skies, clouds, rain and thunderstorms, with more rain and afternoon storms during the Philippine wet season (June to November). A message tells you when rain arrives or clears.

## 6. Contracts

Each city has three contracts, 21 in total:

| Contract | Reward | What to do |
| --- | --- | --- |
| **Midnight delivery** | $650 | Collect a package at the gold marker, then deliver it across the city. |
| **Take back the block** | $1,200 | Defeat the four armed gang members, lose the police, then return to the City Hub. |
| **Heat on the highway** | $950 | Pick up a case, which brings two wanted stars. Escape the police, then reach the drop-off. |

- Press **L** to open the contract board and accept one. Only one contract can be active at a time.
- Follow the **gold marker**. At the marker, **stop** within about 12 metres and press **E**.
- You must have **no wanted stars** to collect a reward.
- Each contract pays once per city. You can **abandon** an unfinished contract from the board and restart it later.
- If you are wasted, busted or return to the City Hub, the unfinished contract is cancelled. Your earned cash is kept.

## 7. Fighting

- **Pistol**: 48 rounds, unlimited spare ammunition. It reloads automatically when empty, or press **R**. It is strongest up to about 30 metres, and reaches about 65.
- **Fists**: press **J** quickly for a **jab, cross and hook**. The hook knocks people off their feet; they get up again unless they were defeated.
- **Aiming**: aim with the camera. The game locks onto the best target: armed threats first, and bystanders only when they are in front of you. The ring on the ground shows who you will hit.
- **Cover**: buildings, cars and lamp posts block bullets, for you and for anyone shooting at you. Standing still makes you easier to hit. Sprinting and distance make enemies miss more.
- **Children** can never be targeted or hurt.
- **Health**: at zero health you are **WASTED** and wake up at the City Hub. To heal, walk onto the City Hub forecourt and press **E** while you are not wanted. This also refills your ammunition.
- **Blood** effects can be switched off in the pause menu.

## 8. Kaiju: the world boss

Every day at **12:00 Philippine time**, a giant Kaiju, taller than the city's towers, rises from the sea off one of the seven cities and attacks it for **one hour**. The cities take turns, one per day. It has **1,000,000,000 HP** shared by every player in the world.

- **Before**: an hour ahead, a banner announces where it will appear, with a countdown. Sail or fly there in time. The World map marks the city.
- **The fight**: it wades ashore and stomps through the streets. Shoot or punch it (**J**) from up to about 220 metres. It fights back in turn with a **fire breath** cone, a sweeping **laser beam**, a **ground slam** shockwave that knocks you down, a **roar** that stuns you for a moment, a rain of **meteors** (watch for the red circles on the ground) and a **tail sweep**. Its feet crush anything underneath. Attacks hurt, throw you back, and can leave you **WASTED**. Red warnings on the ground show where the next attack will land.
- **Destruction**: buildings, trees and lamp posts it hits collapse into rubble and craters. The damage stays for the whole hour and the city is restored when the event ends.
- **The end**: when its HP reaches zero it is **defeated**. If time runs out first, it **retreats**. Either way, the next day's event is prepared.

Press **B** (or the **Kaiju** button) for the event panel:

- the event status, the Kaiju's HP, and your damage, rank, hits and deaths
- the **live ranking**: rank, player, total damage and share of the damage dealt
- the **weekly leaderboard**, which adds up everyone's damage from Monday 00:00 to Sunday 23:59 Philippine time and then resets

Weekly rewards (claim them from the panel once the week is over; each reward can be claimed once):

| Final weekly rank | Reward |
| --- | --- |
| #1 | $100,000 and the "Kaiju Slayer" title |
| #2–10 | $50,000 and the "Kaiju Hunter" title |
| #11–100 | $10,000 and the "Defender" title |

**Fair play**: the server decides everything that matters. Your game only reports *how many* shots and punches landed. The server checks each batch against the weapons' fire rates, the time since your last report, and your distance from where the Kaiju is at that moment (it computes the Kaiju's path itself), then applies the damage per hit. The server also owns the schedule, HP, defeat, deaths, rankings and rewards, and the destruction follows from the event's server-issued seed, so it is the same for everyone.

## 9. Police and your wanted level

Attacking anyone, or hitting people with your car, gives you **wanted stars**. Hurting bystanders or police adds more. Fighting gang members stays at one star.

- **Arrival**: police arrive a few seconds later in patrol cars that drive through the streets. More stars bring more cars, up to three.
- **One star**: officers try to **arrest** you on foot. If one reaches you while you stand still, you are **BUSTED**: you lose up to $500 and are released at the City Hub. Run, drive away, or fight back to resist.
- **Two or more stars**: officers shoot.
- **Chases**: a patrol car that sees you chases you. Out of sight, police search where you were last seen. Drive away and officers on foot get back in their car and follow.
- **Losing them**: stop attacking for **12 seconds** and stay **out of sight for 8 seconds**. Your stars then fade. Buildings and distance help.

## 10. Driving

Your car is the cyan coupe next to the City Hub. Walk up to it and press **F**. To get out, stop and press **F** again.

- The car has real momentum. Brake before corners; **Space** is the handbrake, for sliding turns.
- Crashes damage the car and hurt you. Fast impacts knock lamp posts over. Trees and buildings stop you.
- If the car ends up on its side or roof, wait a moment and it is set back on its wheels.
- Pause and choose **Return to City Hub** if you get stuck anywhere. This also cancels an unfinished contract.

## 11. Life on the streets

About 95 people live in each city. You will see families with children holding hands, office workers taking phone calls, joggers, and friends chatting. There are food stalls with vendors and queues, bus stops where people sit and wait, and benches. People walk to these places, stay a while and move on. Traffic drives in lanes and gives way to pedestrians. Violence nearby sends everyone running; vendors come back once it is calm.

## 12. Playing together

Everyone playing in the same city can see each other: your character, name tag, and your car when you drive. You also see each other fight: raising a pistol or fists, punching, muzzle flashes, bullet tracers, and blood where a hit landed. Other players also appear as pale yellow dots on the minimap, and the world map shows how many people are in each city.

The status under the city name shows your connection:

| Status | Meaning |
| --- | --- |
| **Online · N other players here** | Connected to the shared world. |
| **Connecting to the shared world…** | Joining; this usually takes a moment. |
| **Offline · playing solo** | The shared world could not be reached. The game works normally on its own. |
| **Local · N other tabs** | This site has no online server set up; only other tabs in *this* browser are shared. |

Things to know:

- Other players are visible, including when they drive, sail or ride the metro, but pass through you, and you cannot fight each other. Traffic, pedestrians, police, contracts and money are your own, so the person another player hits exists only in their game: you see the attack and the blood, not the victim.
- You only see players in **your current city**. Sail or fly to the same city to meet. The Kaiju is shared by everyone in the world.
- To test on one computer, open the game in two tabs or two browsers. Each tab is a separate player.

## 13. Saves and settings

The game saves automatically **in your browser** on this device:

- your character
- cash, completed contracts and your current city
- the blood effects setting
- your **guest identity**: online, the game signs you in anonymously the first time and keeps that session in this browser, so every later visit is the same guest, with the same Kaiju damage, weekly rank and rewards. Without an online server, a guest id is saved instead.

An unfinished contract restarts after reloading the page. Saves do not move between browsers or devices. Clearing this site's data in your browser resets everything, including your character and your guest identity (a new guest starts from zero on the leaderboards). If your browser blocks storage (for example some private modes), the game still works, but progress lasts only until you close it.

The **pause menu** (Esc) has: **Resume**, **Blood effects on/off**, **Return to City Hub**, and **Edit character**, plus a list of the controls.

## 14. Troubleshooting

| Problem | Try this |
| --- | --- |
| "The city needs WebGL" | Turn on hardware acceleration in your browser settings, update your graphics drivers, then reload. |
| The game is slow | Close other heavy tabs, make the window smaller, or zoom the camera in. |
| Keys stop responding | Click the game once. Menus and switching tabs pause the game and release held keys. |
| I am stuck | Pause and choose **Return to City Hub**. |
| It is too dark to see | Night follows Philippine time. Zoom the camera in; street lamps and lit windows help in the city. |
| I cannot travel | Finish or abandon your contract, lose your wanted stars, and wait until you are back on your feet. To fly, go to the airport; to sail, take the boat from the marina and head for open sea on the course shown. |
| My Kaiju damage does not count | Get within about 220 metres of it and be in its city. The panel (**B**) shows your hits as the server counts them. |
| I cannot collect a reward | Stop fully at the marker, and lose all wanted stars first. |
| I do not see my friend | Check you are both in the same city and both show **Online**. On one computer, use two different browsers. |

---

## 15. For site owners: running, online play and deployment

This part is for whoever hosts the game.

### Run it on your computer

Install [Node.js](https://nodejs.org) 20.19 or newer (22 LTS recommended), then in the project folder:

```bash
npm install
npm run dev
```

Open the address it prints (normally `http://127.0.0.1:5173`). On Windows PowerShell, type `npm.cmd` instead of `npm` if scripts are blocked. `npm run build` creates the production site in `dist/`, and `npm run preview` serves that build locally.

### Turn on online play (Supabase)

Without this, only tabs of the same browser share the world. Online play uses a free [Supabase](https://supabase.com) project. You only need to set it up once.

1. **Create a project** at supabase.com. The free tier is enough for small groups.
2. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**. Players get an identity without accounts or passwords. If the game becomes public, consider Supabase's CAPTCHA or rate limits for sign-ups.
3. **Realtime → Settings**: turn **off** **Allow public access**.
4. **SQL Editor → New query**: paste the whole of [`supabase/realtime-policies.sql`](supabase/realtime-policies.sql) and click **Run**. It lets signed-in players use only this game's channels.
5. **Project Settings → API Keys**: copy the **Project URL** and the **publishable key** (`sb_publishable_…`, or the older "anon public" key).
   **Never use the secret / service_role key.** The build refuses it, because anything given to the game is visible to players.
6. **Give the values to the game**:
   - **On your computer**: create a file named `.env.local` in the project folder (see `.env.example`), then restart `npm run dev`:
     ```
     SUPABASE_URL=https://your-project-ref.supabase.co
     SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
     ```
   - **On Vercel**: Project → Settings → **Environment Variables**. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for Production (and Preview if you use it). The names `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` also work. Marking them Sensitive is fine. Then **redeploy**: the values are built into the site, so a new deployment is needed.
7. **The Kaiju event**: in the SQL Editor, also run the whole of [`supabase/world-boss.sql`](supabase/world-boss.sql). It creates the event, damage, weekly board and reward tables (hidden from players; they can only use the game's checked functions) and the reward tiers, which you can change in the `boss_reward_tiers` table. Weeks are closed automatically the first time anyone opens the board after Monday 00:00 PH time; if you have the `pg_cron` extension, the file shows an optional schedule for it. Without this step, online play works but the Kaiju panel says the event server cannot be reached.
8. **Check it**: the build log shows `Multiplayer: online via SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY`, and the game shows **Online · 0 other players here**.

If it does not connect: **Offline** usually means anonymous sign-ins are off or the key is wrong. A status stuck on **Connecting…** usually means step 4 was not run. **Local** means the values were not found by the build.

Usage note: each player sends about 10 position updates per second to every other player in the same city. Check your Supabase plan's Realtime limits before a large event.

### Deploy to Vercel

The repository includes `vercel.json`, so Vercel needs no extra settings. It installs with `npm ci`, builds with `npm run build`, serves `dist/`, and sends the game's security headers.

- **From Git**: import the repository in the Vercel dashboard. Use Node.js 20 or newer. Add the Supabase variables above if you want online play. Every push to your main branch deploys.
- **From the command line**: `npx vercel` for a preview, and `npx vercel --prod` for production.

### Previewing the time and weather

For testing, add `?clock=HH:MM` (Philippine time, 24-hour) and/or `?weather=clear|cloudy|rain|storm` to the address, for example `/?clock=21:30&weather=rain`. The clock then runs on from that time. This only changes what that browser shows; everyone else keeps the shared live sky.

Without Supabase, the Kaiju event runs in the same browser (all tabs share it), and the preview clock moves it too: `/?clock=11:58` shows the countdown and `/?clock=12:05` the fight. With Supabase configured, the event always follows the server's clock.

### Testing the Kaiju event online

`?clock=` cannot move an online event: the server owns the time, so players cannot fake it. To test online, use a **second Supabase project** for tests and shift its server clock:

1. **Create a test project** in Supabase and set it up exactly like the real one (steps 2–7 above: anonymous sign-ins, Realtime public access off, both SQL files).
2. **Point preview builds at it.** In Vercel → Project → Settings → **Environment Variables**, give `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` two sets of values: the real project for **Production** only, the test project for **Preview** only. Push a branch (not `main`) and Vercel builds a preview address that uses the test project; production is untouched. Locally, put the test project's values in `.env.local`.
3. **Move the test server's clock** in the test project's SQL Editor. The game follows the server clock, so everyone on the preview sees the same thing:
   ```sql
   select public.boss_test_clock('11:58');           -- the countdown, on today's city
   select public.boss_test_clock('12:05', 'manila');  -- the fight, on a day the Kaiju attacks Manila
   select public.boss_test_clock_off();               -- back to the real time
   select public.boss_test_reset();                   -- wipe events, damage, weekly boards and rewards to start over
   ```
   The clock keeps running from the time you set. Players cannot call these functions; only the project owner can, from the SQL Editor. The sky still shows the real time of day.

Never run `boss_test_clock` on the production project: events and damage made under a shifted clock are stored like real ones and would count on the real leaderboards.

### Checks before publishing

```bash
npm test              # game rules, physics, islands, multiplayer, the Kaiju server rules (on a real Postgres), saves and security
npm run test:browser  # builds the site and plays it in Chrome, including two players
npm run audit:security
```

`test:browser` uses installed Chrome on Windows, or Playwright's Chromium (`npx playwright install chromium`); set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use another Chromium. Screenshots are saved in `test-results/`.

### Credits

Physics by [Rapier](https://rapier.rs), rendering by [Three.js](https://threejs.org), multiplayer by [Supabase Realtime](https://supabase.com/docs/guides/realtime). All characters, cars, boats, trains, scenery and the Kaiju itself are generated in code, and its sounds are synthesised in the browser, so there are no third-party models or audio with licences to track. The Kaiju server tests use [PGlite](https://pglite.dev).
