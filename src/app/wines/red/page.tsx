import { WineListPage } from "@/components/wine-list-page";import { redWines } from "@/lib/wine-categories";
export const metadata={title:"Red Wines"};export default function RedWinesPage(){return <WineListPage eyebrow="Wines · Red" title="Red Wines" description="Browse red grape varieties, regions, and classic styles offered by independent sellers." wines={redWines} tone="red"/>}
