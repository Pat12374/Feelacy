import { describe,expect,it } from "vitest";
import { parseAssistantSearchFilters } from "./orchestrator";
describe("marketplace assistant search interpretation",()=>{it("turns conversational spirit searches into safe filters",()=>{expect(parseAssistantSearchFilters("Find a collectible Scotch under $500 for a retirement gift")).toMatchObject({category:"spirits",maxCents:50000});});it("extracts wine vintage without inventing availability",()=>{expect(parseAssistantSearchFilters("Show me a 2018 Riesling wine")).toMatchObject({category:"wine",vintage:2018});});});
