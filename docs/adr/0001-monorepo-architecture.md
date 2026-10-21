# Monorepo Architecture for Mobile, Web, and API

We decided to structure EcoMove as a single monorepo containing `/apps/mobile` (Flutter), `/apps/web` (Web Portal for `MobilityManager`s), and `/apps/api` (Node.js/TypeScript backend), governed by a single root `GLOSSARY.md`. With a 5-person academic team split across mobile, web, backend, and research/documentation, a monorepo prevents API contract drift, keeps domain terminology unified in one place, and simplifies running and evaluating the entire platform during the UPX IV assessment.
