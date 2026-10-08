export type AvatarStatus = "Active" | "Draft" | "Inactive";

export type AdminAvatar = {
  id: string;
  name: string;
  ageGroup: string;
  age: number;
  gender: string;
  voice: string;
  language: string;
  status: AvatarStatus;
  usage: number;
  conversations: number;
  updated: string;
  color: string;
  personality: string;
};

export const ageGroups = [
  { id: "child", name: "Child", range: "5–12 years", avatars: 8, active: 6, voice: "Sunny", color: "#f6b73c", genders: "4 girls · 4 boys" },
  { id: "teenager", name: "Teenager", range: "13–17 years", avatars: 10, active: 8, voice: "Nova", color: "#ef7b9f", genders: "5 girls · 5 boys" },
  { id: "young-adult", name: "Young Adult", range: "18–25 years", avatars: 12, active: 9, voice: "Lumen", color: "#7667f2", genders: "6 women · 6 men" },
  { id: "adult", name: "Adult", range: "26–40 years", avatars: 14, active: 11, voice: "Atlas", color: "#3bb89b", genders: "7 women · 7 men" },
  { id: "middle-age", name: "Middle Age", range: "41–60 years", avatars: 7, active: 5, voice: "Sage", color: "#e58154", genders: "4 women · 3 men" },
  { id: "senior", name: "Senior", range: "61+ years", avatars: 5, active: 4, voice: "Willow", color: "#5b9ee8", genders: "3 women · 2 men" },
];

export const avatars: AdminAvatar[] = [
  { id: "maya", name: "Maya Chen", ageGroup: "Young Adult", age: 24, gender: "Female", voice: "Lumen", language: "English (US)", status: "Active", usage: 2840, conversations: 612, updated: "2 hours ago", color: "#9b7cf3", personality: "Warm, curious, and encouraging" },
  { id: "leo", name: "Leo Martin", ageGroup: "Teenager", age: 16, gender: "Male", voice: "Nova", language: "English (UK)", status: "Active", usage: 1950, conversations: 438, updated: "Yesterday", color: "#56b7a4", personality: "Energetic, playful, and direct" },
  { id: "aria", name: "Aria Williams", ageGroup: "Adult", age: 32, gender: "Female", voice: "Sage", language: "English (US)", status: "Active", usage: 1680, conversations: 321, updated: "2 days ago", color: "#e59368", personality: "Professional, thoughtful, and concise" },
  { id: "noah", name: "Noah Patel", ageGroup: "Child", age: 10, gender: "Male", voice: "Sunny", language: "English (US)", status: "Draft", usage: 840, conversations: 126, updated: "3 days ago", color: "#edbb55", personality: "Friendly, patient, and imaginative" },
  { id: "elena", name: "Elena Rossi", ageGroup: "Middle Age", age: 48, gender: "Female", voice: "Willow", language: "Italian", status: "Active", usage: 1290, conversations: 287, updated: "4 days ago", color: "#d46d88", personality: "Wise, calm, and empathetic" },
  { id: "james", name: "James Brooks", ageGroup: "Senior", age: 68, gender: "Male", voice: "Atlas", language: "English (US)", status: "Inactive", usage: 540, conversations: 82, updated: "1 week ago", color: "#649de1", personality: "Patient, reassuring, and knowledgeable" },
];

export const navItems = [
  ["Overview", "/admin", "⌂"], ["Avatars", "/admin/avatars", "◉"], ["Age Groups", "/admin/age-groups", "◫"], ["Create Avatar", "/admin/avatars/create", "+"],
  ["Appearance", "/admin/appearance", "✦"], ["Voice & AI", "/admin/voice-ai", "◒"], ["Animations", "/admin/animations", "◌"], ["Knowledge", "/admin/knowledge", "▤"],
  ["Users", "/admin/users", "♙"], ["Analytics", "/admin/analytics", "⌁"], ["Settings", "/admin/settings", "⚙"],
] as const;
