#!/bin/bash
# Script to update Prisma schema for both local dev and Railway

echo "=== Updating Prisma Schema ==="
echo ""

# 1. Push schema changes to database
echo "Step 1: Pushing schema to database..."
npx prisma db push

# 2. Generate Prisma client
echo ""
echo "Step 2: Generating Prisma client..."
npx prisma generate

# 3. Reminder
echo ""
echo "✅ Schema updated successfully!"
echo ""
echo "⚠️  IMPORTANT: You must restart your backend server for changes to take effect!"
echo "   Press Ctrl+C in your terminal and run 'npm run dev' again"
echo ""


