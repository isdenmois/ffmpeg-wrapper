build:
    bun run build
    sed -i '1s;^;#!/usr/bin/env bun\n;' dist/ff
    chmod +x ./dist/ff

deploy: build
    cp dist/ff ~/.bin/