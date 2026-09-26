# Little City: World Tour

An open-world action game that runs in your web browser. Sail between seven island cities, each on an island with its own landscape, ride the metro, drive out past the city limits to beaches, forests, farmland and mountains, watch airliners land at the airport and helicopters circle downtown, play as a human, a wolf, a hulking brute or a robot, buy guns at the gun shop in Miami, fight, escape the police, race the ring road, finish contracts, and meet other players in the same city. Every day at 12:00 Philippine time a giant **Kaiju** rises off one of the cities, and everyone fights it together for a place on the weekly leaderboard. Day and night follow the time in the Philippines, and the whole world shares one weather.

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
- **Character**: choose what you are. Each kind has its own colours and one small perk:

  | Kind | Colours | Perk |
  | --- | --- | --- |
  | **Human** | skin tone, hair style and hair colour | Balanced all-rounder. |
  | **Wolf** | fur (grey, timber, arctic, black, red fox, golden); ears, muzzle and tail | Sprints 15% faster. |
  | **Brute** | skin (jade, forest, olive, stone, crimson, tan), hair; a head taller and much broader | Punches hit 40% harder. |
  | **Robot** | plating (chrome, gunmetal, gold, pearl, teal, rust red); visor and antenna | Takes 20% less damage. |

- **Look**: skin, fur or plating, hair style and colour (humans and brutes; a cap takes the hair colour), shirt, trousers and shoes (a robot's shirt is its chest panel).
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
| **Mouse** | Point at what you want to shoot (with a gun in hand the pointer is a crosshair); **click** to fire once, hold the **right button** to keep firing | | |
| **J** | Shoot at the crosshair (or the locked-on target), or punch; hold to keep attacking | | |
| **Q** | Switch to the next weapon you own | | |
| **1 – 9** | Fists, pistol, revolver, SMG, shotgun, assault rifle, machine gun, sniper rifle, rocket launcher (the ones you own) | | |
| **R** | Reload the gun in your hands | | |
| **E** | Collect, deliver, heal at the City Hub, take the metro at a station, or browse the gun shop | | |
| **M** | World map and sailing | World map and sailing | World map and sailing |
| **L** | Contract board | Contract board | Contract board |
| **B** | Kaiju event and rankings | Kaiju event and rankings | Kaiju event and rankings |
| **N** | Music player and playlist | Music player and playlist | Music player and playlist |
| **Esc** | Pause menu and controls | Pause menu | Pause menu |
| **Mouse drag / scroll** | Turn and zoom the camera (a quick click fires; a drag turns) | Turn and zoom the camera | Turn and zoom the camera |

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
- **Weapon bar** (above the controls): fists and every gun you own, with rounds left. Click one or press its number.
- **Kaiju banner** (under the sky chip, from an hour before the event): the countdown, then the Kaiju's health, the time left, and your damage and rank. See [Kaiju: the world boss](#8-kaiju-the-world-boss).
- **Police panel** (while wanted): what the police are doing, such as dispatching, en route, searching your last known location, on scene, or trying to arrest you.
- **Minimap** (bottom left): a round map centred on you, with north up. It zooms out as you drive faster, and a gold arrow on its edge points to an objective that is off the map. **Map ↗** opens the world map.
  - white arrow: you
  - cyan dot: your car
  - green dot: the City Hub forecourt (spawn); the hub building is the mint block beside it
  - gold dot and dashed line: your objective
  - red dots: gang members
  - red block (Miami): the gun shop
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

Press **M** for the **World map**, the game's one map: the whole world at once, with every city by its usual name, the island you are on marked **YOU ARE HERE** (and named above the map), how many players are online in each, and, around event time, where the Kaiju is.

There are two ways to reach another island: **teleport** there instantly, or **sail** there.

**Sailing.** Each city has a card with a **Sail** button and the distance:

1. Press **Sail**. The map closes, the route is drawn on the world map, and the left panel and gold marker point you to your speedboat at the **marina pier on the east waterfront** (with the distance and direction, for example "580 m north-east").
2. At the boat, press **F**, head out to open sea and follow the arrow; the left panel shows the heading and the distance left. The voyage only counts while you are in open sea and roughly on course. At sea the minimap becomes a **sea chart**: a grid that slides past as you sail, a dashed course line, and your destination island coming into view ahead as the distance shrinks. The world map (**M**) shows your boat moving along the route.
3. You arrive by boat offshore of the new island, heading for its marina. Press **F** at the pier or a beach to go ashore.

**Teleporting.** Every island card on the world map also has a **Teleport** button: press it from anywhere and you arrive instantly beside that island's **teleporter**, a glowing pad on the City Hub's north forecourt by the avenue. Stepping onto a pad and pressing **E** opens the map too (GPS: **Teleporter**).

You cannot sail or teleport while you have an unfinished contract, while you are wanted, or while you are down. The **GPS** buttons under the map set the gold marker to places on your island: the City Hub, the marina, the nearest metro station, the gun shop (Miami), the lighthouse and more.

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
- the **marina** on the east waterfront, where your boat is moored, and an airport on the west side of the city (scenery only: travel is by sea)

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

Each city has six contracts, 42 in total:

| Contract | Reward | What to do |
| --- | --- | --- |
| **Midnight delivery** | $650 | Collect a package at the gold marker, then deliver it across the city. |
| **Take back the block** | $1,200 | Defeat the four armed gang members, lose the police, then return to the City Hub. |
| **Heat on the highway** | $950 | Pick up a case, which brings two wanted stars. Escape the police, then reach the drop-off. |
| **Ring road sprint** | $1,100 | Race the island ring road end to end through seven checkpoints in 2 minutes 30. The clock starts at the first checkpoint; run out of time and you start again from it. |
| **Island explorer** | $800 | Visit the lighthouse, then the island's landmark, then the campsite (or the marina), in that order, by car, boat or on foot. |
| **Wanted: the gang boss** | $1,600 | A gang boss in a black suit and gold cap (three times tougher than his crew) and two bodyguards wait at a crossing across the city. Take the boss down, lose the police, then report to the City Hub. |

- Press **L** to open the contract board and accept one. Only one contract can be active at a time.
- Follow the **gold marker**. At pick-ups and drop-offs, **stop** within about 12 metres and press **E**. Race checkpoints and tour sights count as soon as you pass through them.
- You must have **no wanted stars** to collect a reward.
- Each contract pays once per city. You can **abandon** an unfinished contract from the board and restart it later.
- If you are wasted, busted or return to the City Hub, the unfinished contract is cancelled. Your earned cash is kept.

## 7. Fighting

- **Guns**: everyone has a pistol. More are sold at **Ocean Drive Arms**, the gun shop in Miami (the red storefront across the avenue from the City Hub; the map's GPS has a **Gun shop** button). Walk to its door and press **E**. Guns you buy are yours for good, in every city. Ammunition is free: each gun reloads automatically when empty, or press **R**.

  | Key | Gun | Price | Magazine | Range | Kaiju damage per hit | Kaiju damage per second | Kaiju reach | Notes |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | 1 | **Fists** | free | | 5 m | 50,000 | ~111k | 32 m | Jab, cross, hook. Only reaches the Kaiju under its feet. |
  | 2 | **Pistol** | free | 15 | 65 m | 34,000 | ~93k | 170 m | Strongest up to about 25 m. |
  | 3 | **Magnum revolver** | $6,500 | 6 | 80 m | 98,000 | ~124k | 170 m | Six heavy rounds; drops most people in one shot. |
  | 4 | **SMG** | $12,000 | 40 | 50 m | 17,500 | ~132k | 170 m | Fully automatic and very fast; weak per bullet. |
  | 5 | **Shotgun** | $16,000 | 8 | 32 m | 145,000 | ~139k | 70 m | Devastating up close (and knocks people down); get close to the Kaiju. |
  | 6 | **Assault rifle** | $24,000 | 30 | 110 m | 32,000 | ~142k | 170 m | Automatic and long range: the best all-rounder. |
  | 7 | **Light machine gun** | $38,000 | 100 | 95 m | 26,000 | ~169k | 170 m | A 100-round belt, then a long reload. |
  | 8 | **Sniper rifle** | $52,000 | 5 | 200 m | 290,000 | ~173k | 210 m | Bolt-action; the only gun that hits the Kaiju from beyond 170 m. |
  | 9 | **Rocket launcher** | $75,000 | 4 | 120 m | 330,000 | ~194k | 170 m | Explodes where it lands, hurting everyone nearby (you too, if you are close). |

  The shop shows all of this for each gun. *Kaiju damage per second* includes reloading, so it is what you really deal when firing without stopping. It rises with the price, and the best gun deals about twice as much as the free pistol.

- **Switching**: **Q** cycles through fists and your guns; **1–9** pick one directly; or click the weapon bar. Switching cancels a reload. Handguns are aimed at arm's length with both hands; long guns are shouldered.
- **Fists**: press **J** quickly for a **jab, cross and hook**. The hook knocks people off their feet; they get up again unless they were defeated.
- **Aiming with a mouse**: with a gun in hand, the pointer becomes a crosshair and your shot goes exactly where it points: at a person, a car, a wall, or any part of the Kaiju, from its feet up to its head. Your character turns and raises the gun towards it. The crosshair turns **red** on someone you can hit and on the Kaiju within your gun's reach, and **amber** on the Kaiju when it is too far for this gun. Click to fire once, hold the right mouse button (or **J**) to keep firing.
- **Aiming without a mouse** (touch screens, or keyboard only): the game locks onto the best target in front of the camera: armed threats first, and bystanders only when they are in front of you. The ring on the ground shows who you will hit.
- **Cover**: buildings, cars and lamp posts block bullets, for you and for anyone shooting at you. Standing still makes you easier to hit. Sprinting and distance make enemies miss more.
- **Children** can never be targeted or hurt.
- **Health**: at zero health you are **WASTED** and wake up at the City Hub. To heal, walk onto the City Hub forecourt and press **E** while you are not wanted. This also refills every gun.
- **Bodies and blood** are cleared a few seconds (6) after someone falls. Blood effects can be switched off in the pause menu.

## 8. Kaiju: the world boss

Every day at **12:00 Philippine time**, a giant Kaiju, taller than the city's towers, rises from the sea off one of the seven cities and attacks it for **one hour**. The cities take turns, one per day. It has **1,000,000,000 HP** shared by every player in the world.

- **Before**: an hour ahead, a banner announces where it will appear, with a countdown. Sail there in time. The World map marks the city.
- **The fight**: it wades ashore and stomps through the streets. Point at it with the mouse and fire (click, hold the right button, or **J**); on a touch screen the attack button aims at it for you. Every gun works within its **Kaiju reach** (170 m for most, 70 m for the shotgun, 210 m for the sniper rifle, under its feet for fists), and each deals its own damage per hit (see the table in [Fighting](#7-fighting)). Better guns deal more damage per second, but no gun is more than about twice the free pistol, so the leaderboard rewards time spent fighting. Drag the camera up to look up at it: the view tilts past your character so you can aim at its head. While it attacks, gunfire alone does not bring the police (only hitting people does). It fights back in turn with a **fire breath** cone, a sweeping **laser beam**, a **ground slam** shockwave that knocks you down, a **roar** that stuns you for a moment, a rain of **meteors** (watch for the red circles on the ground) and a **tail sweep**. Its feet crush anything underneath. Attacks hurt, throw you back, and can leave you **WASTED**. Red warnings on the ground show where the next attack will land.
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

**Fair play**: the server decides everything that matters. Your game only reports *how many* hits landed with *each weapon*. The server applies each weapon's damage from its own table and charges every hit that weapon's firing time, cooldowns and reloads included. Each player earns one second of firing time per second, can bank up to 8 seconds, and gets one extra second for network delays, so nobody can land more hits than their guns can really fire, however the game is modified. It also checks your distance from where the Kaiju is at that moment (it computes the Kaiju's path itself). The server also owns the schedule, HP, defeat, deaths, rankings and rewards, and the destruction follows from the event's server-issued seed, so it is the same for everyone.

### Music

Press **N** (or the **♫ Music** button) for the in-game radio: play and pause, previous and next, shuffle, volume, the playlists (one per folder of the site's music) and their songs to pick from. It keeps playing everywhere in the game (on foot, driving, at sea, in every city), and the button turns green while music plays. It keeps playing when you switch to another browser tab or minimise the window; pause it from the player, your keyboard's media keys, or the browser's media controls. (While sound plays, your browser shows a speaker icon on the game's tab; that is the browser's own indicator and cannot be hidden by the page.) Your volume and shuffle are remembered in this browser, and music you left on resumes with your first click or key press next time (browsers do not allow sound before that). The playlist is the site owner's; see [Music playlist](#music-playlist).

## 9. Police and your wanted level

Attacking anyone, or hitting people with your car, gives you **wanted stars**, up to **five**. Hurting bystanders or police adds more, and **killing** them raises the level fast. Fighting gang members stays at one star.

| Stars | Kills that bring it | What the police do |
| --- | --- | --- |
| ★ | | Officers try to **arrest** you on foot. If one reaches you while you stand still, you are **BUSTED**: you lose up to $500 and are released at the City Hub. Run, drive away or fight back to resist. |
| ★★ | 1 | Officers shoot. |
| ★★★ | 3 | More patrol cars join the pursuit. |
| ★★★★ | 6 | A **police helicopter** hunts you from the air. |
| ★★★★★ | 10 | Every patrol car and **two helicopters**, with marksmen who fire at you. |

- **Arrival**: police arrive a few seconds later in patrol cars that drive through the streets; one car per star, up to five.
- **Chases**: a patrol car that sees you chases you. Out of sight, police search where you were last seen. Drive away and officers on foot get back in their car and follow.
- **Helicopters**: a helicopter flies in from beyond the city, circles above you with its searchlight on you, and searches a widening circle around your last known position when it loses you. It sees you from the air unless **tall buildings** are between you or you are **under trees**, and it is slower than your car, so you can outdrive it. It shows on the minimap as a flashing red and blue diamond.
- **Knocked-out units**: kill a unit's officers and their car is out of action (lights off, parked where it stopped); the police send reinforcements that drive in from out of sight, so the pursuit keeps going. After the pursuit, new crews take the empty cars back and the reinforcements leave the city.
- **Teaming up**: other wanted players within 150 m of you count as your crew. Each brings two more patrol cars (up to nine) and, at four stars and above, one more helicopter.
- **The pursuit only ends** when you are busted, wasted, or **get away**. To get away, stop attacking and stay out of sight of every unit (cars, officers and helicopters) once they have started looking for you: **9 seconds at one star, up to 21 seconds at five**. The stars then blink and fade to zero; if they spot you again, the chase is back on. At zero everyone stands down: patrols go back to their beats, the helicopters fly home and the streets calm down.

## 10. Driving

Your car is the cyan coupe next to the City Hub. Walk up to it and press **F**. To get out, stop and press **F** again.

- The car has real momentum. Brake before corners; **Space** is the handbrake, for sliding turns.
- Crashes damage the car and hurt you. Fast impacts knock lamp posts over. Trees and buildings stop you.
- If the car ends up on its side or roof, wait a moment and it is set back on its wheels.
- Pause and choose **Return to City Hub** if you get stuck anywhere. This also cancels an unfinished contract.

## 11. Life on the streets

About 95 people live in each city. You will see families with children holding hands, office workers taking phone calls, joggers, and friends chatting. There are food stalls with vendors and queues, bus stops where people sit and wait, and benches. People walk to these places, stay a while and move on. Traffic drives in lanes, stops at red lights behind the crosswalk, and gives way to pedestrians. People on foot wait at the kerb and cross when the cars on that road have a red light and the way is clear, and they step around a car parked on the sidewalk, so walkers and cars never push into each other. Violence nearby sends everyone running; vendors come back once it is calm.

Overhead, an airliner lands on the airport runway, turns round and takes off again every two and a half minutes, jets cross the sky high up, a red news helicopter circles downtown and a yellow tour helicopter follows the coast. They follow the shared world clock, so everyone sees the same aircraft.

## 12. Playing together

Everyone playing in the same city can see each other: your character, name tag, and your car when you drive. You also see each other fight: raising a pistol or fists, punching, muzzle flashes, bullet tracers, and blood where a hit landed. Other players also appear as pale yellow dots on the minimap, and the world map shows how many people are in each city.

The status under the city name shows your connection:

| Status | Meaning |
| --- | --- |
| **Online · N other players here** | Connected to the shared world. |
| **Connecting to the shared world…** | Joining; this usually takes a moment. |
| **Offline: run supabase/realtime-policies.sql** | Supabase refused the game's private channels: the Realtime policies are missing. Run [`supabase/realtime-policies.sql`](supabase/realtime-policies.sql) in the SQL Editor, then reload. Hover the chip for Supabase's exact message. |
| **Offline: turn on anonymous sign-ins in Supabase** | Authentication → Sign In / Providers → allow anonymous sign-ins. |
| **Offline: check the Supabase URL and anon key** | The site was built with a wrong URL or key: fix the environment variables in Vercel and redeploy. |
| **Reconnecting to the shared world…** | The connection dropped (network, a sleeping laptop, an expired sign-in). The game reconnects by itself, retrying every few seconds, and keeps working meanwhile. If it never comes back, see [Turn on online play](#turn-on-online-play-supabase). |
| **Local · N other tabs** | This site has no online server set up; only other tabs in *this* browser are shared. |

Things to know:

- Other players are visible, including when they drive, sail or ride the metro, but pass through you, and you cannot fight each other. Traffic, pedestrians, police, contracts and money are your own, so the person another player hits exists only in their game: you see the attack and the blood, not the victim.
- You only see players in **your current city**. Sail to the same city to meet. The Kaiju is shared by everyone in the world.
- To test on one computer, open the game in two tabs or two browsers. Each tab is a separate player.

## 13. Saves and settings

The game saves automatically **in your browser** on this device:

- your character
- cash, completed contracts, your current city and the guns you own
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
| I cannot travel | Finish or abandon your contract, lose your wanted stars, and wait until you are back on your feet. Then press Sail on the map, take the boat from the marina on the east waterfront and head for open sea on the course shown. |
| The Kaiju panel says "an older copy of the Kaiju functions is still on the server" | An old copy of `world-boss.sql` was run after the new one. Run the latest file again (or `drop function if exists public.boss_state(); drop function if exists public.boss_event_now();`). |
| My Kaiju damage does not count | Get within your gun's reach (170 m for most guns; an amber crosshair means too far) and be in its city. The panel (**B**) shows your hits as the server counts them. |
| The Kaiju panel says the functions are "missing or out of date" | The game was updated. Run the whole latest `supabase/world-boss.sql` again in the Supabase SQL Editor (it keeps your data). |
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
7. **The Kaiju event**: in the SQL Editor, also run the whole of [`supabase/world-boss.sql`](supabase/world-boss.sql). It creates the event, damage, weekly board and reward tables (hidden from players; they can only use the game's checked functions) and the reward tiers, which you can change in the `boss_reward_tiers` table. Paste the whole file and click **Run** with nothing highlighted (with text highlighted, Supabase runs only the selection). Run it again whenever the game is updated; it keeps your data. Weeks are closed automatically the first time anyone opens the board after Monday 00:00 PH time; if you have the `pg_cron` extension, the file shows an optional schedule for it. Without this step, online play works but the Kaiju panel says the event server cannot be reached.
8. **Check it**: the build log shows `Multiplayer: online via SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY`, and the game shows **Online · 0 other players here**.

If it does not connect, the chip names the problem (hover it for Supabase's exact message; the browser console shows it too): missing Realtime policies, anonymous sign-ins turned off, or a wrong URL or key. Players in a normal and a private window are different guests, so they see each other only once online play works. A status stuck on **Connecting…** usually means step 4 was not run. **Local** means the values were not found by the build.

Usage note: each player sends about 10 position updates per second to every other player in the same city. Check your Supabase plan's Realtime limits before a large event.

### Deploy to Vercel

The repository includes `vercel.json`, so Vercel needs no extra settings. It installs with `npm ci`, builds with `npm run build`, serves `dist/`, and sends the game's security headers.

- **From Git**: import the repository in the Vercel dashboard. Use Node.js 20 or newer. Add the Supabase variables above if you want online play. Every push to your main branch deploys.
- **From the command line**: `npx vercel` for a preview, and `npx vercel --prod` for production.

### Previewing the time and weather

For testing, add `?clock=HH:MM` (Philippine time, 24-hour) and/or `?weather=clear|cloudy|rain|storm` to the address, for example `/?clock=21:30&weather=rain`. The clock then runs on from that time. This only changes what that browser shows; everyone else keeps the shared live sky.

Without Supabase, the Kaiju event runs in the same browser (all tabs share it), and the preview clock moves it too: `/?clock=11:58` shows the countdown and `/?clock=12:05` the fight. With Supabase configured, the event always follows the server's clock.

### Music playlist

The in-game radio plays the audio files in your Supabase project's Storage. **Each folder is a playlist**, named after the folder (for example *Classic Rock*, *Worship Song*); files outside any folder form one more playlist, *Music*. Set it up once:

1. **SQL Editor → New query**: paste the whole of [`supabase/music.sql`](supabase/music.sql) and click **Run** (nothing highlighted). It creates a public bucket named **music** for audio files and lets players list it and read the playlist; only you can add or change files.
2. **Storage → music**: click **Create folder** for each playlist, open it, and **Upload files** (mp3, m4a, aac, ogg, opus, wav, webm or flac).
3. **Reload the game** and press **N**. Pick a playlist, then a song or ▶. Songs play in file-name order, titled from their names: `01 - Artist - Title.mp3` shows as **Title** by **Artist**.

Things to know:

- **File size**: each file must fit your Supabase plan's upload limit: **50 MB per file on the Free plan** (it cannot be raised there). Paid plans can raise it under **Storage → Settings**; the bucket itself sets no lower limit. Long non-stop mixes are often 50–200 MB: split or re-encode them (see below), or use single songs.
- **Bandwidth**: every play downloads the whole file from your project, and plans include a limited amount of egress per month. Smaller files (128 kbps MP3 is about 1 MB per minute) go much further.
- **Names**: Storage only accepts plain-ASCII file and folder names. If the dashboard says *Invalid key*, rename the file: replace `–` with `-`, and remove accents and emoji. The upload script does this for you.
- **Removing**: delete the file in the bucket. To rename a song, hide one or change the order without renaming files, add rows to the `music_tracks` table: `path` is the file's name in the bucket including its folder (`Classic Rock/Queen - Bohemian Rhapsody.mp3`), plus `title`, `artist`, `position` (lower plays first) and `enabled` (untick to hide).
- **Upload a whole folder of folders from your computer** with `node scripts/upload-music.mjs "C:\Users\you\Downloads\Music"`: each subfolder becomes a playlist (add `--sync` to hide songs no longer in the folder). It needs `SUPABASE_URL` and your **secret** key in `SUPABASE_SECRET_KEY`, set in that terminal only (Command Prompt: `set SUPABASE_SECRET_KEY=sb_secret_...`; PowerShell: `$env:SUPABASE_SECRET_KEY="sb_secret_..."`). Never put the secret key in `.env` files or Vercel.
- **Splitting or shrinking a long mix** with the free [FFmpeg](https://ffmpeg.org): `ffmpeg -i "Long Mix.mp3" -f segment -segment_time 1200 -c copy "Long Mix part %02d.mp3"` cuts it into 20-minute parts without re-encoding; `ffmpeg -i "Long Mix.mp3" -b:a 96k "Long Mix 96k.mp3"` makes a smaller copy.
- **Rights**: files in a public bucket can be downloaded by anyone who has their link, and the radio streams them to every player. Only upload music you have the right to share publicly (your own, licensed, or royalty-free); commercial recordings generally need a licence for this.

### Testing the Kaiju event online

`?clock=` cannot move an online event: the server owns the time, so players cannot fake it. Instead, the server has a **test mode** that is safe on your real project:

- Only browsers opened with **`?bosstest`** in the address (for example `https://your-site/?bosstest`) join it. Everyone else keeps the real schedule and never sees it.
- Testers fight a separate **test Kaiju** (marked **TEST** in the banner). Its damage never touches the real Kaiju, the weekly board or rewards.
- One command reverts everything.

In your project's SQL Editor (players cannot call these; only you can):

```sql
select public.boss_test_clock('11:58');           -- testers see the countdown, on today's city
select public.boss_test_clock('12:05', 'manila');  -- testers fight, on a day the Kaiju attacks Manila
select public.boss_test_reset();                   -- a fresh test Kaiju (deletes test events and test damage)
select public.boss_test_clock_off();               -- revert: test mode off, all test events and test damage deleted
```

Then open the game with `?bosstest` (colleagues can too; everyone in test mode shares the same test Kaiju). The test clock keeps running from the time you set; the sky still shows the real time of day. While test mode is off, `?bosstest` does nothing.

### Checks before publishing

```bash
npm test              # game rules, physics, islands, multiplayer, the Kaiju server rules (on a real Postgres), saves and security
npm run test:browser  # builds the site and plays it in Chrome, including two players
npm run audit:security
```

`test:browser` uses installed Chrome on Windows, or Playwright's Chromium (`npx playwright install chromium`); set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use another Chromium. Screenshots are saved in `test-results/`.

### Credits

Physics by [Rapier](https://rapier.rs), rendering by [Three.js](https://threejs.org), multiplayer by [Supabase Realtime](https://supabase.com/docs/guides/realtime). All characters (wolf, brute and robot included), guns, cars, boats, trains, scenery and the Kaiju itself are generated in code, and its sounds are synthesised in the browser, so there are no third-party models or audio with licences to track. The Kaiju server tests use [PGlite](https://pglite.dev).
