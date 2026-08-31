ALTER TABLE "line_items" DROP CONSTRAINT "line_items_cost_item_id_cost_items_id_fk";
--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;