import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/note")({
  component: Note,
  head: () => ({
    meta: [
      { title: "PLI — note" },
      {
        name: "description",
        content:
          "Lecture des tweets d’Aristide Benoist sur son moteur WebGPU natif, et sources de la démo PLI.",
      },
    ],
  }),
});

function Note() {
  return (
    <main className="note-root">
      <header className="note-bar">
        <Link to="/" className="mark">
          PLI
        </Link>
        <Link to="/">Démo</Link>
      </header>

      <article className="note-sheet">
        <p className="note-kicker">Note — pas son moteur</p>
        <h1>Ce que disent les tweets.</h1>
        <p className="note-lead">
          PLI lit une série de posts d’Aristide Benoist, de janvier à octobre 2026. Ce n’est pas une reprise de
          son code. En janvier il disait pouvoir ouvrir le dépôt une fois le moteur fini. Il ne l’est pas. Le
          zip en bas de page est le nôtre.
        </p>

        <section>
          <h2>31 janvier — la chaîne</h2>
          <blockquote>
            <p>
              Chaining global passes like blur, bloom, and pixelate, on top of a disturb pipeline with its own
              options: distortion, black and white, lighten, darken, noise, RGB split, and more. […] Planes can
              have optional shadows and rounded borders. Behind-the-scenes split view shows the raw pass vs
              final composite.
            </p>
            <footer>
              <a href="https://x.com/AristideBenoist/status/2017627985034326112" rel="noreferrer">
                @AristideBenoist, 31 janvier 2026
              </a>
            </footer>
          </blockquote>
          <p>
            API WebGPU JavaScript, sans dépendance, composants à lui. Le 1er février, à une question sur le coût
            de ces passes enchaînées, il répond seulement que tout n’est pas facile à expliquer ici.
          </p>
          <p>
            PLI reprend le vocabulaire : coins, ombre, distorsion, séparation, trame, flou, bloom, grain, et la
            vue coupée en deux. Ce n’est pas sa chaîne. Ici, un seul fragment shader fait tout. Le bloom, seuillé
            trop bas, allume le papier. L’ordre réel — trame, puis canaux — ne suit pas la liste écrite dans la
            démo. Le repli canvas n’a ni bloom ni grain.
          </p>
        </section>

        <section>
          <h2>5 février — le texte</h2>
          <blockquote>
            <p>
              My MTSDF generator is ready, built in Rust. […] Text now aligns perfectly between canvas and HTML,
              whatever the font used, with accurate position, letter spacing and line height.
            </p>
            <footer>
              <a href="https://x.com/AristideBenoist/status/2019400587088118052" rel="noreferrer">
                @AristideBenoist, 5 février 2026
              </a>
            </footer>
          </blockquote>
          <p>
            Glyphes instanciés, pas une bitmap de paragraphe. PLI rasterise Archivo dans un canvas, puis envoie
            l’image au GPU. C’est un choix : pas de générateur MTSDF. Limite connue — si la fonte arrive après le
            premier dessin, le cache ne s’invalide pas, et le texte reste dans la police de secours.
          </p>
        </section>

        <section>
          <h2>Septembre et octobre — le front entier</h2>
          <blockquote>
            <p>
              A WebGPU engine built from scratch around a layer-based system.
            </p>
            <footer>
              <a href="https://x.com/AristideBenoist/status/2105033187344658729" rel="noreferrer">
                @AristideBenoist, 29 septembre 2026
              </a>
            </footer>
          </blockquote>
          <blockquote>
            <p>Front fully rendered via native WebGPU, SEO friendly.</p>
            <footer>
              <a href="https://x.com/AristideBenoist/status/2111540505137885388" rel="noreferrer">
                @AristideBenoist, 17 octobre 2026
              </a>
            </footer>
          </blockquote>
          <p>
            Autour : un framework HTML en Rust, pour le statique et le rendu serveur. Le 18 octobre il précise
            l’ordre réel du travail — apprendre Rust, le templating, le déploiement, les CMS, les formulaires —
            et la couche WebGPU seulement ensuite. Des mois, dit-il, ce n’est pas trop long.
          </p>
          <p>
            Sous le post du 17 octobre, la question utile est celle du DOM parallèle : recherche, sélection,
            clavier, lecteurs d’écran. PLI répond petit. Un article masqué visuellement reprend la copie, et la
            barre, le rack, cette note restent en HTML. Ils ne passent pas dans la chaîne. La phrase de la démo,
            « Le front entier, composé sur le GPU », est donc trop forte. Le texte des pages, oui. Le chrome,
            non.
          </p>
        </section>

        <section>
          <h2>Ce que la démo montre quand même</h2>
          <p>
            Trois pages. Des photos qui sont des rectangles, pas des meshes. Un clic isole un plan. Les curseurs
            écrivent les uniformes de la dernière passe. WebGPU si le navigateur l’a, canvas sinon.
          </p>
          <p>
            Le fichier joint les sources de cette démo et le brief de revue. Il est là pour qu’un autre modèle
            cherche les angles — la fidélité de la chaîne d’un côté, l’envoi des images et les tests de
            placement de l’autre. Ce n’est pas une invitation à réécrire l’app.
          </p>
        </section>

        <div className="note-dl">
          <div>
            <p className="note-kicker">Sources</p>
            <p>pli-pour-claude.zip — démo, photos, brief. 2,9 Mo.</p>
          </div>
          <a href="/pli-pour-claude.zip" download="pli-pour-claude.zip">
            Télécharger
          </a>
        </div>
      </article>
    </main>
  );
}
