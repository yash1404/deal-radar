# Deal Radar

Real-time CRM intelligence platform that ingests CRM activity, processes events asynchronously, maintains deal state, calculates deal health, and provides AI-assisted insights.

## Prerequisites

This project uses managed cloud services instead of local Docker containers.

Before running the application, create a `.env` file from `.env.example` and configure the following services:

* MongoDB Atlas database
* Redis Cloud instance
* OpenAI API key 

All required environment variables are documented in `.env.example`.


## Environment Configuration

The application requires both backend and frontend environment variables.

### Backend (.env)

Configure:

* PORT
* MONGO_URI
* REDIS_HOST
* REDIS_PORT
* REDIS_PASSWORD
* REDIS_TLS
* OPENAI_API_KEY
* OPENAI_MODEL (optional)

Refer to `backend/.env.example`.

### Frontend (.env.local)

Configure:

* NEXT_PUBLIC_API_URL
* NEXT_PUBLIC_SSE_PATH

Refer to `frontend/.env.example`.

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SSE_PATH=/sse
```

The frontend uses these variables to:

* Fetch deal data from the backend API
* Subscribe to real-time updates via Server-Sent Events (SSE)



### Infrastructure Decision

I used MongoDB Atlas and Redis Cloud instead of local Docker containers.

This reduced local resource requirements and allowed me to focus on the event-processing, real-time streaming, and AI workflow aspects of the assignment.

To run the project, valid cloud service credentials must be provided through the .env file.


## Repository

GitHub Repository:
https://github.com/yash1404/deal-radar

Demo Video:
https://www.loom.com/share/8a0f7a3bc57e466595786deb3b9dc415

---

## Tech Stack

### Backend

* Node.js
* TypeScript
* Express
* BullMQ
* Redis
* MongoDB
* Server-Sent Events (SSE)

### Frontend

* NextJs
* TypeScript
* Zustand
* Tailwind CSS

### AI Layer

* OpenAI API
* Rule-based health scoring fallback

---

## How to Run

### 1. Clone Repository

```bash
git clone https://github.com/yash1404/deal-radar.git
cd deal-radar
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Start CRM Simulator

```bash
cd backend
npm run simulator
```

The simulator continuously generates CRM events and sends them to the webhook endpoint.

---

## What I Built

### Layer 1 – Backend

Implemented:

* CRM webhook ingestion endpoint
* BullMQ + Redis queue
* Asynchronous event processing
* Event deduplication using event_id
* Current deal state persistence
* Event history persistence
* Deal APIs
* Server-Sent Events for real-time updates
* CRM event simulator

Key APIs:

* GET /deals
* GET /deals/:dealId
* GET /deals/:dealId/events
* GET /deals/:dealId/health
* POST /webhook

---

### Layer 2 – Frontend

Implemented:

* Real-time activity stream
* Live SSE updates
* Deal health dashboard
* Deal detail drawer/panel
* Filtering by status
* Pause / Resume stream functionality
* Loading, empty, and error states

---

### Layer 3 – AI Insight Layer

Implemented:

* Health scoring service
* AI-generated deal explanations
* Rule-based fallback engine
* Validation layer to prevent unsupported scoring
* Grounded responses using stored deal and activity data

---

## AI Layer Architecture

Pipeline:

CRM Events
→ Queue
→ Worker
→ Deal State Update
→ Health Score Calculation
→ OpenAI Explanation
→ Frontend

The AI layer never directly invents deal data.

It receives:

* Current deal state
* Activity history
* Rule-based score
* Recent events

The model only explains the score and provides recommendations.

---

## Anti-Hallucination Strategy

Before generating insights:

1. Validate required fields exist:

   * Stage
   * Amount
   * Close Date

2. Load actual persisted deal state

3. Load historical activity

4. Refuse scoring when mandatory information is missing

Example:

"I cannot score this deal because required information is missing."

This prevents unsupported forecasts or fabricated recommendations.

---

## OpenAI Failure Handling

If OpenAI is unavailable:

* Timeout
* Network failure
* Quota exceeded
* API error

The system automatically falls back to the rule-based scoring engine and still returns a valid health assessment.

This ensures the application remains functional even when AI services are unavailable.

---

## Trade-offs & Assumptions

### Chosen Trade-offs

* MongoDB used instead of PostgreSQL for faster schema iteration.
* SSE chosen over WebSockets because communication is server-to-client only.
* Rule-based scoring used as the source of truth.
* OpenAI is used only for explanations, not score generation.

### Assumptions

* CRM systems may redeliver events.
* Duplicate event_ids should not mutate state.
* Deal state should always be recoverable from persisted data.
* AI explanations must never override calculated scores.

---

## What Was Cut

Due to time constraints:

* MEDDICC implementation
* Multi-agent orchestration
* Long-term memory layer
* Bull Board dashboard
* Dead-letter queue
* Docker Compose deployment

These would be the next improvements in a production implementation.

---

## How I Used AI

AI was used as a development assistant for:

* Architecture brainstorming
* TypeScript implementation guidance
* Queue-processing design review
* Prompt engineering
* Health-scoring validation logic

All design decisions, debugging, integration work, and final implementation were completed and verified manually.

---

## What I Learned About the AI Layer

The biggest lesson was that generating a score is easier than generating a trustworthy score.

A useful AI assistant must:

* Know when it lacks sufficient data
* Refuse unsupported conclusions
* Remain grounded in persisted business data
* Provide explanations rather than invent facts

The rule-based fallback architecture proved valuable because it allows the system to continue operating even when the LLM is unavailable.
