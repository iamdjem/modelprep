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

Package (files and print profiles) → Listing (details and media) → Destinations (platforms
and per-platform options) → Review and publish (preflight, queue, receipts). A Library holds
past projects. Connections manages platform accounts. Publishing must never fabricate data:
blocked destinations are skipped and reported, never retried silently.

## Constraints

- Platform brand dot colors appear next to platform names and must stay recognizable.
- Dense evidence-heavy states (preflight, queue) need tabular numbers and clear semantics.
- The app runs offline except during publishing; fonts must have real fallbacks.
