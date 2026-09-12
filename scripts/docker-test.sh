#!/usr/bin/env sh
# Copyright (c) 2026 Gavriq Labs Global. All rights reserved.
set -eu
script_dir=${0%/*}
if [ "$script_dir" = "$0" ]; then script_dir=.; fi
exec node "$script_dir/docker.mjs" test "$@"
