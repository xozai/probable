export interface LineItemRowInput {
  description: string;
  quantity: string;
  unit: string;
  unitPrice?: string | null;
  sectionId?: string | null;
}
