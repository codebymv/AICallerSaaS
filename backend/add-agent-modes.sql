-- Add AgentMode enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "AgentMode" AS ENUM ('INBOUND', 'OUTBOUND', 'HYBRID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add mode column with default
ALTER TABLE "Agent" 
ADD COLUMN IF NOT EXISTS "mode" "AgentMode" NOT NULL DEFAULT 'INBOUND';

-- Add outbound-related columns
ALTER TABLE "Agent" 
ADD COLUMN IF NOT EXISTS "outboundGreeting" TEXT;

ALTER TABLE "Agent" 
ADD COLUMN IF NOT EXISTS "callTimeout" INTEGER NOT NULL DEFAULT 600;

ALTER TABLE "Agent" 
ADD COLUMN IF NOT EXISTS "retryAttempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Agent" 
ADD COLUMN IF NOT EXISTS "callWindowStart" TEXT;

ALTER TABLE "Agent" 
ADD COLUMN IF NOT EXISTS "callWindowEnd" TEXT;

-- Update existing agents to have INBOUND mode (if they don't already)
UPDATE "Agent" SET "mode" = 'INBOUND' WHERE "mode" IS NULL;
