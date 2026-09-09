# ⚽ Stadium of Elite

**Live quiz football.** Two teams battle through ten questions in real time under a
referee. Every accepted answer is a **goal** — and everyone can watch.

---

## The big idea

It's football, but instead of kicking a ball you **answer quiz questions faster
and more accurately than the other team**. A referee watches each answer, decides
what counts, and the scoreboard updates live as goals fly in.

No account is needed to **watch** — open any match and follow the whole game,
including the timeline, full-time report and Player of the Match voting.

---

## How a match works

1. **Two teams of 8** — 5 players **on the field** (ACTIVE) and 3 on the **bench** (SUB).
   Each side has a **captain**.
2. A referee prepares a bank of questions (up to 20) and **10 are played**.
3. The match runs **question by question**:
   - The question opens with a countdown.
   - On-field players type one answer each.
   - Answers lock and appear **anonymously**.
   - The referee judges: **⚽ Goal**, **🎯 Assist + Goal**, or **❌ No goal**.
4. After ten questions it's **full time**:
   - A **detailed match report** (goals, assists, cards, substitutions, key moments)
     is auto-posted to the **News** page.
   - Fans and players vote for the **Player of the Match** in a short window.

### The referee's three decisions
- **Goal** — the player's answer counts. Score changes, they get a goal.
- **Goal + Assist** — the answer counts **and** another active player on the same
  team is credited with the **assist**.
- **No goal** — nothing counts; the correct answer is revealed.

### Drawn matches
If it's level after ten questions, the referee can run a **penalty shootout** to
decide a winner — for **any** match, league or cup. Before each kick the referee
names the **taker** ("who steps up").

---

## The people

| Role | What they do |
| ---- | ------------ |
| **Fans** | Free accounts — play fantasy, follow teams & players, comment on news, vote for MOTM |
| **Players** | Are added to a team by an admin. They answer questions on the field, ask for substitutions (as captain) and earn goals/assists |
| **Referees** | Run the match: open questions, judge answers, award goals/assists, handle substitutions and cards, pause/half-time/resume, end the match |
| **Admins** | Build teams, import players, set up friendlies & competitions, schedule matches, write news |

**How players are added to a team** — on the team's page an admin imports them all
at once (name, email, number, optional password), or adds them one by one. New
accounts are created automatically.

---

## Competitions

### League (Round-Robin)
- Every team plays every other team. `N` teams → `N(N-1)/2` matches.
- Even field → `N-1` rounds. Odd field → each team gets a **bye** in one round.
- Standard points: **3 win · 1 draw · 0 loss**. Tables rank on points, then goal
  difference, then goals scored.
- Fixtures are drawn in proper **rounds** (no team plays twice in the same round).
  Admins schedule them in waves — a fair "next few matches" at a time.

### Knockout Cup
- Lose and you're out. The field halves every round.
- If the number of teams isn't a power of two, **top seeds get a bye** into round two.
- **No draws** — level matches go to a **penalty shootout**.

### League + Cup (like the World Cup)
- A **group stage** (round-robin tables), then the top teams in each group
  **advance to the knockout bracket**.

---

## Golden boot, assists & stats

- **Golden boot** counts goals scored **in competitive matches only** — friendlies
  don't count toward the boot.
- Every competition keeps its own **Golden boot** and **Top assists** leaderboard
  on its page.
- Players, teams and referees all have public profile pages:
  - Team page → squad, club captain, record, recent results.
  - Referee page → how many matches they've refereed and which ones.
  - Player page → goals, matches, teams.

---

## Fantasy (for fans)

- Pick up to **5 real players** from a competition.
- Each **goal** a picked player scores = **10 fantasy points** (assists show on the
  leaderboards).
- Watch the leaderboard climb, manage your XI, and follow your points from your
  personal dashboard.

---

## Other things to know

- **Live voice commentary** — turn it on in the match and a commentator reads the
  action with football energy ("GOOOOAL — what a wonderful goal!").
- **Match chat** — sign in to chat during a match.
- **News** — every finished match auto-posts a full report; admins also write
  announcements. Anyone can read; **comment by signing in or leaving a temporary name**.
- **Notifications** — you get one when a match is scheduled, postponed, goes live
  or finishes.
- **Transfer window** — players can move between teams (admins do this).
- **Pause, half-time & postponement** — referees pause/resume and call half-time;
  admins can postpone a scheduled match with a reason (shown to everyone).
- **Kick-off times** are shown in **Nigerian time (WAT)**.

---

## Watching a match

Just open the match from **Live**, **Fixtures**, a **team page** or the **home page** —
or share/visit the `/watch/<code>` link. You'll see the live board, timeline, full
time report and penalty shootouts, all without logging in.

---

## For fans getting started

1. **Register free** → you're a fan.
2. Open **Leagues & Cups** and pick a live competition.
3. Enter **Fantasy** and build your XI from the real players.
4. Watch matches live and vote for the Player of the Match.
5. Comment on match reports in **News** and follow your team's page.

> This README is about how the game is played. Development setup, stack details and
> deployment notes live in the codebase docs and PR description history.
