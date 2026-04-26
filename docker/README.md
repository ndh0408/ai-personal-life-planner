# Docker

Local stack uses the root `docker-compose.yml` (Postgres + Redis only).

Production-ready images for the API live alongside the API source: `apps/api/Dockerfile`.

This folder is reserved for future production compose files (e.g. nginx + api + worker)
and helper Dockerfiles (e.g. db backup runners). Empty for MVP foundation.
