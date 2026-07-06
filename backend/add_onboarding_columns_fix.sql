-- Add onboarding columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS selected_avatar VARCHAR(50),
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(has_completed_onboarding);

-- Update existing users to have default values
UPDATE users 
SET has_completed_onboarding = FALSE 
WHERE has_completed_onboarding IS NULL;
