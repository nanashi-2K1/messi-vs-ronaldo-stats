import { describe, expect, it } from 'vitest';
import { baseline } from '../shared/baseline.ts';
import { GOAL_ZONES, PLAYER_IDS } from '../shared/types.ts';

describe('cohérence des données de référence', () => {
  for (const id of PLAYER_IDS) {
    const p = baseline.players[id];

    describe(p.name, () => {
      it('la somme des équipes donne les totaux de carrière', () => {
        expect(p.teams.reduce((s, t) => s + t.apps, 0)).toBe(p.totals.apps);
        expect(p.teams.reduce((s, t) => s + t.goals, 0)).toBe(p.totals.goals);
      });

      it('la somme des saisons donne le total de chaque club', () => {
        for (const team of p.teams.filter((t) => t.kind === 'club')) {
          const seasons = p.seasons.filter((s) => s.teamKey === team.key);
          expect(seasons.length, team.name).toBeGreaterThan(0);
          expect(seasons.reduce((s, x) => s + x.apps, 0), team.name).toBe(team.apps);
          expect(seasons.reduce((s, x) => s + x.goals, 0), team.name).toBe(team.goals);
        }
      });

      it('chaque saison est rattachée à une équipe connue', () => {
        for (const s of p.seasons) expect(p.teams.some((t) => t.key === s.teamKey), s.season).toBe(true);
      });

      it('la répartition par zone couvre tous les buts', () => {
        expect(GOAL_ZONES.reduce((s, z) => s + p.zones.parts[z], 0)).toBe(p.totals.goals);
      });

      it('les deux joueurs ont le même palmarès et les mêmes compétitions (pour la comparaison)', () => {
        const other = baseline.players[id === 'messi' ? 'ronaldo' : 'messi'];
        expect(p.honours.map((h) => h.label)).toEqual(other.honours.map((h) => h.label));
        expect(p.competitions.map((c) => c.label)).toEqual(other.competitions.map((c) => c.label));
      });
    });
  }
});
