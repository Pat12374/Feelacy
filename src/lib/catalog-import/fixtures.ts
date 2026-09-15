import { zipSync, strToU8 } from "fflate";
export const accessory = {
  title: "Cork display box",
  description: "Oak display box for keeping used wine corks.",
  category: "wine-accessories",
  price: "25.50",
  currency: "EUR",
  quantity: "4",
  accessoryType: "Display box",
  brand: "Seller brand",
  materials: "Oak",
  dimensions: "20x20x10cm",
  compatibility: "Wine corks",
  safetyInformation: "Keep away from fire",
  warranty: "Two years",
  returnsRules: "Contact seller within 14 days",
};
export function workbook(formula = false) {
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "xl/workbook.xml": strToU8("<workbook/>"),
    "xl/worksheets/sheet1.xml": strToU8(
      `<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>title</t></is></c><c r="B1" t="inlineStr"><is><t>price</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>Product</t></is></c><c r="B2">${formula ? "<f>1+1</f>" : ""}<v>25</v></c></row></sheetData></worksheet>`,
    ),
  });
}
