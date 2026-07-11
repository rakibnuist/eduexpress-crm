# Rules

## Strict Data Preservation
- NEVER push changes to Git that overwrite, track, or wipe the `crm.db` file or any other user-generated data files.
- ALWAYS ensure `crm.db` and data directories remain explicitly ignored in `.gitignore`.
- Before running any destructive commands or deployments, double-check that live user data is completely protected.
