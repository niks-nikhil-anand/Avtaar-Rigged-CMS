import { AvatarDetail } from "@/components/admin/AdminPages";
export default async function AvatarDetailPage({ params }: { params: Promise<{ avatarId: string }> }) { const { avatarId } = await params; return <AvatarDetail id={avatarId} />; }
