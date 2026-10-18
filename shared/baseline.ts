import type { Baseline, Source } from './types.ts';

/*
 * Données de référence : totaux de carrière (matchs officiels, club + sélection)
 * arrêtés au 16 octobre 2026. Tout match joué après cette date est ajouté
 * automatiquement par le suivi en direct (voir server/tracker.ts).
 *
 * Les sites spécialisés ne comptent pas tous de la même façon (matchs amicaux,
 * passes décisives « Opta » ou « Transfermarkt »...). Les totaux principaux
 * proviennent d'une seule source (messivsronaldo.app) pour rester cohérents ;
 * les répartitions détaillées (zones, pied/tête, triplés) sont des compilations
 * signalées comme approximatives dans l'interface.
 */

const SRC = {
  mvr: { label: 'messivsronaldo.app — totaux carrière, minutes, passes décisives', url: 'https://www.messivsronaldo.app/' },
  mvrFootball: { label: 'messivsronaldo.football — pied, tête, hors surface', url: 'https://messivsronaldo.football/stats' },
  planetPens: {
    label: 'Planet Football — penalties en carrière',
    url: 'https://www.planetfootball.com/stats-tables/lionel-messi-cristiano-ronaldo-penalties-non-career-goalscoring-stats-records',
  },
  mxrFreeKicks: { label: 'messixronaldo.com — coups francs', url: 'https://messixronaldo.com/messi-vs-ronaldo-free-kicks-penalties/' },
  yahoo930: {
    label: 'Yahoo Sports — 930e but de Messi, 75e sur coup franc (20/09/2026)',
    url: 'https://sports.yahoo.com/articles/watch-lionel-messi-reaches-930-022904987.html',
  },
  messistat: { label: 'Messistat — Messi à l’Inter Miami', url: 'https://www.messistat.com/en' },
  espn981: {
    label: 'ESPN — 981e but de Ronaldo, 134e avec Al Nassr (12/10/2026)',
    url: 'https://www.espn.com/soccer/story/_/id/50168555/ronaldo-nets-al-nassr-first-afc-champions-league-win',
  },
  uefaIntl: {
    label: 'UEFA — records internationaux (146 buts / 234 sélections ; Messi 126 / 208)',
    url: 'https://www.uefa.com/european-qualifiers/news/026a-1297500e1b34-a17bbbcad258-1000--cristiano-ronaldo-all-time-leading-scorer-in-men-s-interna/',
  },
  elGrafico: {
    label: 'El Gráfico — triplés en carrière',
    url: 'https://www.elgrafico.com.ar/articulo/lionel-messi/63144/cristiano-ronaldo-vs-lionel-messi-%C2%BFquien-anoto-mas-hat-trick%3F',
  },
  espnTracker2025: {
    label: 'ESPN — saison 2025 de Messi (43 buts en 49 matchs)',
    url: 'https://www.espn.com/soccer/story/_/id/43935337/lionel-messi-2025-tracker-inter-miami-games-goals-assists-stats',
  },
  wc2026: {
    label: 'Goal — bilan de la Coupe du monde 2026',
    url: 'https://www.goal.com/en/lists/winners-losers-2026-world-cup-lionel-messi-kylian-mbappe-spain-cristiano-ronaldo-neymar-christian-pulisic/blt7aa010d528ddf937',
  },
} satisfies Record<string, Source>;

export const baseline: Baseline = {
  asOf: '2026-10-16T23:59:59Z',
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
      totals: { apps: 1180, goals: 934, assists: 427, minutes: 97107 },
      hatTricks: { count: 62, approximate: true, source: SRC.elGrafico },
      teams: [
        { key: 'barcelona', name: 'FC Barcelone', kind: 'club', from: '2004', to: '2021', apps: 778, goals: 672 },
        { key: 'psg', name: 'Paris Saint-Germain', kind: 'club', from: '2021', to: '2023', apps: 75, goals: 32 },
        { key: 'inter-miami', name: 'Inter Miami CF', kind: 'club', from: '2023', to: null, apps: 119, goals: 104 },
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
        { season: '2024', teamKey: 'inter-miami', apps: 25, goals: 23, estimated: true },
        { season: '2025', teamKey: 'inter-miami', apps: 49, goals: 43 },
        { season: '2026', teamKey: 'inter-miami', apps: 31, goals: 27, estimated: true },
      ],
      zones: {
        asOf: '2026-10-16',
        parts: { penalty: 114, freeKick: 76, outsideBox: 105, insideBox: 639 },
        source: SRC.planetPens,
        note:
          'Compilation : penalties (Planet Football, été 2026), coups francs (75e le 20/09/2026, puis un autre contre Columbus), ' +
          'frappes hors surface dans le jeu (messivsronaldo.football). Le reste des buts est compté dans la surface.',
      },
      bodyParts: {
        asOf: '2026-10',
        parts: { left: 711, right: 109, head: 26 },
        source: SRC.mvrFootball,
        note: 'Buts classés par la source ; les autres surfaces (poitrine, genou…) ne sont pas comptées.',
      },
      competitions: [
        { label: 'Ligue des champions', goals: 129, apps: 163 },
        { label: 'Coupe du monde', goals: 21, assists: 12 },
        { label: 'Copa América / Euro', goals: 14 },
        { label: 'Liga (Espagne)', goals: 474, apps: 520 },
      ],
      honours: [
        { label: 'Ballon d’Or', count: 8, detail: '2009, 2010, 2011, 2012, 2015, 2019, 2021, 2023' },
        { label: 'Coupe du monde', count: 1, detail: '2022' },
        { label: 'Titre continental en sélection', count: 2, detail: 'Copa América 2021, 2024' },
        { label: 'Ligue des champions', count: 4, detail: '2006, 2009, 2011, 2015' },
        { label: 'Championnats nationaux', count: 13, detail: '10 Liga, 2 Ligue 1, 1 MLS Cup (2025)' },
        { label: 'Coupe du monde des clubs', count: 3, detail: '2009, 2011, 2015' },
        { label: 'Soulier d’or européen', count: 6, detail: '2010, 2012, 2013, 2017, 2018, 2019' },
        { label: 'Or olympique', count: 1, detail: 'Pékin 2008' },
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
      hatTricks: { count: 66, approximate: false, source: SRC.elGrafico },
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
        { season: '2024/25', teamKey: 'al-nassr', apps: 41, goals: 35, estimated: true },
        { season: '2025/26', teamKey: 'al-nassr', apps: 38, goals: 31, estimated: true },
        { season: '2026/27', teamKey: 'al-nassr', apps: 8, goals: 4, estimated: true },
      ],
      zones: {
        asOf: '2026-10-16',
        parts: { penalty: 184, freeKick: 64, outsideBox: 68, insideBox: 665 },
        source: SRC.planetPens,
        note:
          'Compilation : penalties (Planet Football, 184 sur 976 buts), coups francs (messixronaldo.com), ' +
          'frappes hors surface dans le jeu (messivsronaldo.football). Le reste des buts est compté dans la surface.',
      },
      bodyParts: {
        asOf: '2026-10',
        parts: { left: 178, right: 605, head: 151 },
        source: SRC.mvrFootball,
        note: 'Buts classés par la source ; les autres surfaces (poitrine, genou…) ne sont pas comptées.',
      },
      competitions: [
        { label: 'Ligue des champions', goals: 140, apps: 183 },
        { label: 'Coupe du monde', goals: 11 },
        { label: 'Copa América / Euro', goals: 14 },
        { label: 'Liga (Espagne)', goals: 311, apps: 292 },
      ],
      honours: [
        { label: 'Ballon d’Or', count: 5, detail: '2008, 2013, 2014, 2016, 2017' },
        { label: 'Coupe du monde', count: 0 },
        { label: 'Titre continental en sélection', count: 1, detail: 'Euro 2016' },
        { label: 'Ligue des champions', count: 5, detail: '2008, 2014, 2016, 2017, 2018' },
        { label: 'Championnats nationaux', count: 8, detail: '3 Premier League, 2 Liga, 2 Serie A, 1 Saudi Pro League (2026)' },
        { label: 'Coupe du monde des clubs', count: 4, detail: '2008, 2014, 2016, 2017' },
        { label: 'Soulier d’or européen', count: 4, detail: '2008, 2011, 2014, 2015' },
        { label: 'Or olympique', count: 0 },
      ],
    },
  },
};

