#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Seeding database (creates admin user if not exists)..."
node prisma/seed.js

echo "Starting server..."
exec node src/index.js
