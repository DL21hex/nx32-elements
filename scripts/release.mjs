// Publica una versión: empuja `main` a GitHub y le pone su etiqueta `vX.Y.Z` (la de package.json).
//
// La etiqueta es lo que hace oficial una versión. Las apps no instalan lo que haya en una carpeta de
// trabajo: traen la etiqueta desde GitHub y la compilan ahí (en nx32, `./nx elements X.Y.Z`), y su
// auditoría comprueba que el paquete viene de esa etiqueta y que está en `main`. Una etiqueta no se
// repite: si `vX.Y.Z` ya existe en otro commit, esta versión no sale (dos sesiones con «su» 0.12.2
// era justo el problema).
//
//   npm run release                 # con el hook pre-push (npm run check)
//   npm run release -- --no-verify  # sin él
//
// Se corre en `main`, con todo en commit y la entrada de la versión en CHANGELOG.md. Si `main` ya
// estaba en GitHub, solo pone la etiqueta. La etiqueta se empuja sin el hook: es el mismo commit que
// acaba de pasar (o saltar) la verificación.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const noVerify = process.argv.includes("--no-verify");
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const run = (...a) => execFileSync("git", a, { stdio: "inherit" });
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const commitOf = (lsRemote) => {
  // Una etiqueta anotada sale dos veces: la etiqueta y, con «^{}», el commit al que apunta.
  const lines = lsRemote.split("\n").filter(Boolean).map((l) => l.split("\t"));
  return (lines.find(([, ref]) => ref.endsWith("^{}")) ?? lines[0])?.[0] ?? null;
};

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`la versión de package.json («${version}») no es X.Y.Z`);
if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") fail("una versión se publica desde main");
if (git("status", "--porcelain", "--untracked-files=no")) fail("hay cambios sin commit");
if (!readFileSync("CHANGELOG.md", "utf8").includes(`\n## ${version} `)) fail(`CHANGELOG.md no tiene la entrada «## ${version} — …»`);

git("fetch", "--quiet", "origin", "main");
const head = git("rev-parse", "HEAD");
try {
  git("merge-base", "--is-ancestor", "origin/main", "HEAD");
} catch {
  fail("GitHub tiene commits en main que aquí no están: tráelos (y revisa la versión) antes de publicar");
}

const remote = commitOf(git("ls-remote", "--tags", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`));
if (remote && remote !== head) fail(`${tag} ya existe en GitHub en otro commit (${remote.slice(0, 7)}): sube la versión en package.json`);
let local = null;
try {
  local = git("rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`);
} catch {}
if (local && local !== head) fail(`${tag} ya existe aquí en otro commit (${local.slice(0, 7)})`);

if (git("rev-parse", "origin/main") !== head) run("push", ...(noVerify ? ["--no-verify"] : []), "origin", "HEAD:main");
if (!local) git("tag", "-a", tag, "-m", `nx32-elements ${version}`);
if (!remote) run("push", "--no-verify", "origin", `refs/tags/${tag}`);
console.log(`✓ ${tag} publicada (${head.slice(0, 7)})`);
