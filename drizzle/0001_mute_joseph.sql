CREATE TABLE "firm_section_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort" integer NOT NULL,
	CONSTRAINT "firm_section_templates_firm_sort_unique" UNIQUE("firm_id","sort")
);
--> statement-breakpoint
ALTER TABLE "firm_section_templates" ADD CONSTRAINT "firm_section_templates_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "firm_section_templates" ("firm_id", "name", "sort")
SELECT "firms"."id", "defaults"."name", "defaults"."sort"
FROM "firms"
CROSS JOIN (
	VALUES
		('Earthwork', 0),
		('Paving', 1),
		('Storm', 2),
		('Water', 3),
		('Sanitary', 4),
		('Misc', 5)
) AS "defaults" ("name", "sort");
