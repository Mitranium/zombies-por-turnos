import type { Lang } from '../game/types';

type StringTable = Record<string, { en: string; es: string }>;

const STRINGS: StringTable = {
  'game.title': { en: 'Zombies por Turnos', es: 'Zombies por Turnos' },
  'game.eyebrow': { en: 'DEMO · TURN-BASED COMBAT', es: 'DEMO · COMBATE POR TURNOS' },
  'game.subtitle': {
    en: 'Survive the waves. Earn XP. Level up your squad.',
    es: 'Sobreviví las oleadas. Ganá XP. Mejorá tu escuadrón.',
  },
  'title.playHint': { en: 'Enter to play', es: 'Enter para jugar' },
  'title.squadPreview': { en: 'Your squad', es: 'Tu escuadrón' },
  'title.manageSquad': { en: 'Manage squad', es: 'Gestionar escuadrón' },
  'title.openWiki': { en: 'Zombie wiki', es: 'Wiki de zombis' },
  'title.stat.kills': { en: 'Kills', es: 'Bajas' },
  'btn.start': { en: 'Start Demo', es: 'Iniciar demo' },
  'btn.restart': { en: 'Restart', es: 'Reiniciar' },
  'btn.attack': { en: 'Attack', es: 'Atacar' },
  'btn.special': { en: 'Special', es: 'Especial' },
  'btn.cancel': { en: 'Cancel', es: 'Cancelar' },
  'combat.special.ready': { en: 'READY', es: 'LISTA' },
  'combat.special.noWounds': { en: 'NO WOUNDED ALLIES', es: 'SIN HERIDOS' },
  'combat.special.readyAlert': { en: 'ULTIMATE READY!', es: '¡ULTI LISTA!' },
  'combat.special.basic': { en: 'BASICS', es: 'BÁSICOS' },
  'lang.en': { en: 'English', es: 'Inglés' },
  'lang.es': { en: 'Español', es: 'Español' },
  'audio.mute': { en: 'Mute sound', es: 'Silenciar sonido' },
  'audio.unmute': { en: 'Unmute sound', es: 'Activar sonido' },

  'squad.player': { en: 'Your Squad', es: 'Tu escuadrón' },

  'unit.athlete': { en: 'Athlete', es: 'Deportista' },
  'unit.medic': { en: 'Med Student', es: 'Estudiante médico' },
  'unit.criminal': { en: 'Criminal', es: 'Criminal' },
  'unit.shambler': { en: 'Shambler', es: 'Tambaleante' },
  'unit.screamer': { en: 'Screamer', es: 'Gritón' },
  'unit.ripper': { en: 'Ripper', es: 'Destripador' },

  'round.label': { en: 'Round', es: 'Ronda' },
  'round.cleared': { en: 'Wave cleared', es: 'Oleada eliminada' },
  'round.survivors': { en: 'Survivors', es: 'Sobrevivientes' },
  'round.recovered': {
    en: 'The full squad will return restored for the next round.',
    es: 'El equipo completo volverá restablecido en la próxima ronda.',
  },
  'round.next': { en: 'Start next wave', es: 'Iniciar siguiente oleada' },
  'round.reached': { en: 'Round reached:', es: 'Ronda alcanzada:' },

  'deployment.title': { en: 'Position your squad', es: 'Posicioná tu escuadrón' },
  'deployment.hint': {
    en: 'Pick a unit, then click a hex. Zombies attack whoever is closest on the battlefield. Enter to start.',
    es: 'Elegí un personaje y tocá un hexágono. Los zombis atacan al más cercano en el campo. Enter para empezar.',
  },
  'deployment.confirm': { en: 'Start round', es: 'Iniciar ronda' },

  'xp.label': { en: 'XP', es: 'XP' },
  'xp.runGained': { en: 'XP this run', es: 'XP en esta partida' },
  'xp.bestRound': { en: 'Best round', es: 'Mejor ronda' },
  'squad.title': { en: 'Squad', es: 'Escuadrón' },
  'squad.eyebrow': { en: 'LEVEL UP', es: 'SUBIR NIVEL' },
  'squad.hint': {
    en: 'Spend XP to permanently improve your characters. Earn XP by killing zombies.',
    es: 'Gastá XP para mejorar personajes de forma permanente. Ganás XP matando zombis.',
  },
  'squad.level': { en: 'Level', es: 'Nivel' },
  'squad.levelUp': { en: 'Level up', es: 'Subir nivel' },
  'squad.maxed': { en: 'MAX', es: 'MÁX' },
  'squad.back': { en: 'Back', es: 'Volver' },

  'wiki.eyebrow': { en: 'FIELD GUIDE', es: 'GUÍA DE CAMPO' },
  'wiki.title': { en: 'Zombie wiki', es: 'Wiki de zombis' },
  'wiki.hint': {
    en: 'Each enemy behaves differently. Kill screamers early to stop reinforcements.',
    es: 'Cada enemigo se comporta distinto. Matá a los gritones pronto para frenar refuerzos.',
  },
  'wiki.back': { en: 'Back', es: 'Volver' },
  'wiki.stats': { en: '{hp} HP · SPD {speed} · {dice} · +{xp} XP', es: '{hp} PV · VEL {speed} · {dice} · +{xp} XP' },
  'wiki.shambler.body': {
    en: 'Slow grunt. Attacks whoever is closest on the hex grid. Common from round 1.',
    es: 'Zombi lento. Ataca al superviviente más cercano en la grilla. Común desde la ronda 1.',
  },
  'wiki.screamer.body': {
    en: 'Stays in the back row. Each turn, 20% chance to call a shambler instead of attacking. Appears from round 2.',
    es: 'Se queda en la retaguardia. En su turno, 20% de probabilidad de invocar un tambaleante en vez de atacar. Aparece desde la ronda 2.',
  },
  'wiki.ripper.body': {
    en: 'Very fast. Prefers back-row targets and hits hard. Usually the last enemy from round 3 onward.',
    es: 'Muy rápido. Prefiere objetivos en la retaguardia y pega fuerte. Suele ser el último enemigo desde la ronda 3.',
  },

  'combat.playerTurn': { en: 'Your turn', es: 'Tu turno' },
  'combat.enemyTurn': { en: 'Enemy turn', es: 'Turno enemigo' },
  'combat.selectTarget': { en: 'Select a target', es: 'Seleccioná un objetivo' },
  'combat.dice.ready': { en: 'Your dice', es: 'Tu dado' },
  'combat.dice.rolling': { en: 'Rolling…', es: 'Tirando…' },
  'combat.waitDice': { en: 'Wait for the dice to land', es: 'Esperá a que caigan los dados' },
  'combat.keyboard.action': {
    en: '← → / WASD: choose action · Enter: confirm',
    es: '← → / WASD: elegir acción · Enter: confirmar',
  },
  'combat.keyboard.target': {
    en: '← → / WASD: choose target · Enter: confirm · Esc: back',
    es: '← → / WASD: elegir objetivo · Enter: confirmar · Esc: volver',
  },
  'combat.dice.damage': { en: 'DMG', es: 'DAÑO' },

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
    en: 'Heal all living allies +8 HP. No target needed.',
    es: 'Cura +8 PV a todos los aliados vivos. No requiere objetivo.',
  },
  'combat.special.body.criminal': {
    en: 'Wild double swing: extra damage but you take 2 recoil.',
    es: 'Doble tajo salvaje: más daño pero recibís 2 de retroceso.',
  },

  'log.hit': { en: '{attacker} hits {target} for {amount}', es: '{attacker} golpea a {target} por {amount}' },
  'log.heal': { en: '{attacker} heals {target} for {amount}', es: '{attacker} cura a {target} por {amount}' },
  'log.summon': { en: 'A shambler joins the fight!', es: '¡Un tambaleante se une a la pelea!' },
  'log.self': { en: '{attacker} takes {amount} recoil', es: '{attacker} recibe {amount} de retroceso' },

  'end.defeat': { en: 'The squad fell.', es: 'El escuadrón cayó.' },
  'end.defeatSub': { en: 'Game over. Try to beat your best round.', es: 'Fin de la partida. Intentá superar tu mejor ronda.' },
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
