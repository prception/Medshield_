# About page imagery

| File | Used for | Source |
|---|---|---|
| `hero.jpg` | 01 - Hero (full-bleed banner) | Pexels photo 32609062 - https://www.pexels.com/photo/majestic-cruise-ship-sailing-on-open-ocean-at-sunset-32609062/ |
| `apart-bg.jpg` | 05 — What sets us apart (full-bleed bed) | Pexels photo 799091 — https://www.pexels.com/photo/799091/ |
| `medical-team.jpg` | 06 — How we work, Layer 02 (independent medical team) | Pexels photo 5452193 — https://www.pexels.com/photo/team-of-doctors-having-a-diagnostic-discussion-5452193/ |
| `network.jpg` | 06 — How we work, Layer 01 (verified treatment network) | Pexels photo 33812023 — https://www.pexels.com/photo/modern-hospital-corridor-with-empty-chairs-33812023/ |

Pexels License: free commercial use, modification allowed, attribution not
legally required. Recorded here so the source stays traceable.

Served at 2400x1350 (16:9), the aspect the full-bleed section renders at.
To replace it, drop a new 16:9 image in at the same filename — no markup or
CSS change is needed.

The two section-06 cards are cropped from portrait originals to 16:10 at
1600x1000, the aspect `.ab-layers .wd-card__media` renders. `medical-team.jpg`
is cropped to hold the three faces and the X-ray; `network.jpg` is cropped to
keep the corridor signage (consultation rooms, ECG, laboratory, procedure
room) legible, since that signage is what ties the picture to the copy.

## Hero framing (`hero.jpg`)

The hero is a parallax stage: `.wd-hero__bg` is 200svh tall and the image is
`object-fit: cover` under a `scale(1.12)` transform, so only the band from
roughly **50%-94% of the source image height** is ever on screen, centred at
**~72%**. Anything composed in the top half is cropped away entirely.

So `hero.jpg` is authored at **1600x2000 (0.8 aspect - the aspect the hero box
covers)** with the subjects deliberately placed low, centred at ~72% of the
frame. A replacement must follow the same rule, or the subject will be cropped
out of view. The previous container-terminal image is kept as
`hero.jpg.portbak`.
