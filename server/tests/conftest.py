"""Shared test bootstrap: keep the suite hermetic to operator env.

`LOUPE_ALLOWED_ORIGINS` / `LOUPE_ALLOWED_HOSTS` are now a documented operator
workflow (J2 runbook § 0bis), and `app.main` bakes them into its middleware AT
IMPORT TIME — a developer running pytest with a deployed origin exported would
see the CORS/OriginGuard tests fail for no code reason. Scrub them here:
conftest imports before any test module, so this runs before `app.main` does.
"""

import os

for _var in ("LOUPE_ALLOWED_ORIGINS", "LOUPE_ALLOWED_HOSTS"):
    os.environ.pop(_var, None)
