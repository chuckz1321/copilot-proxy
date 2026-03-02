#!/bin/sh
case "$1" in
  --auth)
    exec bun run dist/main.js auth
    ;;
  stop|restart|status|logs|enable|disable)
    exec bun run dist/main.js "$@"
    ;;
  *)
    exec bun run dist/main.js start -g "$GH_TOKEN" "$@"
    ;;
esac
