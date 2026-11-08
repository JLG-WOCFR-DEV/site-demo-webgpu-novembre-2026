#!/usr/bin/env bash
# Construit les deux modules wasm de Carnet, commités pour que la coquille web se construise sans
# chaîne Rust (à relancer après tout changement des crates) :
#   crates/carnet-wasm → src/carnet/wasm/   le core (modèle, vues), chargé d'abord
#   crates/presse-web  → src/presse/rs/     le rendu presse-rs (wgpu), chargé ensuite
#   Prérequis : rustup target add wasm32-unknown-unknown ; cargo install wasm-bindgen-cli --version 0.2.130 ; npm ci
set -euo pipefail
cd "$(dirname "$0")/.."
T=wasm32-unknown-unknown
build() {
  if rustup target list --installed 2>/dev/null | grep -q "^$T$"; then
    cargo build -p "$1" --release --target "$T"
  else
    # Sans la cible précompilée (réseau fermé à static.rust-lang.org) : std reconstruite depuis rust-src.
    RUSTC_BOOTSTRAP=1 cargo build -p "$1" --release --target "$T" -Zbuild-std=std,panic_abort
  fi
}
# wasm-opt (paquet npm binaryen, en devDependency).
opt() {
  npx --no-install wasm-opt -Oz --strip-debug --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
    --enable-mutable-globals --enable-reference-types --enable-multivalue -o "$1" "$1"
}
build carnet-wasm
wasm-bindgen --target web --out-dir src/carnet/wasm --out-name carnet "target/$T/release/carnet_wasm.wasm"
opt src/carnet/wasm/carnet_bg.wasm
build presse-web
wasm-bindgen --target web --out-dir src/presse/rs --out-name presse_web "target/$T/release/presse_web.wasm"
opt src/presse/rs/presse_web_bg.wasm
ls -l src/carnet/wasm src/presse/rs
