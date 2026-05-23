# Distribution plan — recommendation

You asked for a concrete suggestion on the "distribution polish" item. Here's mine, with reasoning, so you can act on it whenever you decide to share ModelPrep with creators beyond just yourself.

**Short answer**: don't share-publicly until you've added a small privacy line + a "kill switch" — both take ~30 minutes. Don't bother with API-key mode, self-hosting docs, or TOS right now. Revisit those if/when the user count crosses ~50.

---

## Where the friction actually sits

You are not the friction. **You** as the distributor would have to handle:

1. Other people's Cults passwords flowing through your Worker
2. Liability if something breaks (whose support email rings?)
3. Cults's reaction if they notice automated logins at scale
4. Cloudflare's free-tier limits if usage grows
5. Maintenance when Cults breaks the web flow

For each "user count" tier the friction-vs-features trade looks different. Here's how I'd think about it:

| Tier | Users | Realistic friction | What you should do |
|---|---|---|---|
| **Personal** | 1 (you) | None | What you have now is perfect |
| **Friends** | 2–20 | Low — occasional breakage, password trust within personal circle | Add the privacy line + a one-click disconnect that wipes localStorage. Skip everything else. |
| **Discord-share** | 20–200 | Medium — first support emails, "is this safe?" questions | Add a simple About page, a kill-switch you can flip without redeploying, optional "use API key instead" mode |
| **Public launch** | 200+ | High — TOS, privacy policy, security responsibility, possible Cults pushback | Full security review, self-hosting path as alternative, monitoring + rate limits per IP, public changelog when Cults breaks something |

Your stated goal so far has been "share with creators on Discord for feedback". That's the **Discord-share** tier. Here's what I'd actually build for it.

---

## Recommended changes for the Discord-share tier

### 1. Privacy + trust statement in the UI (5 min)

Add a small line in the connecting form that says specifically what you do — not generic boilerplate. Something like:

> Your email + password go to the ModelPrep Worker (`modelprep-backend.iamdjem.workers.dev`) only on each publish. We don't store them on our server — they sit in your browser's localStorage and are forwarded as request headers. Click "Disconnect" any time to wipe them locally. The Worker is open-source: github.com/iamdjem/modelprep/blob/main/backend/

That's all. People reading this either trust it or they don't; saying it explicitly is much better than not saying anything.

### 2. Make "Disconnect" prominent (already done, just check it)

Already a button. Make sure it's visible from every state of the CultsUploadFlow card (it is — `disconnect()` button is in every state's UI block).

### 3. Add a kill switch (15 min)

A way to disable the publish flow without redeploying. Useful when:
- Cults changes something and starts rejecting publishes (avoid orphan drafts pilling up on user accounts)
- You notice abuse / a security issue and want to pause
- You want to do maintenance

Cheapest implementation: a Cloudflare Worker environment variable like `WEB_FLOW_DISABLED=1`. Worker checks it at the top of `/api/v1/cults3d/web/*` routes; if set, returns `503 Service Unavailable` with a message. Toggle via `wrangler secret put WEB_FLOW_DISABLED 1` (turns on) / `wrangler secret delete WEB_FLOW_DISABLED` (turns off). Frontend shows "Publishing is temporarily disabled — check Discord for updates."

### 4. Skip these for now

- **API-key mode as alternative**: not worth the UI complexity right now. If a user balks at password auth, point them at the GraphQL backup-path docs and tell them they can self-host the Worker if they want zero-trust. That sorts the technical-comfort users from the rest.
- **Self-hosting guide**: premature. If anyone asks "can I run my own?", spend 30 minutes writing it then. Don't write it speculatively.
- **TOS / privacy policy**: real legal documents are a project. Skip until you actually need to launch publicly.
- **Rate limiting**: Cloudflare's free tier does basic DDoS protection; intentional abuse is unlikely from a Discord-shared link. Add real per-IP rate limiting if you see a problem.
- **Monitoring**: `wrangler tail` is enough for now. If usage grows, add Cloudflare Analytics dashboard or a simple counter in KV.

---

## When to revisit this list

Triggers to bump up a tier:

- **You hit Cloudflare free-tier limits** (100K Worker requests/day, 10GB R2). Means real usage; time to think harder about distribution.
- **First support email lands** about something broken / suspicious. Means you need a more formal channel + status.
- **Cults reaches out** or you notice rate limiting on your IP. Means they've noticed and you should reach out for an integration partnership before they ban anything.
- **You start considering charging** for the tool. Means you need TOS + payment + invoicing + a real privacy policy.

---

## My honest take on the password-trust question

This is the elephant. People will reasonably ask "why does ModelPrep need my Cults password?" The answer is: because Cults's API doesn't expose enough features to make a good tool. We log in as you (just like your browser does when you upload manually) because that's the only way to get real tag support, secret listings, or any reliable cover-image upload.

You have three real options:

1. **Be honest about it** (recommended). The privacy line in #1 above. People who don't want to give a password don't have to. Self-hosting is the answer for those who want zero trust.
2. **Don't store the password** (more annoying, slightly safer): change the Connect flow to ask for password every session, not once. Survives less.
3. **Offer both auth modes** (the original Phase B+ suggestion): API key as "safer but fewer features" alongside web flow as "more features but full account login". I de-recommended this earlier because it doubles the UI surface and most users will just pick whichever is labeled "easier" — but if you'd rather be conservative, it's a legitimate option.

My recommendation: **option 1**. The price of #2 (worse UX) is bigger than its security benefit (still trust me with the password for one session at a time). #3 dilutes the product.

If a user really doesn't want to give credentials, the answer should be "fork the repo and run your own Worker — it takes 15 minutes". That's the genuine zero-trust solution and it's already possible today.

---

## Concrete action items in order

If you decide to act on this:

1. [ ] Add the privacy line to `connecting` and `connected` states of CultsUploadFlow
2. [ ] Implement the kill switch (`WEB_FLOW_DISABLED` env var + frontend "publishing disabled" state)
3. [ ] Share with 5 trusted creators on Discord; collect feedback
4. [ ] Watch wrangler tail for the first week; note any patterns
5. [ ] Iterate based on what actually breaks

Items 1+2 are ~30 minutes of work each. The rest is open-ended. Don't pre-build for the public-launch tier until you're actually at it.

---

## Why this isn't in ARCHITECTURE.md

ARCHITECTURE.md describes what exists. This describes a forward-looking *plan* that depends on choices you haven't made yet. Keep it separate so when you revisit, you can rewrite or delete it freely without touching the system docs.
