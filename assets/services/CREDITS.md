# Services section imagery

Four photographs used by the alternating "who you are in the case" section on
services.html. All are from **Pexels** and carry the Pexels License, which
permits free commercial use, allows modification, and does not legally require
attribution. Credit is recorded here anyway as a matter of practice, and so the
source is traceable if an image ever has to be replaced.

<https://www.pexels.com/license/>

| File | Used for | Pexels photo ID | Source |
|---|---|---|---|
| `claims.jpg` | 01 — Claims management | 35676596 | https://www.pexels.com/photo/35676596/ |
| `advisory.jpg` | 02 — Claims advisory & legal | 8111869 | https://www.pexels.com/photo/8111869/ |
| `budgeting.jpg` | 03 — Medical welfare budgeting | 7735769 | https://www.pexels.com/photo/7735769/ |
| `telemedicine.jpg` | 04 — Telemedicine | 7195319 | https://www.pexels.com/photo/7195319/ |

All four are served at 1600x1067 (a 3:2 landscape), which is the aspect ratio
the layout renders them at; each was requested from Pexels pre-cropped to that
size. Each was chosen to show the actual subject of its service: a crew member
working the wet deck of a tanker for claims handling (the setting an incident
is documented from), a lawyer working a case file for advisory and legal, an
English-language budget worksheet for welfare budgeting and audit, and a
clinician consulting by video for telemedicine. They are served as-is with no
build step, in keeping with the rest of the repo.

The previous set is kept in `_oldbak/` and can be deleted once these are
signed off. It was replaced because those photographs were generic office
stock that did not read as maritime or medical: the advisory image was a
registry-office signing, and the budgeting image carried Cyrillic text on the
documents and monitor, which does not suit an international maritime brand.

To replace one, drop a new 3:2 image in at the same filename — no markup or CSS
change is needed. Update the row above when you do.
