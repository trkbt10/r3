# Delegation-contract Makefile for @trkbt10/r3.
#
# The parent orchestration repository (../../.. from this worktree)
# drives every product through `make -C source <target>`. This
# Makefile is the product-side half of that contract: each target
# below maps one delegation verb onto this package's bun toolchain.
# See the orchestrator's root CLAUDE.md, "The product (source/)"
# section, for the full contract (install / typecheck / lint / test /
# build / dev / fixture).
#
# `build` intentionally does not stop at the bundler. This package's
# own iron rule ("green only once consumed") means a library build is
# unproven until something outside the library imports the built
# dist/ output and exercises it. `build` therefore chains
# `verify:consumer` — a plain Node script that imports dist/ via the
# package.json `exports` map exactly as an external consumer would —
# right after `vite build` produces it.
#
# `fixture` builds the demo app under fixture/ (a Vite project that
# imports ../dist, never src/) as a static site into $(DIR), so a
# human or an automated screenshot pass has something real to look
# at. It is deterministic (same URL states every run) and disposable
# (always rebuilt from scratch — see the fixture target below).

DIR ?= /tmp/r3-fixture

.DEFAULT_GOAL := help

.PHONY: help install typecheck lint test build dev fixture

help:
	@echo "Targets:"
	@echo "  install    - bun install"
	@echo "  typecheck  - tsc -p tsconfig.json --noEmit (src/ + spec/ only)"
	@echo "  lint       - eslint . (repo-wide, warnings treated as failures by CI)"
	@echo "  test       - vitest --run"
	@echo "  build      - vite build, then verify the dist/ output as a consumer would"
	@echo "  dev        - build the library, then start the fixture demo's Vite dev server"
	@echo "  fixture    - rebuild the library + fixture demo as a static site into DIR"
	@echo ""
	@echo "Variables:"
	@echo "  DIR        - fixture output directory (default: $(DIR))"

install:
	bun install

typecheck:
	bun run typecheck

lint:
	bun run lint

test:
	bun run test

# Build the library, then prove the build is consumable: import every
# package.json exports entry from dist/ in a plain Node script and
# exercise real behaviour (Stage construction, scene lifecycle,
# tweening, layout-engine arrangement, scrolling, theming, text
# wrapping). See scripts/verify-consumer.ts for what each check does
# and why.
build:
	bun run build
	bun run verify:consumer

# Bring up the fixture demo against a freshly built library. The demo
# app's Vite config aliases "@trkbt10/r3" (and every subpath) to
# ../dist, so this only makes sense once dist/ exists.
dev:
	bun run build
	cd fixture && ../node_modules/.bin/vite

# Deterministic, disposable verification sandbox: rebuild the library,
# then vite-build the fixture demo as a static site into DIR. DIR is
# wiped and repopulated on every run (--emptyOutDir) so stale output
# never survives a failed build silently. Also typechecks the fixture
# app's own isolated tsconfig (fixture/tsconfig.json) — the fixture is
# deliberately excluded from the root tsconfig.json (see its
# "include") because dist/ does not exist yet when the root `typecheck`
# target runs earliest in a fresh CI pipeline.
fixture:
	bun run build
	cd fixture && ../node_modules/.bin/tsc -p tsconfig.json --noEmit
	cd fixture && ../node_modules/.bin/vite build --outDir "$(DIR)" --emptyOutDir
	@echo "Fixture written to $(DIR)"
