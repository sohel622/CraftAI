// Every language / framework CraftAI supports, with short rules the AI must follow.
// To add a new stack: add one entry here. Nothing else needs to change.
export const STACKS = {
  // ---- Web frontend
  html: { label: 'HTML / CSS / JavaScript', group: 'web', exts: ['.html', '.css', '.js'], rules: 'Plain HTML5, modern CSS and vanilla ES2022 JavaScript. Mobile-first and responsive.' },
  typescript: { label: 'TypeScript', group: 'web', exts: ['.ts', '.tsx'], rules: 'Strict TypeScript. Explicit types on public functions. No `any` unless unavoidable.' },
  react: { label: 'React (Vite)', group: 'web', exts: ['.jsx', '.tsx', '.css'], rules: 'React 18+ function components and hooks, Vite project layout (index.html, src/main, src/App).' },
  vue: { label: 'Vue 3 (Vite)', group: 'web', exts: ['.vue', '.js', '.ts'], rules: 'Vue 3 Composition API with <script setup>. Vite project layout.' },
  nextjs: { label: 'Next.js', group: 'web', exts: ['.tsx', '.ts', '.js'], rules: 'Next.js App Router (app/ directory), server components by default, "use client" only when needed.' },
  tailwind: { label: 'Tailwind CSS', group: 'web', exts: ['.css', '.html', '.jsx', '.tsx'], rules: 'Use Tailwind utility classes. Include tailwind config when creating a new project.' },

  // ---- Backend
  node: { label: 'Node.js', group: 'backend', exts: ['.js', '.mjs', '.ts'], rules: 'Node 18+ ESM. Express for HTTP unless the user asks otherwise. Read secrets from process.env only.' },
  python: { label: 'Python', group: 'backend', exts: ['.py'], rules: 'Python 3.11+. FastAPI for HTTP APIs unless asked otherwise. Include requirements.txt. Read secrets from os.environ.' },
  php: { label: 'PHP', group: 'backend', exts: ['.php'], rules: 'PHP 8.2+, PSR-12 style, prepared statements for all SQL. Read secrets from getenv().' },

  // ---- Database
  supabase_sql: { label: 'SQL (Supabase / Postgres)', group: 'database', exts: ['.sql'], rules: 'Postgres SQL for Supabase. Idempotent (IF NOT EXISTS / CREATE OR REPLACE). Always enable RLS and add policies using auth.uid(). Add tables to supabase_realtime publication when realtime is requested.' },

  // ---- Systems / mobile / desktop / games
  java: { label: 'Java', group: 'systems', exts: ['.java'], rules: 'Java 17+. Gradle build file when creating a project.' },
  kotlin: { label: 'Kotlin (Android)', group: 'mobile', exts: ['.kt', '.kts'], rules: 'Kotlin with Jetpack Compose for Android UI. Gradle Kotlin DSL.' },
  flutter: { label: 'Dart / Flutter', group: 'mobile', exts: ['.dart', '.yaml'], rules: 'Flutter 3 with null safety. pubspec.yaml + lib/main.dart layout.' },
  c: { label: 'C', group: 'systems', exts: ['.c', '.h'], rules: 'C17. Check every allocation and return value. Include a Makefile.' },
  cpp: { label: 'C++', group: 'systems', exts: ['.cpp', '.hpp', '.h'], rules: 'C++17 or newer, RAII, no raw new/delete. Include CMakeLists.txt for new projects.' },
  csharp: { label: 'C#', group: 'systems', exts: ['.cs', '.csproj'], rules: 'C# 12 / .NET 8. Nullable enabled.' },
  go: { label: 'Go', group: 'systems', exts: ['.go', '.mod'], rules: 'Go 1.22+, go.mod, idiomatic error handling.' },
  rust: { label: 'Rust', group: 'systems', exts: ['.rs', '.toml'], rules: 'Rust 2021 edition, Cargo.toml, no unwrap() in library code.' },
  swift: { label: 'Swift (iOS)', group: 'mobile', exts: ['.swift'], rules: 'Swift 5.9+, SwiftUI for UI.' },
  gdscript: { label: 'GDScript (Godot 4)', group: 'game', exts: ['.gd', '.tscn', '.godot'], rules: 'Godot 4.x GDScript 2.0 syntax (typed vars, @export, @onready). Scene files in text .tscn format. project.godot for new projects.' },
};

export const STACK_IDS = Object.keys(STACKS);

export function stackRules(ids) {
  return ids
    .map((id) => STACKS[id])
    .filter(Boolean)
    .map((s) => `- ${s.label}: ${s.rules}`)
    .join('\n');
}
