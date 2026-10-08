# Local setup

The supported local stack is PostgreSQL and Redis in Docker plus four
application processes: NestJS API, Next.js frontend, MT5 Node bridge, and the
Python MT5 bridge.

See the root [README](../README.md) for the complete setup sequence. Start
infrastructure before the API so Prisma and Redis can connect.
