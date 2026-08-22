# How other tools publish one thing to many places, 2026-08-21

Research for the ModelPrep flow question: how do we get the user to as few clicks as possible without losing any platform-unique capability and without a confusing UI. Read alongside `platform-field-matrix-2026-08-21.md`, which says what each of our ten platforms actually asks for.

Sources are cited inline. Several vendor help centres (Zendesk-hosted DistroKid, TuneCore, CD Baby, Later) return 403 to a fetcher, and several platform pages (Thangs, MakerOnline, MakerRoad, Nexprint upload, printables.com, myminifactory.com) are client-rendered or behind a bot check. Claims from search snippets rather than a full page read are marked. Anything not confirmed by a primary source is marked "not verified".

## The short version

Every tool studied, across five industries, converges on one architecture: a single canonical record, plus a per-channel layer generated from it through a reusable configuration object that you answer once per category rather than once per item. The names differ (Sellbrite templates and recipes, Linnworks configurators, Rithum templates plus business rules and lookup lists, Lengow attributes mapping, Codisto attribute mapping, Feedonomics transformers, Metricool's template tab, fastlane's per-locale folders) and the architecture does not.

ModelPrep already has the two hard halves of this. `shared-defaults.js` is the business-rules layer and `SHARED_CATEGORY_DEFAULTS` is the hub taxonomy crosswalk, which is exactly what Feedonomics does with Google Product Category and what Shopify does with its Standard Product Taxonomy. What ModelPrep does not have is the third piece every one of these tools has: a correction the user makes once becomes their permanent mapping. Today an override lives in the project and dies with it.

That single gap is worth more clicks than anything else in the flow.

## Part A. How other products solve it

### Multi-marketplace listing tools, the closest analogue

These sell one product on Amazon, eBay, Etsy and Walmart, each with its own category tree and category-dependent required attributes. That is our problem with different nouns.

**One master, a per-channel config object.** In Sellbrite the product lives once and listings are created per channel; per-channel settings live in Templates, and a Recipe is "a collection of Templates that can be applied to a listing at the same time" (https://support.sellbrite.com/en/articles/3367215-get-started-with-templates-and-recipes). Linnworks calls the same thing a configurator, "like a mould or a cookie cutter for listings", and "A configurator existing is the mandatory prerequisite for creating a listing" (https://help.linnworks.com/support/solutions/articles/7000059577-listing-configurators). Rithum applies "business rules ... to outgoing data templates" that alter data "prior to being sent" (https://www.rithum.com/blog/business-rules-101-introduction-to-business-rules/).

**Category is the gate that reveals the rest of the form.** Sellbrite's Category Template "displays the required Conditions and Item Specifics for that category" and each required specific is mapped to a product field (same URL). Lengow separates "Common Fields" from "Attributes by Category", the latter driven entirely by the category mapping (https://help.lengow.com/hc/en-us/articles/360012195631-Attributes-Mapping). Amazon formalises this: the Product Type Definitions API returns a JSON Schema per product type and marketplace describing "all requirements, attributes, and the conditionality of the requirements" (https://developer-docs.amazon/sp-api/docs/product-type-definitions-api).

**Required only, by default.** Sellbrite: "By default, Sellbrite only displays the required fields", with the rest behind Advanced Options (https://support.sellbrite.com/en/articles/3367218-how-to-use-ebay-listing-templates). Lengow marks channel attributes Blocked, Required with an asterisk, Optional and Services. Codisto is the most explicit about why: required or recommended eBay specifics "show with an asterisk", and you must enable a specific before it appears as a column, to avoid "saturating the multi-edit grid" (https://get.codisto.help/hc/en-us/articles/235260707-eBay-Item-Specifics).

**Category mapping is suggested, then confirmed, then remembered.** Lengow shows up to three candidates drawn from reuse of a prior mapping to a channel with the same taxonomy, its accumulated knowledge, and keyword and breadcrumb analysis, and says plainly "This tool doesn't select the category for you"; mapped tiles are green, unmapped orange, with a coverage bar that turns green above 90% (https://help.lengow.com/hc/en-us/articles/360012195891-Categories-Suggestion, https://help.lengow.com/hc/en-us/articles/360011963572-Categories-mapping). Sellbrite suggests the channel category from your own category and makes the Category Template reusable so it applies to every future listing in that category. Codisto auto-categorises eBay listings from the product title, parking them in a holding bucket until Auto-Cat finishes, with manual override (https://get.codisto.help/hc/en-us/articles/360001928415-eBay-categories). Shopify Marketplace Connect "automatically suggests product categories ... using Shopify's Standard Product Taxonomy" (https://help.shopify.com/en/manual/online-sales-channels/marketplace-connect/products/manage/product-taxonomy-amazon). Feedonomics uses Google Product Category as the hub, reuses it for Microsoft and Meta, then maps out to Amazon, eBay, Walmart and TikTok, and claims "FeedAi ... automatically categorizes your products with 97% accuracy" (https://feedonomics.com/blog/product-categorization/).

**Linnworks stores the mapping on the product, not in a wizard.** eBay category can be auto-selected per SKU from extended properties named `EBAY_CATEGORY` or `STORE_CATEGORY`, by name or numeric ID, with country suffixes like `EBAY_CATEGORY_US`; a configurator can hold up to 500 categories (https://help.linnworks.com/support/solutions/articles/7000010292-ebay-autoselect-category-or-store-category-when-creating-new-listings).

**Validation is two-layered.** A light pre-check, then channel-returned errors attached per listing. Feedonomics validates required fields with "hard stops block bad exports" before sending, and afterwards "automatically retrieves error data from marketplaces and summarizes the count of products affected" per channel and region with a drill-down (https://feedonomics.com/product/how-it-works/, https://feedonomics.com/blog/how-to-save-time-fixing-errors-on-marketplaces/). Rithum shows errors in two views, "Errors and Messages" grouped by error type and "By Product" per SKU (https://www.rithum.com/blog/how-to-fix-general-marketplace-errors/). Sellbrite and Linnworks pass the marketplace text straight through, for example eBay 21919303 for missing required item specifics (https://support.sellbrite.com/en/articles/3367259-ebay-common-errors, https://help.linnworks.com/support/solutions/articles/7000029573-ebay-errors-when-listing). Amazon supports a `VALIDATION_PREVIEW` mode so you can "preview errors before partially updating" a listing (https://developer-docs.amazon/sp-api/docs/preview-errors-before-partially-updating-a-listing).

Not verified: any rendered per-channel listing preview in any of these tools. None documented one.

### Social and video cross-posting

**The template with detach model.** Metricool is the clearest: create post, pick networks, then "Edit by network" gives a Template tab plus one tab per network; clicking "Edit content" on a network tab detaches it from the template, and "use template" re-attaches (https://help.metricool.com/en/article/multiposting-edit-per-social-network-zv924v/). Hootsuite has the same shape with "Restore original post" per network or "Restore this post across all networks" (https://help.hootsuite.com/hc/en-us/articles/1260804305949-Create-and-publish-posts). Buffer forks per network type rather than per channel, so two Facebook pages share one box (https://support.buffer.com/article/642-scheduling-posts).

**Network-only fields live inside the fork, and that has a documented failure mode.** Metricool puts YouTube audience and made-for-kids, visibility, category and tags, and TikTok privacy, comments, duet, stitch and commercial disclosure on the network's own tab (https://help.metricool.com/scheduling-and-posting-options-by-social-network-cwmb3). Publer documents what goes wrong: posting to several accounts at once hides TikTok's required fields, so you get "Please select the TikTok video privacy." and have to customise for TikTok to answer it (https://publer.com/help/en/article/why-do-i-get-please-select-the-privacy-settings-for-tiktok-b9yt8n/). The lesson for us is not "don't hide fields", it is "a hidden required field must be surfaced as a blocking error that takes you to it", which is what our issue links already do.

**Three ways to handle media that does not fit.** Hard block: Metricool shows "a red warning and won't be able to save the post" when format, size or ratio fails, and auto-converts unsupported image formats to JPG on save (https://help.metricool.com/en/article/publishing-requirements-for-images-and-videos-from-metricool-pyf6om/). Silent transform with an honest preview: Publer crops Instagram photos outside 1.91:1 to 4:5 and the preview shows the result (https://publer.com/help/en/article/what-post-types-are-supported-and-what-are-their-limitations-1687rte/). Downgrade the path: Buffer switches an out-of-range Instagram post to notification publishing rather than failing (https://support.buffer.com/article/622-instagrams-accepted-aspect-ratio-ranges).

**Limits are shown live per network.** Hootsuite has "character count update as you type" per network. Buffer publishes a static per-network limit table and notes API limits can be stricter than native (https://support.buffer.com/en-us/articles/character-limits-for-each-social-network-mNDqsEV9Nf).

**Per-account defaults exist, and the honest tools name what cannot be defaulted.** Publer's Post Presets hold a default signature, watermark, auto-comment, Pinterest default board, Instagram and Facebook default location and Bluesky default language, applying only to new posts (https://publer.com/help/en/article/how-to-specify-post-presets-for-a-social-account-qtjiw1/), and Publer states that TikTok privacy and engagement settings cannot be defaulted because it is "prohibited by the TikTok API" (https://publer.com/help/en/article/managing-tiktok-accounts-in-publer-1gloujj/).

### Music distribution

One release form, and the store rules are enforced inside it rather than at review. TuneCore auto-capitalises titles to iTunes rules and forces a fixed list of short words to lowercase (https://support.tunecore.com/hc/en-us/articles/115006503247, snippet-sourced). Each distributor publishes a single artwork spec that is its own reading of the strictest store: DistroKid minimum 1000x1000, TuneCore 1600 to 3000, CD Baby 1400 to 3000, all square and RGB, all feeding the same stores (https://support.distrokid.com/hc/en-us/articles/360013534334, https://support.tunecore.com/hc/en-us/articles/115006685728, https://support.cdbaby.com/hc/en-us/articles/210998563, all snippet-sourced). Per-store choice is a checkbox list plus a handful of store-only extras: Apple Digital Masters, the TikTok and Apple preview clip start time, YouTube Content ID as a paid per-release option (https://support.distrokid.com/hc/en-us/articles/360040206913, https://support.distrokid.com/hc/en-us/articles/360013535314, snippet-sourced). Format errors surface at upload; content errors come back from human review by email, and DistroKid says a rejected release usually has to be deleted and re-uploaded (https://support.distrokid.com/hc/en-us/articles/10405555881619, snippet-sourced).

Not verified: whether any of the three carries store selection or extras forward from your last release. I found no article saying they do.

### Podcast hosting

The fork is show level versus episode level, and Apple's spec is the shared ceiling. Buzzsprout requires the whole Podcast Settings page (artwork, categories, language, artist, website) before directory submission, plus one published episode (https://www.buzzsprout.com/help/139-submitting-to-directories). Libsyn has a literal "Episode Defaults" settings page whose values preset every new episode form and can be changed per episode (https://support.libsyn.com/knowledgebase/episode-defaults/, snippet-sourced). Libsyn's Apple destination shows a green "Prepared for Submission" or a red icon with the specific errors it caught before you submit (https://support.libsyn.com/knowledgebase/itunes/, snippet-sourced), which is the closest thing in the whole survey to our per-platform readiness pill. Buzzsprout documents the after-the-fact rejections instead: Apple rejects for artwork spec and a missing website URL, Spotify may unpublish until a creator name and website are supplied (https://www.buzzsprout.com/help/171-common-directory-rejections).

### App and game stores

fastlane forks at the top directory and shares the layout below it: `metadata/` and `metadata/<lang>/` for Apple, `metadata/android/<locale>/` for Play, screenshots in per-device folders, `changelogs/<versionCode>.txt` with a `default.txt` fallback (https://docs.fastlane.tools/actions/deliver/, https://docs.fastlane.tools/actions/supply/). Its `precheck` is the only pre-upload content linter in the whole survey: named rules such as `placeholder_text`, `future_functionality`, `unreachable_urls`, `copyright_date`, each settable to warn, error or skip (https://docs.fastlane.tools/actions/precheck/). Play and Apple agree on a 30-character name and a 4000-character description but fork on the second line (80-character short description versus 30-character subtitle), the screenshot device matrix, and the age-rating questionnaire (https://support.google.com/googleplay/android-developer/answer/9859152, https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information). Steam publishes exact capsule sizes and runs a human review with four named checks (https://partner.steamgames.com/doc/store/assets/standard, https://partner.steamgames.com/doc/store/review_process).

## Part B. The ten 3D platforms

### Nobody has built this

I found no tool, open source or commercial, that uploads one model to two of these platforms at once. Every cross-platform tool in the 3D space is a one-directional importer into the platform that owns it, and all the working ones source from Thingiverse.

Printables imports from Thingiverse, verified by putting your Printables profile link in your Thingiverse bio, models landing as drafts (https://blog.prusa3d.com/prusaprinters-org-is-now-printables-com-ultimate-database-of-3d-models-for-everyone_66880/, https://forum.prusa3d.com/forum/english-forum-general-discussion-announcements-and-releases/incoming-thingiverse-com-user-troubles-importing-designs-on-new-printables-com-website/). MakerWorld imports from linked third-party accounts as drafts, and its wiki now says "Currently, Printable is not supported due to technical limitations", leaving Thingiverse as the only working source (https://wiki.bambulab.com/en/makerworld/tutorials/how-to-upload-models); the Printables route died after Printables flagged MakerWorld links as spam in September 2023 and Bambu moved to a generated verification string (https://blog.bambulab.com/makerworld-drama). Creality Cloud imports from Thingiverse by the same bio-link method (https://www.crealitycloud.com/help-center/64b0b2209cfd2819549a6b57). Manyfold, self-hosted and open source, imports metadata and images from Thingiverse, MyMiniFactory and Cults3D, has Thangs import "disabled pending API clarification", and pushes to nothing (https://manyfold.app/news/2025/07/22/release-v0-118-0.html). 3Drop aggregates ten sites for browsing only (https://apps.apple.com/us/app/thingiverse-makerworld-3drop/id6467126425). Thangs Sync, despite the name, is 3D-native revision control from your PC to Thangs, not a cross-poster (https://thangs.com/sync).

The context for all the bio-link verification is Bambu's own "Protecting Creators' Rights" post alleging models were copied without permission to Creality Cloud, Nexprint and MakerOnline (https://makerworld.com/en/community/post/893618). Anything we build that looks like bulk cross-posting will be read against that background, which is an argument for ModelPrep staying a signed-in-as-you desktop tool rather than a server-side syndicator.

### What has an API

Only three of the ten have any documented programmatic write path.

Thingiverse has the only complete one: OAuth2 bearer tokens, 300 requests per 5 minutes, apps limited to 10 users until approved; `POST /things` requires name, license and category, with license an enum of nine values (`cc`, `cc-sa`, `cc-nd`, `cc-nc-sa`, `cc-nc-nd`, `pd0`, `gpl`, `lgpl`, `bsd`) and category given as the full name string on create but an id on PATCH; files upload through a pending-upload flow and `POST /things/{id}/publish` returns 400 with an errors array when name or description is blank; `GET /categories` returns the tree (https://www.thingiverse.com/developers/getting-started, https://www.thingiverse.com/swagger/docs/resources/thing.yaml, https://www.thingiverse.com/swagger/docs/resources/category.yaml).

MyMiniFactory has OAuth2 and a three-step upload: `POST /api/v2/object` with name and a files list, then `POST /api/v2/file?upload_id=` per file, then poll `GET /api/v2/object/{id}/upload_status`. 100 MB per file, and "currently only STL files are processed". `GET /categories` returns a tree. Notably, the documented `POST /object` body has no category field at all (https://github.com/MyMiniFactory/api-documentation/blob/master/upload-instructions.md, https://raw.githubusercontent.com/MyMiniFactory/api-documentation/master/myminifactory-api.yaml).

Cults3D publishes a GraphQL endpoint with Basic auth and an explicit limit: it "will not give you access to the 3D files", and the official page documents queries only. A community repo, not affiliated, documents `createCreation` and `updateCreation` mutations that attach assets by HTTPS URL, with observed throttling around 60 requests per 30 seconds (https://cults3d.com/en/pages/graphql, https://github.com/CheekyCodexConjurer/cults3d-api-docs). Whether those writes are supported is not verified.

MakerWorld and Printables are web form only. Printables runs an undocumented GraphQL backend at api.printables.com/graphql that third parties call with a browser user agent (https://github.com/manyfold3d/manyfold/issues/4530). MakerWorld has no developer portal; third parties use community-documented api.bambulab.com design-service endpoints (https://wiki.bambuddy.cool/features/makerworld/). Thangs, Nexprint, Creality Cloud, MakerOnline and MakerRoad have no public API I could find.

This validates the desktop-session architecture. There is no API-first version of this product to build.

### Category trees are two levels everywhere

MakerWorld has 11 roots (3D Printer, Art, Education, Fashion, Hobby and DIY, Household, Miniatures, Props and Cosplays, Tools, Toys and Games, Generative 3D Model) with numeric-ID slugs and one level of children (https://makerworld.com/en/models/categories). Thingiverse has 11 roots and one level (https://www.thingiverse.com/swagger/docs/resources/category.yaml). Printables uses two levels with numeric IDs (https://www.printables.com/model?category=13). Nexprint has eight roots and one level (https://www.nexprint.com/en/models). MakerRoad has eight roots (https://www.makeroad.com/printable_3D_model). Thangs exposes Category and SecondaryCategory columns in its bulk CSV, so two levels (https://thangs.com/resources/blog/introducing-the-thangs-sync-client-bulk-uploader). Cults3D takes one main category plus up to three sub-categories (https://cults3d.com/en/pages/advice-publishing-3d-file).

Two levels everywhere is the good news in this whole report. A hub taxonomy with two levels can map onto all ten without information loss, which is what `SHARED_CATEGORY_DEFAULTS` already assumes. Only Thingiverse and MyMiniFactory publish an endpoint to read their tree, so the rest have to be snapshots, which is what we do.

### Unique capabilities, and what they cost

These are the things a shared form must never swallow.

MakerWorld: print profiles that must pass cloud slicing before publishing (5 minutes per plate, 15 per 3MF), each needing at least one photo of a model printed with that profile, with banned title words including "fast", "quick", "better", "guaranteed", "exclusive", "official", "verified", "best" and "100% success" (https://wiki.bambulab.com/en/makerworld/tutorials/print-profile-upload). Bill of Materials from Maker's Supply, which unlocks Commission Incentives at 500 followers, one CyberBrick model, $100 of BOM sales or 20 BOM orders in 12 months (https://makerworld.com/en/faq). CyberBrick models need a named JSON control config, a control layout diagram per config, assembly instructions as PDF or video and a complete BOM, and pass a manual review (https://makerworld.com/en/cyberbrick, partially verified). Laser and Cut with .lac from Bambu Suite, requiring material and process type. The Exclusive Model Program pays Exclusive Points at $0.066 each with a $100 withdrawal threshold, needs 100 accumulated prints, and requires that the model be removed from all other platforms (https://wiki.bambulab.com/en/makerworld/tutorials/exclusive-model-guideline, https://blog.bambulab.com/exclusive-model-program-cash-rewards-and-copyright-support). Licence list read from the site: Public Domain, BY, BY-SA, BY-ND, BY-NC, BY-NC-SA, BY-NC-ND, Standard Digital File License, plus a MakerWorld Exclusive License for exclusive models.

Printables: the Store, launched December 2023, 20% fee, minimum price $5, slots unlocking with sales and unlimited at 50, with three store licences (Standard Digital File, Commercial Use, Commercial Use No Derivative); Clubs at 10% with up to five tiers priced $3 to $100, requiring level 18 or a reviewed portfolio; paid models cannot enter contests or earn Prusameters (https://blog.prusa3d.com/printables-store_87810/, https://blog.prusa3d.com/printables-clubs-are-live-you-can-now-support-the-creators-you-love-on-printables_81063/).

Cults3D: 80% to the designer, and pricing modes a dropdown cannot express, namely fixed, open price with a minimum plus optional extra, free with donations at a €0.50 minimum, and "Make an offer" negotiation; 15 licence choices including Cults-specific PU, CU and CU-ND alongside CC and four open-source licences (https://cults3d.com/en/upload, https://cults3d.com/en/licenses).

MyMiniFactory: human printability review within two working days, real print photos preferred over renders, and tiered commissions of 15%, 12.5% and 10% at $9.99, $24.99 and $99.99 per month (https://creator.myminifactory.com/file-approval, https://creator.myminifactory.com/store-manager-fees).

Thingiverse: Customizer, which needs a .scad file with annotated parameters; an explicit ancestor graph for remixes via `ancestors[]` and `is_remix`; Education lessons tagged by grade band and subject (https://www.thingiverse.com/apps/customizer/instructions). Thingiverse was acquired by MyMiniFactory in February 2026 (https://en.wikipedia.org/wiki/Thingiverse), which is worth watching: the two may converge.

Thangs: the licence is not a dropdown at all, it is an attached file, plaintext, PDF or markdown, and Thangs remembers "the last 5 licenses you used" (https://thangs.com/resources/help-center-articles/what-license-files-can-i-attach-to-my-model). Marketplace fees are 14% on memberships and tiered 30%, 20%, 15% on individual sales by price band (https://thangs.com/resources/getting-started-for-designers). Three multi-file upload modes: Assembly, Single Collection and Bulk (https://thangs.com/resources/blog/model-upload-options).

Nexprint (Elegoo, not Anycubic): the $1M Creator Fund pays $5 per approved model plus $5 for high quality, needs at least two images including one real photo of the print, a description, and recommends print profiles; the November 2025 update names the rejected types, flat 2D items, low-complexity organisers, AI or generator-based models such as Hueforge, lithophanes and vases (https://www.nexprint.com/en/activities/1-million-creator-fund, https://www.nexprint.com/en/article/SubmissionUpdate). Points convert at roughly 100 points to a $9.2 coupon.

Creality Cloud: three source types with "Non-original" requiring authorisation from the creator; at least three images that must be "high-definition real pictures"; and a warning that "Inconsistency between the category and the model will result in a failed audit" (https://www.crealitycloud.com/help-center/the-ultimate-guide-to-uploading-3d-models). Licences include CC0 through BY-NC-SA plus a Standard License (https://www.crealitycloud.com/post-detail/69b3f2ccf6b153ff3e2c1aa6).

MakerOnline (Anycubic): Standard Coins redeemable for goods versus Revenue Coins that are directly cashable, paying per download of exclusive models, with 30-day or 90-day exclusivity agreements (https://forum.makeronline.com/en/forum/topic/%20Makeronline%20Exclusive%20Models%20%20Cashable%20Rewards%20Coming%20Soon-5293.html). Creative Kit is a real browse category (https://www.makeronline.com/en/allModel/creative-kit-model/all/119.html).

MakerRoad (SUNLU, not Elegoo): points by model grade, Basic 10, Intermediate 35, Advanced 200, Top 600, with monthly caps, and images "must include at least one real printed image that matches the uploaded model file" (https://www.makeroad.com/).

### Corrections to our own matrix

Three things the platform docs contradict or add to what our code assumes.

1. **Thangs licence is a file, not text.** Our panel has a free-text licence seeded from `THANGS_LICENSE_MAP`. Thangs takes an uploaded licence file and offers your last five. Worth checking what our adapter actually sends.
2. **MyMiniFactory's documented create endpoint has no category field.** Our panel treats MMF category as a required decision and blocks without it. Either we set it another way or the block is asking for something the API does not take. Worth checking the adapter.
3. **Thingiverse category is a name string on create, an id on PATCH.** Easy to get wrong in one direction.

And two rules we could enforce in preflight for free, because they are documented and mechanical: MakerWorld's banned print-profile title words, and the contradiction between MakerWorld Exclusive (which requires removal from every other platform) and having other platforms enabled in the same project. The second is the kind of thing a cross-publisher uniquely can catch and a single-platform uploader never could.

## Part C. Mapping approaches, and what each costs

**Hub-and-spoke crosswalk.** One shared taxonomy, one audited native value per platform per shared category, maintained by us. Feedonomics does this with Google Product Category, Shopify with its Standard Product Taxonomy, and ModelPrep already does it with `SHARED_CATEGORY_DEFAULTS`. Cost: ten columns to maintain and re-audit when a platform changes its tree. Benefit: zero clicks when the row is filled. Risk: a wrong row is silently wrong for every user, which is why the row should always be visible as a value the user can see and change, not an invisible transform. Our `AutoMatchNote` ("Matched from your Details category, change below to override") is the right shape.

**Suggest, confirm, remember.** Lengow's three candidates, Codisto's auto-categorise from title, Sellbrite's suggestion from your own category. Cost: one click per gap. Benefit: covers the categories where the crosswalk has no row, which for us is the handful where MyMiniFactory has no sensible match. Risk: a confident wrong suggestion is worse than an empty field, which is why Lengow refuses to auto-select and shows three.

**Learned override.** The user's correction becomes their permanent mapping. Sellbrite's reusable Category Template, Linnworks' `EBAY_CATEGORY` extended property, Lengow's reuse of a prior mapping. Cost: one small store keyed by shared category and platform. Benefit: the largest of any option here, because it turns the ten category decisions into a one-time cost per user rather than a per-project cost. Risk: a correction made for one odd project poisons later ones, which argues for scoping the memory to the shared category rather than the project, and for showing it where it can be seen and cleared.

**Strictest rule wins for assets.** Music and podcast distributors publish one spec that satisfies every store. Interesting nuance: for the same set of stores, DistroKid, TuneCore and CD Baby chose different minimums (1000, 1600, 1400), and the three podcast hosts chose different file-size ceilings for identical pixel rules. So "strictest" is a judgement, and stating it plainly beats making the user compare ten specs. We already do this on images, where MakerRoad's 3 to 10 window is the binding constraint.

**Per-account defaults.** Publer's Post Presets, Libsyn's Episode Defaults. We have this as "Remember these settings". The matrix found it leaks project-specific values (Thing ID, BOM rows, resume draft ID) because the exclusion list is a substring regex. Fix the list, do not remove the feature.

**LLM or embedding category suggestion.** Feedonomics claims 97% with FeedAi; Rithum said in a Q3 update that "One template, all channels ... lays the foundation for future category and attribute suggestions powered by AI", meaning it had not shipped. For us this is only worth it if the crosswalk plus learned overrides still leaves gaps, and it must go through the same confirm step, never straight to the field.

## Part D. What I would do in ModelPrep

### The flow

**First project.** Files, Details, Images, Platforms, Publish, which is what we now have. The one change worth making to Platforms is to lift the decisions out of the cards: a single "Needs you" list at the top of the step, one row per unanswered decision across all ten platforms, each with its control inline. In a typical project that list is the two or three categories the crosswalk could not fill, plus a price if Cults3D is on. The ten cards stay underneath as the detailed view, which is where every platform-unique field continues to live. This is Feedonomics' error overview and Lengow's coverage bar applied to our step, and it means a user who accepts every default never opens a card.

**Repeat project.** The same list, empty, because every correction from the first project became a mapping. That is the whole point.

### The data

Three stores, small ones.

- `modelprep:category-map:v1`, keyed shared category then platform, holding the native value the user chose. Written when the user overrides a suggestion, read as a higher-priority seed than `SHARED_CATEGORY_DEFAULTS`. This is the single highest-value change in the report.
- The existing per-platform defaults, with `isProjectBound` fixed to exclude `summary`, `source*Id`, `resumeDraftId`, `versionNotes`, `bom`, `boms`, `otherParts`, `planTime` and `payValue`, and turned into an explicit list rather than a substring regex, since "profile" containing "file" is currently excluding things by accident.
- Per-project derived values, which is what `shared-defaults.js` already produces.

### What stays asked

Category, wherever the crosswalk and the learned map are both empty. Price, everywhere something is sold, because it is money. The two self-attestations at publish, because they are claims about the user, not the model. Anything account-gated, because we cannot know the answer without asking the platform.

### What gets automated further

Print settings, which are asked three times today (Thingiverse printer, material, resolution, infill; MyMiniFactory technology and material quantity; MakerOnline profile title and description; MakerRoad printers, materials and colours) while `packageDerivedPatch` already reads most of them from the sliced 3MF. Extending it to MakerRoad and MakerOnline empties most of those fields.

The duplicated summary, which Printables and Thingiverse each ask for and each fall back to the description for. One optional short summary in Details with per-platform override.

The nine batch-action selects under four different labels, which all write `publication`. One control, one label, and the card's "native outcome" line becomes readable without opening it.

### What must not change

Platform-unique fields stay inside that platform's panel, in their own subsection, revealed by the platform being enabled rather than shown to everyone. Codisto's rule, "you must enable a specific before it appears as a column", is the same instinct. The cost of hiding them is the Publer failure mode, a required field the user cannot see, and the answer to that is the one we already have: a blocking issue that links to the field and opens the panel.

### Preflight additions worth the hour

- MakerWorld print-profile titles containing "fast", "quick", "better", "guaranteed", "exclusive", "official", "verified", "best" or "100% success".
- MakerWorld Exclusive enabled while other platforms are enabled in the same project, which the Exclusive terms forbid.
- Creality's minimum of three images and its explicit warning that a category mismatch fails the audit.
- Nexprint's rejected content types as guidance, not a block, since we cannot reliably detect a lithophane.
