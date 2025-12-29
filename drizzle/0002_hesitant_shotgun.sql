ALTER TYPE "public"."grading_strategy" ADD VALUE 'difficulty_based';--> statement-breakpoint
ALTER TYPE "public"."grading_strategy" ADD VALUE 'count_based';--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "strategy_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "strategy_type" SET DEFAULT 'random_3'::text;--> statement-breakpoint
DROP TYPE "public"."strategy_type";--> statement-breakpoint
CREATE TYPE "public"."strategy_type" AS ENUM('random_n', 'fixed_set', 'difficulty_mix');--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "strategy_type" SET DEFAULT 'random_3'::"public"."strategy_type";--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "strategy_type" SET DATA TYPE "public"."strategy_type" USING "strategy_type"::"public"."strategy_type";--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "grading_config" json;