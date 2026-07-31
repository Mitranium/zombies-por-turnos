import type { Lang } from '../game/types';

type StringTable = Record<string, { en: string; es: string }>;

const STRINGS: StringTable = {
  'game.title': { en: 'Barrio en Pie', es: 'Barrio en Pie' },
  'game.subtitle': {
    en: 'Pulp survival in Saavedra, Buenos Aires. Claim the barrio. Last squad standing.',
    es: 'Supervivencia pulp en Saavedra, Buenos Aires. Conquistá el barrio. Último en pie.',
  },
  'btn.start': { en: 'Start Run', es: 'Iniciar partida' },
  'btn.confirm': { en: 'Confirm Phase', es: 'Confirmar fase' },
  'btn.next': { en: 'Next', es: 'Siguiente' },
  'btn.restart': { en: 'Restart', es: 'Reiniciar' },
  'btn.attack': { en: 'Attack', es: 'Atacar' },
  'btn.special': { en: 'Special', es: 'Especial' },
  'btn.endTurn': { en: 'End Turn', es: 'Fin turno' },
  'lang.en': { en: 'English', es: 'Inglés' },
  'lang.es': { en: 'Español', es: 'Español' },

  'squad.player': { en: 'Your Squad', es: 'Tu escuadrón' },
  'squad.rival1': { en: 'Los del Conurbano', es: 'Los del Conurbano' },
  'squad.rival2': { en: 'Punteros de Villa', es: 'Punteros de Villa' },

  'unit.athlete': { en: 'Athlete', es: 'Deportista' },
  'unit.medic': { en: 'Med Student', es: 'Estudiante médico' },
  'unit.criminal': { en: 'Criminal', es: 'Criminal' },
  'unit.shambler': { en: 'Shambler', es: 'Tambaleante' },
  'unit.screamer': { en: 'Screamer', es: 'Gritón' },
  'unit.ripper': { en: 'Ripper', es: 'Destripador' },
  'unit.rivalA': { en: 'Raider', es: 'Asaltante' },
  'unit.rivalB': { en: 'Brute', es: 'Bruto' },
  'unit.rivalC': { en: 'Lookout', es: 'Vigía' },

  'node.street_south': { en: 'San Telmo', es: 'San Telmo' },
  'node.street_center': { en: 'Microcentro', es: 'Microcentro' },
  'node.street_north': { en: 'Recoleta', es: 'Recoleta' },
  'node.street_east': { en: 'Puerto Madero', es: 'Puerto Madero' },
  'node.street_west': { en: 'Almagro', es: 'Almagro' },
  'node.mall': { en: 'Galerías Pacífico', es: 'Galerías Pacífico' },
  'node.hospital': { en: 'Hospital Argerich', es: 'Hospital Argerich' },
  'node.police': { en: 'Comisaría 1ª', es: 'Comisaría 1ª' },
  'node.alley_west': { en: 'Pasaje del Humo', es: 'Pasaje del Humo' },
  'node.alley_east': { en: 'Caminito', es: 'Caminito' },
  'node.alley_north': { en: 'Callejón Palermo', es: 'Callejón Palermo' },

  'hud.phase': { en: 'Phase', es: 'Fase' },
  'hud.power': { en: 'Power', es: 'Poder' },
  'hud.rivals': { en: 'Rivals alive', es: 'Rivales vivos' },
  'hud.pois': { en: 'POIs held', es: 'POIs controlados' },
  'hud.hp': { en: 'HP', es: 'PV' },

  'move.title': { en: 'Your Turn', es: 'Tu turno' },
  'move.instruction': {
    en: 'Drag to explore Saavedra. Click a glowing node to move. Zombies at DOT Baires.',
    es: 'Arrastrá para explorar Saavedra. Clic en un nodo brillante para moverte. Zombis en DOT Baires.',
  },
  'move.current': { en: 'Current position', es: 'Posición actual' },

  'tutorial.1.title': { en: 'Click to move', es: 'Clic para moverte' },
  'tutorial.1.body': {
    en: 'Each phase, drag the map to explore and click a nearby corner in Saavedra. Your squad moves instantly.',
    es: 'Cada fase, arrastrá el mapa para explorar y hacé clic en una esquina cercana de Saavedra. Tu escuadrón se mueve al instante.',
  },
  'tutorial.2.title': { en: 'Claim POIs for Power', es: 'Conquistá POIs por Poder' },
  'tutorial.2.body': {
    en: 'Hold Galerías, Argerich or Comisaría for one phase to claim. Power boosts damage and HP.',
    es: 'Quedate en Galerías, Argerich o Comisaría una fase para reclamar. El Poder sube daño y PV.',
  },
  'tutorial.3.title': { en: 'Combat is rank-based', es: 'Combate por filas' },
  'tutorial.3.body': {
    en: 'Encounters switch to street combat. Front ranks protect the back. Attack and Special.',
    es: 'Los encuentros son en la calle. Las filas delanteras protegen. Atacá y usá Especial.',
  },
  'tutorial.4.title': { en: 'Last squad standing', es: 'Último escuadrón en pie' },
  'tutorial.4.body': {
    en: 'Eliminate rival squads. Zombies are hazards, not victory targets.',
    es: 'Eliminá escuadrones rivales. Los zombis son peligro, no objetivo de victoria.',
  },

  'combat.title': { en: 'Street Fight', es: 'Pelea callejera' },
  'combat.playerTurn': { en: 'Your turn', es: 'Tu turno' },
  'combat.enemyTurn': { en: 'Enemy turn', es: 'Turno enemigo' },
  'combat.victory': { en: 'Encounter cleared!', es: '¡Encuentro superado!' },
  'combat.selectTarget': { en: 'Select a target', es: 'Seleccioná un objetivo' },
  'combat.selectAlly': { en: 'Select an ally to heal', es: 'Seleccioná un aliado para curar' },
  'combat.dice.ready': { en: 'Your dice', es: 'Tu dado' },
  'combat.dice.rolling': { en: 'Rolling…', es: 'Tirando…' },
  'combat.dice.damage': { en: 'DMG', es: 'DAÑO' },
  'combat.powerBonus': { en: '(+{pct}% from Power)', es: '(+{pct}% por Poder)' },

  'combat.attack.title.athlete': { en: 'Strike', es: 'Golpe' },
  'combat.attack.title.medic': { en: 'Syringe', es: 'Jeringa' },
  'combat.attack.title.criminal': { en: 'Shank', es: 'Cuchillo' },
  'combat.attack.body.athlete': {
    en: 'Basic melee hit on a front-line enemy.',
    es: 'Golpe cuerpo a cuerpo contra un enemigo de la fila delantera.',
  },
  'combat.attack.body.medic': {
    en: 'Improvised syringe stab. Low damage, always hits.',
    es: 'Pinchazo con jeringa improvisada. Poco daño, siempre impacta.',
  },
  'combat.attack.body.criminal': {
    en: 'Street blade. Strong single hit; prefers back row if exposed.',
    es: 'Cuchillo callejero. Golpe fuerte; prefiere la retaguardia expuesta.',
  },

  'combat.special.title.athlete': { en: 'Power Blow', es: 'Golpe potente' },
  'combat.special.title.medic': { en: 'Triage', es: 'Triage' },
  'combat.special.title.criminal': { en: 'Reckless Rush', es: 'Embestida temeraria' },
  'combat.special.body.athlete': {
    en: 'Heavy strike with bigger dice. Targets one enemy.',
    es: 'Golpe pesado con dados mayores. Un solo enemigo.',
  },
  'combat.special.body.medic': {
    en: 'Heal all living allies +4 HP. No target needed.',
    es: 'Cura +4 PV a todos los aliados vivos. No requiere objetivo.',
  },
  'combat.special.body.criminal': {
    en: 'Wild double swing: extra damage but you take 2 recoil.',
    es: 'Doble tajo salvaje: más daño pero recibís 2 de retroceso.',
  },

  'log.hit': { en: '{attacker} hits {target} for {amount}', es: '{attacker} golpea a {target} por {amount}' },
  'log.heal': { en: '{attacker} heals {target} for {amount}', es: '{attacker} cura a {target} por {amount}' },
  'log.summon': { en: 'A shambler joins the fight!', es: '¡Un tambaleante se une a la pelea!' },
  'log.self': { en: '{attacker} takes {amount} recoil', es: '{attacker} recibe {amount} de retroceso' },
  'log.claim': { en: '{squad} claims {poi}', es: '{squad} reclama {poi}' },
  'log.healPoi': { en: 'Hospital heals the squad', es: 'El hospital cura al escuadrón' },

  'end.victory': { en: 'Barrio secured!', es: '¡Barrio asegurado!' },
  'end.defeat': { en: 'Your squad is gone.', es: 'Tu escuadrón cayó.' },
  'end.victorySub': { en: 'Last squad standing in Buenos Aires.', es: 'Último en pie en Buenos Aires.' },
  'end.defeatSub': { en: 'Permadeath ends this run.', es: 'Muerte permanente. Fin de la partida.' },

  'poi.mall': { en: 'DOT Baires (+2 Power)', es: 'DOT Baires (+2 Poder)' },
  'poi.hospital': { en: 'Hospital Tierra del Fuego (+1, heal)', es: 'Hospital Tierra del Fuego (+1, cura)' },
  'poi.police': { en: 'Comisaría 12 (+1, gun buff)', es: 'Comisaría 12 (+1, buff arma)' },
};

export function t(key: string, lang: Lang, params?: Record<string, string | number>): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  let text = entry[lang] ?? entry.en;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export function unitLabel(unitKey: string, lang: Lang): string {
  return t(unitKey, lang);
}
