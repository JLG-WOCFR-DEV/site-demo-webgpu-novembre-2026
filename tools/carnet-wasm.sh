#!/usr/bin/env bash
# Construit crates/carnet-wasm et génère src/carnet/wasm/ (module ES + .wasm), commité pour que la
# coquille web se construise sans chaîne Rust. À relancer après tout changement de carnet-core.
#   Prérequis : rustup target add wasm32-unknown-unknown ; cargo install wasm-bindgen-cli --version 0.2.100 ; npm ci
set -euo pipefail
cd "$(dirname "$0")/.."
T=wasm32-unknown-unknown
if rustup target list --installed 2>/dev/null | grep -q "^$T$"; then
  cargo build -p carnet-wasm --release --target "$T"
else
  # Sans la cible précompilée (réseau fermé à static.rust-lang.org) : std reconstruite depuis rust-src.
  RUSTC_BOOTSTRAP=1 cargo build -p carnet-wasm --release --target "$T" -Zbuild-std=std,panic_abort
fi
wasm-bindgen --target web --out-dir src/carnet/wasm --out-name carnet "target/$T/release/carnet_wasm.wasm"
# wasm-opt (paquet npm binaryen, en devDependency) : 1 Mo → 0,4 Mo, 170 Ko compressé.
npx --no-install wasm-opt -Oz --strip-debug --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
  --enable-mutable-globals --enable-reference-types --enable-multivalue \
  -o src/carnet/wasm/carnet_bg.wasm src/carnet/wasm/carnet_bg.wasm
ls -l src/carnet/wasm
