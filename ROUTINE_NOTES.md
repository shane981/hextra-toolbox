# Hextra weekly toolbox talk – routine notes

Run every week: draft on **Tuesday** around 2 pm Sydney time (send to Shane to check), publish on **Wednesday** by about
5:45 am Sydney time, then post the announcement in Hextra Full Team Chat. The talk date is the **Wednesday** of that week
(changed from Mondays on 18 Nov 2026 at Shane's request). App: https://shane981.github.io/hextra-toolbox/ · Repo: shane981/hextra-toolbox
(source on `main`, deployed site on `gh-pages`). Local working copy: `/workspace/hextra-toolbox`.
Never touch `/workspace/monaro-toolbox` or the shane981/monaro-toolbox repo – that is a separate app.

## About Hextra (for tailoring)
Multi-trade business based at 6A Percy Harris St, Jindabyne NSW (Snowy Mountains + NSW Far South Coast;
now part of Nexa Trades Group). Trades: electrical (residential/commercial/industrial), Level 2 ASP
(network connections, overhead/underground services), solar + batteries + off-grid, air conditioning
(split/multi/ducted/evaporative), refrigeration (coolrooms, freezer rooms, ice machines, beer lines),
fire protection (testing/servicing, emergency & exit lighting, extinguishers, hose reels, sprinklers),
hydronics and heat-pump hot water. 20+ techs incl. apprentices. Alpine conditions: snow/ice, cold,
remote sites, roof work, long drives on Snowy roads. Talks are for technicians, apprentices and supervisors.

## 1. Pick the topic (rotation + no repeats)
1. List what's been done: `ls talks/ drafts/` and `jq -r '.talks[] | "\(.date)  \(.title)"' talks/index.json`
   (also skim `key_risk` of the last 8 talks: `for f in talks/2*.json; do jq -r '.date+" | "+.key_risk[0:120]' $f; done`).
2. Rotation – follow this cycle in order, moving one slot per published talk (9 Nov 2026 = slot 1 electrical,
   16 Nov = slot 2 HVAC-R, 18 Nov = slot 3 fire protection – the first Wednesday talk; next is slot 4 plumbing):
   1. Electrical / solar / Level 2 ASP
   2. HVAC-R (air conditioning, refrigeration, refrigerants, heat pumps)
   3. Fire protection
   4. Plumbing-side work (hydronics, heat-pump hot water, beer lines, gas/water near electrical, backflow/scald)
   5. General WHS (working at heights/roofs, ladders, ceiling spaces & heat, asbestos, manual handling,
      driving/fatigue on alpine roads, working alone, cold/snow, silica dust, mental health)
   Then repeat. Find the last published talk's slot and use the next one. Override the rotation when a **new** regulator
   safety alert / incident release / fatality directly relevant to Hextra's trades appears (note why in `summary`).
3. Do not repeat a topic used in the last 26 weeks (same main hazard = repeat, even if worded differently).
   A follow-up angle is fine only if it is clearly different (e.g. "DC isolation on solar + batteries" vs
   "test before touch").
4. Seasonal hooks: Nov–Mar heat in ceiling spaces/roofs, storms, bushfire, A/C install peak; Apr–Oct snow,
   ice, cold, slippery roofs, ski-resort sites, generator/back-up supply use.

## 2. Research (only cite pages you actually read this run)
Check for new material first (last ~3 months), then official guidance:
- SafeWork NSW safety alerts + incident information releases: https://www.safework.nsw.gov.au/safety-alerts and
  https://www.safework.nsw.gov.au/compliance-and-prosecutions/incident-information-releases
- Safe Work Australia (codes of practice, model WHS): https://www.safeworkaustralia.gov.au
- NSW Fair Trading (electrical / plumbing / refrigeration licensing, supervision): https://www.fairtrading.nsw.gov.au
- Energy Safety / Service NSW electrical safety (via NSW Fair Trading & Service NSW pages)
- Building Commission NSW / NSW fire safety (annual fire safety statements, essential services): https://www.nsw.gov.au/departments-and-agencies/building-commission
- Fire and Rescue NSW guidelines: https://www.fire.nsw.gov.au (often blocks scripted fetches – try browser)
- FPA Australia: https://www.fpaa.com.au · AS 1851 (fire maintenance – cite by name only)
- NECA: https://www.neca.asn.au · Master Plumbers NSW: https://www.mpansw.asn.au
- AIRAH: https://www.airah.org.au (Flammable Refrigerants Safety Guide etc.)
- ARC / ARCtick: https://www.arctick.org (licences, codes of practice, R32/A2L)
- DCCEEW Ozone Protection & Synthetic Greenhouse Gas Management: https://www.dcceew.gov.au/environment/protection/ozone
- Energy Safe Victoria alerts: https://www.energysafe.vic.gov.au · WorkSafe Victoria alerts: https://www.worksafe.vic.gov.au/safety-alerts
- Standards (AS/NZS 3000, AS/NZS 5149, AS/NZS 3500, AS 1851, AS/NZS 4836) – reference by name only, never quote text.
Rules: regulator/government first; industry bodies marked `"type": "industry"`; never invent figures, incidents,
penalties or dates; if a fact is a Hextra house rule rather than a legal requirement, word it as "we"/"our
procedure" and list it in the report as an assumption for Shane to confirm. Australian English, plain language.

## 3. Write the draft
- File: `drafts/YYYY-MM-DD.json` where the date is the Wednesday. Copy the structure of the latest `talks/*.json`.
  Schema: `SCHEMA.md` / `schema/talk.schema.json` (no extra fields; exactly 5 discussion questions).
- `week_label`: `Week NN of TT – Week of Wednesday D Month YYYY`, where NN is the ISO week number of the Wednesday (`date -d YYYY-MM-DD +%V`) and TT is that ISO year's total weeks (52, or 53 in long years such as 2026: `date -d YYYY-12-28 +%V`). Shane asked for this on 18 Nov 2026. Keep the title unchanged; the week number goes in `week_label` and the Wednesday Teams post.
- Every item in `drivers_need_to_know` (shown as "What workers need to know"), `supervisors_must_check`
  and `practical_checklist` starts with the trades it applies to in brackets, e.g. `[Electrical, Solar, Level 2 ASP]`,
  `[Air conditioning, Refrigeration]`, `[Fire protection]`, `[Hydronics/heat pumps]`, `[All trades]`, `[Apprentices]`.
- `follow_up_actions`: owner + due date (Friday of the same week or the next).
- `sources_reviewed`: real URLs read this run, with `accessed` = today and a short `note`.
- Validate: `node scripts/validate.mjs drafts/YYYY-MM-DD.json`

## 4. Publish
```bash
cd /workspace/hextra-toolbox
scripts/publish.sh drafts/YYYY-MM-DD.json           # validates, copies to talks/, rebuilds index, bumps sw.js
                                                     # CACHE_VERSION (hextra-toolbox-vN), builds dist/, pushes gh-pages,
                                                     # waits for the live version.json
git push origin main                                 # back up source (publish commits locally)
curl -s https://shane981.github.io/hextra-toolbox/talks/index.json | jq .latest   # must equal the new id
node scripts/verify-pwa.mjs https://shane981.github.io/hextra-toolbox/            # optional full check (npm i first)
```
Fix a published talk: `scripts/publish.sh drafts/<id>.json --replace`. Exit code 3 = gh not logged in
(`gh auth status`; the box gh is logged in as shane981).

## 5. Report back
Talk title, 2-sentence summary, main sources with URLs, live URL, any assumptions/house rules to confirm,
anything that failed.

## Notes
- The app shares the shane981.github.io origin with the Monaro app; storage keys are prefixed `hx-`,
  IndexedDB is `hextra-toolbox`, and the SW only deletes its own `hextra-toolbox-v*-app` caches. Keep it that way.
- Icons: `python3 scripts/make-icons.py` (logo source `/workspace/hextra-brand/logo.png`, from hextra.com.au).
