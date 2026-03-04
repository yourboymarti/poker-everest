export const PLAYER_AVATARS = [
    "👽", "🤖", "👨‍🚀", "👾", "🛸", "👻", "🧟", "🧛",
    "🧙", "🐉", "🦄", "👺", "👹", "🐲", "🦍", "🐺",
    "🦊", "🦅", "🦉", "🦈", "🦖", "🐙", "🐅", "🦁",
];

export function pickRandomAvatar(excluded: string[] = []): string {
    const excludedSet = new Set(excluded);
    const available = PLAYER_AVATARS.filter((avatar) => !excludedSet.has(avatar));
    const pool = available.length > 0 ? available : PLAYER_AVATARS;
    return pool[Math.floor(Math.random() * pool.length)] || "🧗";
}
