# Air-Gap Install

1. Verify the bundle checksums with `./scripts/verify-bundle.sh`.
2. Load Docker images with `./scripts/load-docker-images.sh`.
3. Run `./scripts/install-offline.sh`.
4. Start the stack with `docker compose up -d`.
5. Verify the runtime with `docker compose run --rm cli aegis doctor`.
