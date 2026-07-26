import { TournamentMatch, TournamentTeam } from '../types';

export interface BracketRoundPreview {
  name: string;
  matches: TournamentMatch[];
}

const roundName = (teamSlots: number, roundIndex: number): string => {
  const remaining = teamSlots / (2 ** roundIndex);
  if (remaining === 2) return 'Finals';
  if (remaining === 4) return 'Semifinals';
  if (remaining === 8) return 'Quarterfinals';
  return `Round ${roundIndex + 1}`;
};

/** Pure deterministic preview. Teams are seeded by stable ID so every admin sees the same bracket. */
export const previewSingleEliminationBracket = (
  tournamentId: string,
  teams: TournamentTeam[]
): BracketRoundPreview[] => {
  const seededTeams = [...teams]
    .filter((team) => team.status === 'Approved' || team.status === 'Paid')
    .sort((left, right) => left.id.localeCompare(right.id));
  if (seededTeams.length < 2) return [];

  const slotCount = 2 ** Math.ceil(Math.log2(seededTeams.length));
  const slots: Array<TournamentTeam | null> = [
    ...seededTeams,
    ...Array.from({ length: slotCount - seededTeams.length }, () => null),
  ];
  const rounds: BracketRoundPreview[] = [];
  let nextMatchNumber = 1;

  for (let roundIndex = 0, matchesInRound = slotCount / 2; matchesInRound >= 1; roundIndex += 1, matchesInRound /= 2) {
    const name = roundName(slotCount, roundIndex);
    const matches: TournamentMatch[] = [];
    const nextRoundStart = nextMatchNumber + matchesInRound;
    for (let slot = 0; slot < matchesInRound; slot += 1) {
      const teamA = roundIndex === 0 ? slots[slot * 2] : null;
      const teamB = roundIndex === 0 ? slots[slot * 2 + 1] : null;
      matches.push({
        id: `preview-${roundIndex}-${slot}`,
        tournamentId,
        round: name,
        matchNumber: nextMatchNumber,
        teamAId: teamA?.id || '',
        teamAName: teamA?.name || (roundIndex === 0 ? 'BYE' : 'TBD'),
        teamBId: teamB?.id || '',
        teamBName: teamB?.name || (roundIndex === 0 ? 'BYE' : 'TBD'),
        bracketSlot: slot,
        nextMatchNumber: matchesInRound > 1
          ? nextRoundStart + Math.floor(slot / 2)
          : undefined,
        status: 'Scheduled',
      });
      nextMatchNumber += 1;
    }
    rounds.push({ name, matches });
  }
  return rounds;
};
