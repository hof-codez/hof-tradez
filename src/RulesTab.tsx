// How the calculator works, in plain words. Numbers that can change come from the league settings.
export default function RulesTab({ maxPerDay, fullWeight, starPremium }: { maxPerDay: number; fullWeight: number; starPremium: number }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
  return (
    <div className="screen">
      <Section title="Where values come from">
        <div className="meta">Every player and pick has a value from 0 to 10,000. Values are built from how owners in this league vote, not from outside rankings. Each vote nudges the ratings, and the new numbers publish together so they do not jump around while you trade.</div>
        <div className="meta">Stars count for extra. A star is worth more than the sum of two lesser players (star premium {starPremium}).</div>
      </Section>
      <Section title="Voting">
        <div className="meta">You can cast {maxPerDay} votes a day. Your first {fullWeight} votes each day count in full. Later ones count for less, so a long session does not drown out everyone else.</div>
        <div className="meta">You rank three players (keep, trade, cut) or judge a trade (accept, even, decline). You cannot rank your own players or vote on trades you were part of. Nobody sees how you voted, only totals.</div>
        <div className="meta">After enough votes you get a profile of your tendencies. Other owners see your traits, never your votes.</div>
      </Section>
      <Section title="Draft picks">
        <div className="meta">Picks belong to whoever holds them in Sleeper, including traded picks. A pick is worth more when its original team has a worse record, since that team is likelier to pick early. Early in the season the record counts for less. Next year's picks lean on the record less than this year's.</div>
      </Section>
      <Section title="Trade tab">
        <div className="meta">Pick a partner and add players and picks to each side. The total uses the star premium, so one star can outweigh several mid players.</div>
        <div className="meta strong pad-top">Fit for the lineup</div>
        <div className="meta">Shows how your best starting lineup changes with the trade, using points per game, injuries and bye weeks. Lineups are QB, 2 RB, 3 WR, TE and 2 FLEX. Kickers and defenses are not part of this league.</div>
        <div className="meta strong pad-top">Fit for the future</div>
        <div className="meta">Projects each player forward one to three seasons using age and position. Players scoring above what their targets and carries support are marked down. The card shows a likely range and the chance the trade leaves you ahead.</div>
        <div className="meta">The chance depends on your situation. Contenders weigh next season most, rebuilders weigh the third season most. It starts from your league rank and you can change it with the buttons. It does not know about injuries or role changes.</div>
      </Section>
      <Section title="History">
        <div className="meta">Past league trades with how owners voted. "Why would they do this?" rebuilds both rosters just before the trade and lists reasons each side might have had, such as holes in the lineup, bye weeks, age and injuries. Those are guesses, not facts.</div>
      </Section>
      <Section title="Owners">
        <div className="meta">Each owner's roster and the traits their votes show. Use it to find who might want what you have.</div>
      </Section>
      <Section title="Good to know">
        <div className="meta">Rosters, records and player stats refresh once a day. If something looks stale, close and reopen the app.</div>
      </Section>
    </div>
  );
}
