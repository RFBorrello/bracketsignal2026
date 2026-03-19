import { SiteShell } from "@/components/site-shell";

export default function MethodologyPage() {
  return (
    <SiteShell eyebrow="Methodology" title="What the site knows, and what it refuses to fake.">
      <section className="detail-grid">
        <article className="panel stack-md">
          <p className="panel__kicker">Quantitative layer</p>
          <h2>Pregame features only.</h2>
          <p className="muted">
            The ETL uses seeds, detailed regular-season box-score data, tournament results, and ranking history to
            build a pregame snapshot for each tournament matchup. Favorite win probability, upset likelihood, and
            volatility are all derived from pregame-only inputs.
          </p>
        </article>
        <article className="panel stack-md">
          <p className="panel__kicker">Qualitative layer</p>
          <h2>Structured notes with confidence labels.</h2>
          <p className="muted">
            Qualitative context is stored as editorial notes with provenance and confidence. When the data cannot prove
            a claim, the app keeps it in that lane instead of pretending it belongs in the numeric model.
          </p>
        </article>
      </section>

      <section className="panel stack-md">
        <p className="panel__kicker">Current limitations</p>
        <table className="table">
          <thead>
            <tr>
              <th>Area</th>
              <th>v1 status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Historical corpus</td>
              <td>
                App-side schemas stay forward-compatible with richer analysis fields while the full public corpus is
                rebuilt from Kaggle raw files.
              </td>
            </tr>
            <tr>
              <td>2026 field</td>
              <td>
                Every Round of 64 matchup now runs through the same analysis frame as the historical pages, using the
                live bracket field plus historical seed-line, analog, record, and conference context.
              </td>
            </tr>
            <tr>
              <td>Persistence</td>
              <td>Browser-only, no accounts or cross-device sync.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </SiteShell>
  );
}
