---
name: EcoMove — Visual Scaffolding Design System (Auralis Architecture)
colors:
  surface: '#F7F7F5'
  surface-panel: '#F3F2EF'
  surface-card: '#FCFCFB'
  surface-lowest: '#FFFFFF'
  surface-high: '#EBE7E6'
  surface-highest: '#E5E2E1'
  border-scaffolding: '#E7E7E4'
  outline-variant: '#C4C7C7'
  on-surface: '#111111'
  on-surface-secondary: '#6B6B6B'
  primary: '#111111'
  on-primary: '#FFFFFF'
  accent-eco: '#10B981'
  accent-indigo: '#6366F1'
  error: '#BA1A1A'
typography:
  h1:
    fontFamily: Geist, Inter, sans-serif
    fontSize: 84px
    fontWeight: '600'
    lineHeight: '0.96'
    letterSpacing: -0.04em
  h2:
    fontFamily: Geist, Inter, sans-serif
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.08'
    letterSpacing: -0.03em
  h3:
    fontFamily: Geist, Inter, sans-serif
    fontSize: 28px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  body:
    fontFamily: Geist, Inter, sans-serif
    fontSize: 17px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  label-caps:
    fontFamily: Geist Mono, monospace
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  3xl: 1.75rem
  full: 9999px
---

# EcoMove — Visual Scaffolding Design System

Adapted from the Stitch **Auralis Architecture** design system (`projects/3907361547178343444`) for **EcoMove (UPX IV — Centro Universitário Facens)**.

## 1. Brand & Aesthetic Philosophy ("Visual Scaffolding")

EcoMove's interface functions as a high-precision urban mobility and geospatial instrument. It blends **architectural minimalism** with **glassmorphic tonal layering**, emphasizing structural containment through crisp `1px` borders (`#E7E7E4`), warm stone-white surfaces (`#F7F7F5` / `#F3F2EF` / `#FCFCFB`), and deep charcoal typography (`#111111`).

- **Tonal Surfaces**:
  - Canvas background: `#F7F7F5`
  - Recessed panels / bento containers: `#F3F2EF`
  - Elevated cards: `#FCFCFB` with `1px solid #E7E7E4`
  - Floating glass bars: `rgba(247, 247, 245, 0.82)` with `backdrop-filter: blur(16px)`
- **Atmospheric Orbs & Data Accents**:
  - Soft diffused radial gradients (`emerald-300`, `teal-200`, `indigo-300`, `sky-300`, `amber-200`) live inside contained showcase panels (`blur-3xl`) to evoke clean air, geospatial heatmaps, and AI intelligence without cluttering the structural grid.
- **Typography & Hierarchy**:
  - Display headlines (`h1`, `h2`) use tight negative tracking (`-0.04em` to `-0.03em`) and compact line heights.
  - Technical metadata, coordinates (`SRID 4326`), ODS tags, and status chips use uppercase monospaced labels (`12px`, `0.08em` tracking).
- **Motion & Smooth Transitions**:
  - **Lenis** provides inertial smooth scrolling across the public showcase.
  - **GSAP + ScrollTrigger** drives staggered section reveals, parallax orb motion, and interactive module transitions while respecting `prefers-reduced-motion`.
