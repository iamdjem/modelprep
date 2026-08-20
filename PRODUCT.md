# ModelPrep

## What it is

A macOS desktop app (Electron shell, React renderer in `deploy/`) that prepares one 3D model
package and publishes it to ten 3D printing platforms: MakerWorld, Printables, Cults3D,
MyMiniFactory, Thingiverse, Thangs, Nexprint, Creality Cloud, MakerOnline, MakerRoad.

## Who uses it

A 3D model creator who prints at home and sells or shares models. They prepare a package
(model files, print profiles, renders, photos), write one listing, and want it on every
platform without repeating the upload wizard ten times. They work at a desk on a laptop or
external display, usually in daylight. They are technical enough to slice models but are not
developers.

## Register

Product. The design serves the task; earned familiarity over novelty. Peers: Linear, Mews,
Figma's file browser. Not a marketing surface.

## Platform

web (Electron renderer; desktop-first, minimum useful width around 1000 px)

## Core flow

Six steps, named the way the sidebar names them: Files, Details, Images, Profiles,
Platforms, Publish. Files takes model files, print profiles and photos and gives each a
role. Details is the listing, written once: title, description, category, licence, tags,
and the shared origin and disclosure answers ModelPrep adapts into every platform's own
fields. Images is the cover, gallery and video. Profiles appears only when a sliced 3MF
is present. Platforms is where each destination is turned on and customised. Publish is
one row per platform carrying its outcome, what is blocking it and its receipt.

Platform accounts live in Settings, a panel on the right edge; a "Connect X" button
anywhere in the app opens that one platform's sign-in. Publishing must never fabricate
data: blocked platforms are skipped and reported, never retried silently, and nothing
uploads while a publish-time confirmation is outstanding.

A project library is the main thing the flow still lacks; it is what "duplicate this
project" would be built on.

## Constraints

- Platform brand dot colors appear next to platform names and must stay recognizable.
- Dense evidence-heavy states (the publish queue and receipts) need tabular numbers and
  clear semantics.
- Three severities, not two. A blocker is something the platform would reject. An
  adaptation is something ModelPrep changes by itself and never colours a card. An
  optional gap is invisible outside that platform's own panel. A note must never read as
  a problem.
- The app runs offline except during publishing; fonts must have real fallbacks.
