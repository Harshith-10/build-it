ALTER TYPE "public"."strategy_type" ADD VALUE 'random_n' BEFORE 'fixed_set';--> statement-breakpoint
CREATE TABLE "collection_questions" (
	"collection_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_questions_collection_id_question_id_pk" PRIMARY KEY("collection_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "exam_collections" (
	"exam_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exam_collections_exam_id_collection_id_pk" PRIMARY KEY("exam_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "question_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"tags" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_questions" ADD CONSTRAINT "collection_questions_collection_id_question_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."question_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_questions" ADD CONSTRAINT "collection_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_collections" ADD CONSTRAINT "exam_collections_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_collections" ADD CONSTRAINT "exam_collections_collection_id_question_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."question_collections"("id") ON DELETE cascade ON UPDATE no action;