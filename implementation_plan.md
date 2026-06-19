# Architectural & Product Implementation Plan: The "Pathway Engine"

This plan outlines the strategic transition of the Pathways module from a static informational directory to an interactive, state-driven user journey. The goal is to build an ecosystem that solves the "Cascading Questions" problem while maintaining robust, automated data pipelines.

## Executive Summary
We are building a personalized "Pathway Engine." Instead of presenting flat data (tournaments, universities), we will ingest data via automated pipelines and route the user through a guided, prerequisite-checked experience based on their persistent profile (sport, GPA, location).

## 1. System Architecture & Data Strategy

### 1.1 Data Ingestion Layer (The Pipeline)
We will implement an automated Data Ingestion Layer decoupled from the core application logic to prevent bottlenecks and ensure resilience against third-party UI changes.
*   **Scraping Microservice:** A dedicated worker (e.g., Node.js with Puppeteer/Cheerio or Python with Scrapy) running on scheduled CRON jobs.
    *   *Tournament Pipeline:* Weekly sync of federation calendars (e.g., AITA).
    *   *Athletic Directory Pipeline:* Monthly sync of university coach directories (Sidearm Sports/PrestoSports).
*   **Data Normalization:** Scraped data will be sanitized and mapped to a unified schema before being upserted into the primary database.

### 1.2 The Logic Engine (Scholarships)
*   Instead of scraping static rules, we will build a **Rules Engine Module**.
*   This module will contain hardcoded configurations (JSON/YAML) representing the complex rules of organizations (NCAA, NAIA, NJCAA) such as equivalency vs. headcount limits, GPA requirements, and core course prerequisites. This ensures absolute accuracy and allows for easy annual updates.

### 1.3 Third-Party Integrations
*   **Academic Data:** Integrate with the US Department of Education's **College Scorecard API**. This will dynamically pull in tuition costs, graduation rates, and average SAT/ACT scores for universities, eliminating the need to scrape this highly volatile data.

## 2. Product & UX Implementation (The Frontend)

### 2.1 The "My Pathway" State Management
We need to persist the user's journey.
*   **Profile Expansion:** Expand the User/Athlete schema to store specific state: `current_sport`, `graduation_year`, `current_gpa`, `location_zip`, `test_scores`.
*   **The Dashboard:** A centralized view ("My Pathway") where users see their customized timeline, saved tournaments, and shortlisted colleges.

### 2.2 The Onboarding "Gateway" Wizard
*   Intercept the user *before* showing data tables.
*   Implement a multi-step component that captures the required profile state (e.g., "Do you have an AITA card?") and provides immediate actionable feedback based on their answers.

### 2.3 Interactive Calculators & Matchmakers
*   **Eligibility Calculator Component:** A client-side tool that cross-references the user's input (`current_gpa`) against the **Rules Engine Module** to output immediate D1/D2/D3 eligibility status.
*   **College Matchmaker Component:** A filtering interface that queries the database using the user's athletic and academic parameters against the normalized University/API data.

## 3. Phased Rollout Plan

To ensure rapid delivery and minimal risk, we will execute in three phases:

### Phase 1: Foundation & The Rules Engine (Weeks 1-2)
*   Update database schemas to support the "My Pathway" user state.
*   Implement the static Scholarship Rules Engine (hardcoded configs).
*   Build the frontend "Eligibility Calculator" utilizing this engine.

### Phase 2: Data Pipelines & Integration (Weeks 3-5)
*   Develop the Scraping Microservice. Start with *one* sport (e.g., Tennis/AITA) and *one* university athletic platform to prove the concept.
*   Integrate the College Scorecard API for academic data.
*   Set up automated CRON jobs and alerting for scraper failures.

### Phase 3: The UX Layer & The Matchmaker (Weeks 6-8)
*   Build the "Gateway" Wizard for Tournaments (Prerequisite checks).
*   Build the College Matchmaker interface, combining scraped coach data with API academic data.
*   Finalize the "My Pathway" dashboard to tie the entire experience together.

> [!IMPORTANT]
> **User Review Required:**
> *   Do we want to build the Scraping Microservice in the existing backend infrastructure, or isolate it as a separate serverless function (e.g., AWS Lambda/GCP Cloud Functions) to prevent it from affecting core app performance?
> *   For Phase 2, which specific Sport/Federation should we target for the MVP scraper to prove the concept?

## Open Questions
*   How should we handle data discrepancies if the scraped athletic coach data conflicts with the College Scorecard API data (e.g., university name mismatches)?
*   Are there any legal concerns or rate limits we need to investigate before scraping specific federation websites?
