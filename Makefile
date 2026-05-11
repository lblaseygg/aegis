SHELL := /bin/bash

.PHONY: build cli rag-api docker-up docker-down bundle smoke

build:
	npm run build

cli:
	npm run dev:cli -- chat

rag-api:
	uvicorn app.main:app --app-dir apps/rag-api --host 127.0.0.1 --port 8088 --reload

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

bundle:
	./scripts/build-online-bundle.sh

smoke:
	./scripts/smoke-test.sh
