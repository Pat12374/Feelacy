import { notFound } from "next/navigation";
import { CATEGORY_GROUPS } from "@/lib/category-groups";
import { CategoryLanding } from "@/components/category-landing";
export async function generateMetadata({params}:{params:Promise<{category:string}>}){const data=CATEGORY_GROUPS[(await params).category];return {title:data?.title??"Category"}}
export default async function CategoryPage({params}:{params:Promise<{category:string}>}){const {category}=await params;const data=CATEGORY_GROUPS[category];if(!data)notFound();return <CategoryLanding slug={category} {...data}/>}
