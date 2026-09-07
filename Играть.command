#!/bin/zsh
# Open the adjacent game, including when this folder is moved.
cd -- "$(dirname -- "$0")" || exit 1
open -a Safari "$PWD/Дикий дрифт.html"
