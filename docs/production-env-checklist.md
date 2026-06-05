# Production Environment Checklist

This checklist is for verifying the production runtime uses the intended Postgres provider and the expected campaign integrations.

## Postgres runtime

These variables must all point to the current Supabase Postgres project and must not reference any legacy Neon host:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_PRISMA_URL`

Expected characteristics:

- pooled URLs use `aws-1-us-east-1.pooler.supabase.com:6543`
- non-pooled URLs use `aws-1-us-east-1.pooler.supabase.com:5432`
- database/user pair matches the active Supabase project
- no value contains `neon.tech`

## Admin auth

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SECURITY_HASH_SECRET`

## Public Firebase counter

- `PUBLIC_FIREBASE_API_KEY`
- `PUBLIC_FIREBASE_PROJECT_ID`
- `PUBLIC_FIREBASE_COUNTER_COLLECTION`
- `PUBLIC_FIREBASE_COUNTER_DOC`

## Server-side Firebase fallback

- `FIREBASE_SERVICE_ACCOUNT_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL`
- `FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY`

## Blob storage

- `BLOB_READ_WRITE_TOKEN`

## Optional payments

- `FLOW_API_KEY`
- `FLOW_SECRET_KEY`
- `FLOW_API_URL`

## Cache / ISR

- `ISR_BYPASS_TOKEN`
