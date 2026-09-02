import { WineListPage } from "@/components/wine-list-page";import { whiteWines } from "@/lib/wine-categories";
export const metadata={title:"White Wines"};export default function WhiteWinesPage(){return <WineListPage eyebrow="Wines · White" title="White Wines" description="Browse white grape varieties, regions, and classic styles offered by independent sellers." wines={whiteWines} tone="white"/>}
