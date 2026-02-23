# Backend API - Trading Platform

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Variables**
    Copy `.env` and configure:
    ```bash
    cp .env.example .env
    ```
    Ensure `DATABASE_URL` points to your PostgreSQL instance.

3.  **Database Setup**
    Ensure PostgreSQL is running.
    ```bash
    npx prisma generate
    # If you have a running DB and want to push schema:
    # npx prisma db push
    ```

## Running the App

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

## API Documentation

Swagger UI is available at: http://localhost:3000/api

## Modules

-   **Auth**: Login, Register, JWT (Access + Refresh Tokens)
-   **Users**: Profile management
-   **Backtesting**: Create and manage backtesting sessions
-   **Trades**: Trade journaling and management
-   **Analytics**: Performance metrics (Win rate, PnL)
-   **Market Data**: Integration with historical data
