CREATE TABLE "history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "history_user_category_idx" ON "history"("user_id", "category");
CREATE INDEX "history_created_at_idx" ON "history"("created_at" DESC);
