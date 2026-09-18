# Copyright (c) 2026 Gavriq Labs Global. All rights reserved.
& node (Join-Path $PSScriptRoot 'docker.mjs') 'rebuild' @args
exit $LASTEXITCODE
