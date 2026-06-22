# Folder import — how to organize a model

Click **Import** in ModelPrep's header and pick a model folder. The app infers
everything from how the folder is organized — no config file needed. Then it
drops you on the **Details** step to review, and you walk to **Publish**.

Everything below is **optional**; whatever's missing is reported (never guessed).

```
Articulating Desk Dragon/      ← folder name becomes the TITLE
├── description.md             ← becomes the DESCRIPTION (readme.md also works)
├── tags.txt                   ← TAGS, comma- or line-separated
├── license.txt                ← LICENSE: "CC-BY-SA", "CC0", "CC-BY-NC", "Standard"…
├── category.txt               ← CATEGORY: one of the app's categories (e.g. "Toys & Games")
├── title.txt                  ← optional TITLE override (else the folder name)
├── cover.jpg                  ← the COVER photo (otherwise the first photo wins)
├── photos/                    ← GALLERY images, ordered by filename (01-…, 02-…)
│   ├── 01-printed.jpg
│   └── 02-detail.jpg
└── files/                     ← MODEL files: .stl / .3mf / .step / .obj / .amf
    └── dragon.3mf             ← each .3mf automatically becomes a print profile
```

Files can also sit loose in the root — the app classifies by extension, so a
folder with a few photos and one STL still imports fine.

The `Articulating Desk Dragon/` folder here is a ready-to-try example: it has the
text files filled in. Add a couple of photos to `photos/` and an `.stl`/`.3mf`
to `files/`, then drag the folder onto **Import**.

> Batch import (a parent folder containing many model folders → publish them all)
> is the next step. For now, import one model folder at a time.
