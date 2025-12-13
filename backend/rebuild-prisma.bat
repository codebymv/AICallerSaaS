@echo off
echo === Rebuilding Prisma Client ===
echo.
echo Step 1: Stopping any running servers...
echo Please press Ctrl+C in your npm run dev terminal if it's still running!
echo.
pause

echo.
echo Step 2: Deleting old Prisma client...
if exist "node_modules\.prisma" (
    rmdir /s /q "node_modules\.prisma"
    echo ✓ Deleted node_modules\.prisma
) else (
    echo ✓ No .prisma folder found
)

if exist "node_modules\@prisma\client" (
    rmdir /s /q "node_modules\@prisma\client"
    echo ✓ Deleted node_modules\@prisma\client
) else (
    echo ✓ No @prisma\client folder found
)

echo.
echo Step 3: Pushing schema to Railway database...
call npx prisma db push --accept-data-loss

echo.
echo Step 4: Generating new Prisma client...
call npx prisma generate

echo.
echo ✅ Prisma client rebuilt successfully!
echo.
echo Now restart your server with: npm run dev
echo.
pause


