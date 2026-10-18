import type { Baseline, Source } from './types.ts';

/*
 * Données de référence : totaux de carrière (matchs officiels, club + sélection,
 * hors amicaux de club) relevés le 18 octobre 2026 sur messivsronaldo.app, après
 * le doublé de Messi à Atlanta (17/10). Tout match joué ensuite est ajouté
 * automatiquement par le suivi en direct (voir server/tracker.ts).
 *
 * Une seule source pour les totaux, les zones, le pied/la tête et les saisons :
 * les chiffres sont cohérents entre eux (sommes vérifiées par les tests). Les
 * passes décisives varient selon les sites (méthode Opta ou Transfermarkt).
 */

const MVR = 'https://www.messivsronaldo.app';
const SRC = {
  mvr: { label: 'messivsronaldo.app — totaux, minutes, triplés, zones, pied/tête', url: `${MVR}/` },
  mvrSeasons: { label: 'messivsronaldo.app — saisons en club', url: `${MVR}/club-stats/` },
  mvrPens: { label: 'messivsronaldo.app — penalties (hors séances de tirs au but)', url: `${MVR}/detailed-stats/penalties/` },
  mvrFreeKicks: { label: 'messivsronaldo.app — coups francs et taux de réussite', url: `${MVR}/detailed-stats/free-kicks/` },
  mvrShots: { label: 'messivsronaldo.app — conversion des tirs', url: `${MVR}/detailed-stats/shot-conversion/` },
  uefaIntl: {
    label: 'UEFA — records internationaux (146 buts / 234 sélections ; Messi 126 / 208)',
    url: 'https://www.uefa.com/european-qualifiers/news/026a-1297500e1b34-a17bbbcad258-1000--cristiano-ronaldo-all-time-leading-scorer-in-men-s-interna/',
  },
  wc2026: {
    label: 'Goal — bilan de la Coupe du monde 2026',
    url: 'https://www.goal.com/en/lists/winners-losers-2026-world-cup-lionel-messi-kylian-mbappe-spain-cristiano-ronaldo-neymar-christian-pulisic/blt7aa010d528ddf937',
  },
} satisfies Record<string, Source>;

export const baseline: Baseline = {
  asOf: '2026-10-18T10:00:00Z',
  sources: Object.values(SRC),
  players: {
    messi: {
      id: 'messi',
      name: 'Lionel Messi',
      fullName: 'Lionel Andrés Messi Cuccittini',
      birthDate: '1987-06-24',
      birthPlace: 'Rosario, Argentine',
      nationality: 'Argentine',
      position: 'Attaquant / meneur de jeu',
      preferredFoot: 'gauche',
      heightCm: 170,
      currentClub: 'Inter Miami CF',
      totals: { apps: 1181, goals: 936, assists: 427, minutes: 97197 },
      hatTricks: { count: 62, approximate: false, source: SRC.mvr },
      teams: [
        { key: 'barcelona', name: 'FC Barcelone', kind: 'club', from: '2004', to: '2021', apps: 778, goals: 672 },
        { key: 'psg', name: 'Paris Saint-Germain', kind: 'club', from: '2021', to: '2023', apps: 75, goals: 32 },
        { key: 'inter-miami', name: 'Inter Miami CF', kind: 'club', from: '2023', to: null, apps: 120, goals: 106 },
        { key: 'argentina', name: 'Argentine', kind: 'national', from: '2005', to: '2026', apps: 208, goals: 126 },
      ],
      seasons: [
        { season: '2004/05', teamKey: 'barcelona', apps: 9, goals: 1 },
        { season: '2005/06', teamKey: 'barcelona', apps: 25, goals: 8 },
        { season: '2006/07', teamKey: 'barcelona', apps: 36, goals: 17 },
        { season: '2007/08', teamKey: 'barcelona', apps: 40, goals: 16 },
        { season: '2008/09', teamKey: 'barcelona', apps: 51, goals: 38 },
        { season: '2009/10', teamKey: 'barcelona', apps: 53, goals: 47 },
        { season: '2010/11', teamKey: 'barcelona', apps: 55, goals: 53 },
        { season: '2011/12', teamKey: 'barcelona', apps: 60, goals: 73 },
        { season: '2012/13', teamKey: 'barcelona', apps: 50, goals: 60 },
        { season: '2013/14', teamKey: 'barcelona', apps: 46, goals: 41 },
        { season: '2014/15', teamKey: 'barcelona', apps: 57, goals: 58 },
        { season: '2015/16', teamKey: 'barcelona', apps: 49, goals: 41 },
        { season: '2016/17', teamKey: 'barcelona', apps: 52, goals: 54 },
        { season: '2017/18', teamKey: 'barcelona', apps: 54, goals: 45 },
        { season: '2018/19', teamKey: 'barcelona', apps: 50, goals: 51 },
        { season: '2019/20', teamKey: 'barcelona', apps: 44, goals: 31 },
        { season: '2020/21', teamKey: 'barcelona', apps: 47, goals: 38 },
        { season: '2021/22', teamKey: 'psg', apps: 34, goals: 11 },
        { season: '2022/23', teamKey: 'psg', apps: 41, goals: 21 },
        { season: '2023', teamKey: 'inter-miami', apps: 14, goals: 11 },
        { season: '2024', teamKey: 'inter-miami', apps: 25, goals: 23 },
        { season: '2025', teamKey: 'inter-miami', apps: 49, goals: 43 },
        { season: '2026', teamKey: 'inter-miami', apps: 32, goals: 29 },
      ],
      zones: {
        asOf: '2026-10-18',
        parts: { penalty: 115, freeKick: 76, outsideBox: 109, insideBox: 636 },
        source: SRC.mvr,
        note: 'Hors surface : frappes dans le jeu, coups francs directs exclus. Surface : hors penalties.',
      },
      bodyParts: {
        asOf: '2026-10-18',
        parts: { left: 787, right: 113, head: 32, other: 4 },
        source: SRC.mvr,
      },
      conversion: {
        penalty: { scored: 115, attempts: 150, scope: 'carrière, hors tirs au but', source: SRC.mvrPens },
        freeKick: { scored: 50, attempts: 538, scope: 'coups francs directs en championnat', source: SRC.mvrFreeKicks },
        allShots: { scored: 576, attempts: 3139, scope: 'championnat + Ligue des champions depuis 2009/10', source: SRC.mvrShots },
      },
      competitions: [
        { label: 'Ligue des champions', goals: 129, apps: 163 },
        { label: 'Coupe du monde', goals: 21, assists: 12 },
        { label: 'Copa América / Euro', goals: 14 },
        { label: 'Liga (Espagne)', goals: 474, apps: 520 },
      ],
      honours: [
        { id: 'ballon', label: 'Ballon d’Or', items: ['2009', '2010', '2011', '2012', '2015', '2019', '2021', '2023'] },
        { id: 'wc', label: 'Coupe du monde', items: ['2022'] },
        { id: 'cont', label: 'Titre continental en sélection', items: ['Copa América 2021', 'Copa América 2024'] },
        { id: 'ucl', label: 'Ligue des champions', items: ['2006', '2009', '2011', '2015'] },
        {
          id: 'league',
          label: 'Championnats nationaux',
          items: [
            'Liga 2005', 'Liga 2006', 'Liga 2009', 'Liga 2010', 'Liga 2011', 'Liga 2013', 'Liga 2015', 'Liga 2016', 'Liga 2018',
            'Liga 2019', 'Ligue 1 2022', 'Ligue 1 2023', 'MLS Cup 2025',
          ],
        },
        { id: 'cwc', label: 'Coupe du monde des clubs', items: ['2009', '2011', '2015'] },
        { id: 'boot', label: 'Soulier d’or européen', items: ['2010', '2012', '2013', '2017', '2018', '2019'] },
        { id: 'olym', label: 'Or olympique', items: ['Pékin 2008'] },
      ],
    },
    ronaldo: {
      id: 'ronaldo',
      name: 'Cristiano Ronaldo',
      fullName: 'Cristiano Ronaldo dos Santos Aveiro',
      birthDate: '1985-02-05',
      birthPlace: 'Funchal, Portugal',
      nationality: 'Portugaise',
      position: 'Attaquant',
      preferredFoot: 'droit',
      heightCm: 187,
      currentClub: 'Al Nassr',
      totals: { apps: 1340, goals: 981, assists: 261, minutes: 109542 },
      hatTricks: { count: 66, approximate: false, source: SRC.mvr },
      teams: [
        { key: 'sporting', name: 'Sporting CP', kind: 'club', from: '2002', to: '2003', apps: 31, goals: 5 },
        { key: 'man-utd', name: 'Manchester United', kind: 'club', from: '2003', to: '2022', apps: 346, goals: 145 },
        { key: 'real-madrid', name: 'Real Madrid', kind: 'club', from: '2009', to: '2018', apps: 438, goals: 450 },
        { key: 'juventus', name: 'Juventus', kind: 'club', from: '2018', to: '2021', apps: 134, goals: 101 },
        { key: 'al-nassr', name: 'Al Nassr', kind: 'club', from: '2023', to: null, apps: 157, goals: 134 },
        { key: 'portugal', name: 'Portugal', kind: 'national', from: '2003', to: null, apps: 234, goals: 146 },
      ],
      seasons: [
        { season: '2002/03', teamKey: 'sporting', apps: 31, goals: 5 },
        { season: '2003/04', teamKey: 'man-utd', apps: 40, goals: 6 },
        { season: '2004/05', teamKey: 'man-utd', apps: 50, goals: 9 },
        { season: '2005/06', teamKey: 'man-utd', apps: 47, goals: 12 },
        { season: '2006/07', teamKey: 'man-utd', apps: 53, goals: 23 },
        { season: '2007/08', teamKey: 'man-utd', apps: 49, goals: 42 },
        { season: '2008/09', teamKey: 'man-utd', apps: 53, goals: 26 },
        { season: '2009/10', teamKey: 'real-madrid', apps: 35, goals: 33 },
        { season: '2010/11', teamKey: 'real-madrid', apps: 54, goals: 53 },
        { season: '2011/12', teamKey: 'real-madrid', apps: 55, goals: 60 },
        { season: '2012/13', teamKey: 'real-madrid', apps: 55, goals: 55 },
        { season: '2013/14', teamKey: 'real-madrid', apps: 47, goals: 51 },
        { season: '2014/15', teamKey: 'real-madrid', apps: 54, goals: 61 },
        { season: '2015/16', teamKey: 'real-madrid', apps: 48, goals: 51 },
        { season: '2016/17', teamKey: 'real-madrid', apps: 46, goals: 42 },
        { season: '2017/18', teamKey: 'real-madrid', apps: 44, goals: 44 },
        { season: '2018/19', teamKey: 'juventus', apps: 43, goals: 28 },
        { season: '2019/20', teamKey: 'juventus', apps: 46, goals: 37 },
        { season: '2020/21', teamKey: 'juventus', apps: 44, goals: 36 },
        { season: '2021/22', teamKey: 'juventus', apps: 1, goals: 0 },
        { season: '2021/22', teamKey: 'man-utd', apps: 38, goals: 24 },
        { season: '2022/23', teamKey: 'man-utd', apps: 16, goals: 3 },
        { season: '2022/23', teamKey: 'al-nassr', apps: 19, goals: 14 },
        { season: '2023/24', teamKey: 'al-nassr', apps: 51, goals: 50 },
        { season: '2024/25', teamKey: 'al-nassr', apps: 41, goals: 35 },
        { season: '2025/26', teamKey: 'al-nassr', apps: 37, goals: 30 },
        { season: '2026/27', teamKey: 'al-nassr', apps: 9, goals: 5 },
      ],
      zones: {
        asOf: '2026-10-18',
        parts: { penalty: 184, freeKick: 65, outsideBox: 72, insideBox: 660 },
        source: SRC.mvr,
        note: 'Hors surface : frappes dans le jeu, coups francs directs exclus. Surface : hors penalties.',
      },
      bodyParts: {
        asOf: '2026-10-18',
        parts: { left: 186, right: 634, head: 158, other: 3 },
        source: SRC.mvr,
      },
      conversion: {
        penalty: { scored: 184, attempts: 220, scope: 'carrière, hors tirs au but', source: SRC.mvrPens },
        freeKick: { scored: 39, attempts: 611, scope: 'coups francs directs en championnat', source: SRC.mvrFreeKicks },
        allShots: { scored: 536, attempts: 3447, scope: 'championnat + Ligue des champions depuis 2009/10', source: SRC.mvrShots },
      },
      competitions: [
        { label: 'Ligue des champions', goals: 140, apps: 183 },
        { label: 'Coupe du monde', goals: 11 },
        { label: 'Copa América / Euro', goals: 14 },
        { label: 'Liga (Espagne)', goals: 311, apps: 292 },
      ],
      honours: [
        { id: 'ballon', label: 'Ballon d’Or', items: ['2008', '2013', '2014', '2016', '2017'] },
        { id: 'wc', label: 'Coupe du monde', items: [] },
        { id: 'cont', label: 'Titre continental en sélection', items: ['Euro 2016'] },
        { id: 'ucl', label: 'Ligue des champions', items: ['2008', '2014', '2016', '2017', '2018'] },
        {
          id: 'league',
          label: 'Championnats nationaux',
          items: ['Premier League 2007', 'Premier League 2008', 'Premier League 2009', 'Liga 2012', 'Liga 2017', 'Serie A 2019', 'Serie A 2020', 'Saudi Pro League 2026'],
        },
        { id: 'cwc', label: 'Coupe du monde des clubs', items: ['2008', '2014', '2016', '2017'] },
        { id: 'boot', label: 'Soulier d’or européen', items: ['2008', '2011', '2014', '2015'] },
        { id: 'olym', label: 'Or olympique', items: [] },
      ],
    },
  },
};

