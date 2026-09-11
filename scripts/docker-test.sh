#!/usr/bin/env sh
# Copyright (c) 2026 Gavriq Labs Global. All rights reserved.
set -eu
exec node "$(dirname "$0")/docker.mjs" test "$@"
