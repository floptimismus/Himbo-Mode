/**
 * Original pixel art, drawn as character grids. '.' is transparent; every other character is
 * looked up in the palette passed to <PixelSprite />. Conventions: x = main fill, k = outline,
 * w = highlight, y = second color, r = third color.
 */
export const SPRITES = {
  home: [
    '.....x.....', '....xxx....', '...xxxxx...', '..xxxxxxx..', '.xxxxxxxxx.', 'xxxxxxxxxxx',
    '.xxxxxxxxx.', '.xxx...xxx.', '.xxx...xxx.', '.xxx...xxx.', '.xxx...xxx.',
  ],
  dumbbell: [
    '.xx......xx.', '.xx......xx.', 'xxxx....xxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxx....xxxx', '.xx......xx.', '.xx......xx.',
  ],
  scroll: [
    '.xxxxxxxxx..', 'xx.......xx.', 'x..xxxxx..x.', 'xx.......xx.', '.x.xxxxx.x..', '.x.......x..',
    '.x.xxxxx.x..', '.x.......x..', '.x.xxx...x..', 'xx.......xx.', 'x.........x.', '.xxxxxxxxx..',
  ],
  cup: [
    '..kkkkkkkk..', 'kkkxwxxxxkkk', 'k.kxwxxxxk.k', 'k.kxwxxxxk.k', '.kkxwxxxxkk.', '..kxxxxxxk..',
    '...kxxxxk...', '....kxxk....', '....kxxk....', '...kkxxkk...', '..kxxxxxxk..', '..kkkkkkkk..',
  ],
  person: [
    '....xxxx....', '...xxxxxx...', '...xxxxxx...', '...xxxxxx...', '....xxxx....', '............',
    '..xxxxxxxx..', '.xxxxxxxxxx.', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx',
  ],
  flame: [
    '.....r......', '....rr......', '....rrr..r..', '...rrrr.rr..', '..rrrrrrrr..', '..rryrrrrrr.',
    '.rrryyrryrr.', '.rryyyryyrr.', '.rryyyyyyrr.', '.rryywwyyrr.', '..rryyyyrr..', '...rrrrrr...',
  ],
  star: [
    '.....kk.....', '....kxxk....', '....kxxk....', 'kkkkkxxkkkkk', 'kxxxxwxxxxxk', '.kxxxwxxxxk.',
    '..kxxxxxxk..', '..kxxxxxxk..', '.kxxxkkxxxk.', '.kxxk..kxxk.', 'kxkk....kkxk', 'kk........kk',
  ],
  heart: [
    '.kkk....kkk.', 'kxxxk..kxxxk', 'kxwxxkkxxxxk', 'kxwxxxxxxxxk', 'kxxxxxxxxxxk', '.kxxxxxxxxk.',
    '..kxxxxxxk..', '...kxxxxk...', '....kxxk....', '.....kk.....',
  ],
  medal: [
    '.kk......kk.', '.kyk....kyk.', '..kyk..kyk..', '...kykkyk...', '....kkkk....', '...kxxxxk...',
    '..kxxwxxxk..', '..kxwxxxxk..', '..kxxxxxxk..', '..kxxxxxxk..', '...kxxxxk...', '....kkkk....',
  ],
  weight: [
    '....kkkk....', '...kk..kk...', '...k....k...', '...kk..kk...', '..kkkkkkkk..', '.kxxxxxxxxk.',
    'kxxwxxxxxxxk', 'kxwxxxxxxxxk', 'kxxxxxxxxxxk', 'kxxxxxxxxxxk', '.kxxxxxxxxk.', '..kkkkkkkk..',
  ],
  boot: [
    '..kkkk......', '..kxxk......', '..kxxk......', '..kxxkk.....', '..kxxxxkk...', '..kxwxxxxkk.',
    '.kxxxxxxxxxk', 'kxxxxxxxxxxk', 'kxxxxxxxxxxk', 'kkkkkkkkkkkk', 'k.k.k.k.k.k.',
  ],
  ball: [
    '.......kkkk.', '.....kkxxxxk', '....kxxxxwxk', '...kxxxwxxxk', '..kxxxwxwxxk', '.kxxxwxwxxk.',
    '.kxxwxwxxxk.', 'kxxxwxxxxk..', 'kxxwxxxxk...', 'kxxxxxxk....', 'kxxxxkk.....', '.kkkk.......',
  ],
  sun: [
    '.....kk.....', '.k...kk...k.', '..k......k..', '....kkkk....', '...kxxxxk...', 'kk.kxwxxk.kk',
    'kk.kxxxxk.kk', '...kxxxxk...', '....kkkk....', '..k......k..', '.k...kk...k.', '.....kk.....',
  ],
  moon: [
    '....kkkk....', '..kkxxxk....', '.kxxxxk.....', '.kxwxk......', 'kxxxxk......', 'kxxxxk......',
    'kxxxxk......', 'kxxxxxk....k', '.kxxxxxkkkkk', '.kxxxxxxxxk.', '..kkxxxxkk..', '....kkkk....',
  ],
  crown: [
    'k....kk....k', 'kk..kxxk..kk', 'kxk.kxxk.kxk', 'kxxkxxxxkxxk', 'kxxxxxxxxxxk', 'kxwxxxxxxxxk',
    'kxxxxxxxxxxk', 'kkkkkkkkkkkk', 'kxyxxyyxxyxk', 'kkkkkkkkkkkk',
  ],
  clock: [
    '...kkkkkk...', '..kxxxxxxk..', '.kxxxkxxxxk.', 'kxxxxkxxxxxk', 'kxxxxkxxxxxk', 'kxxxxkxxxxxk',
    'kxxxxkkkkxxk', 'kxxxxxxxxxxk', 'kxxxxxxxxxxk', '.kxxxxxxxxk.', '..kxxxxxxk..', '...kkkkkk...',
  ],
  bolt: [
    '......kkkk..', '.....kxxk...', '....kxxk....', '...kxxk.....', '..kxxkkkkk..', '.kxxxxxxxk..',
    '.kkkkkxxk...', '.....kxxk...', '....kxxk....', '....kxk.....', '...kxk......', '...kk.......',
  ],
  shield: [
    'kkkkkkkkkkkk', 'kxxxxxwxxxxk', 'kxxxxxwxxxxk', 'kxxxxxwxxxxk', 'kxxxxxwxxxxk', 'kwwwwwwwwwwk',
    'kxxxxxwxxxxk', '.kxxxxwxxxk.', '.kxxxxwxxxk.', '..kxxxwxxk..', '...kxxwxk...', '....kkkk....',
  ],
  badge: [
    'kkkkkkkkkkkk', 'kwwwwwwwwwwk', 'kwxxxxxxxxxk', 'kwxxxxxxxxxk', 'kwxxxxxxxxxk', 'kwxxxxxxxxxk',
    'kwxxxxxxxxxk', '.kxxxxxxxxk.', '.kxxxxxxxxk.', '..kxxxxxxk..', '...kxxxxk...', '....kkkk....',
  ],
  map: [
    'kkkk....kkkk', 'kxxxkkkkxxxk', 'kxxxkxxkxxxk', 'kxwxkxxkxwxk', 'kxxwkxxkwxxk', 'kxxxkwwkxxxk',
    'kxxxkxxkxxxk', 'kxxxkxxkxxxk', 'kxxxkkkkxxxk', 'kkkk....kkkk',
  ],
  people: [
    '..kk....kk..', '.kxxk..kxxk.', '.kxxk..kxxk.', '..kk....kk..', '.kkkk..kkkk.', 'kxxxxkkxxxxk',
    'kxxxxxxxxxxk', 'kxxxxxxxxxxk', 'kxxxxxxxxxxk', 'kkkkkkkkkkkk',
  ],
  lock: [
    '...xxxxxx...', '..xx....xx..', '..xx....xx..', '..xx....xx..', '.xxxxxxxxxx.', '.xxxxxxxxxx.',
    '.xxxx..xxxx.', '.xxxx..xxxx.', '.xxxxxxxxxx.', '.xxxxxxxxxx.',
  ],
  check: ['..........xx', '.........xxx', '........xxx.', '.......xxx..', 'xx....xxx...', 'xxx..xxx....', '.xxxxxx.....', '..xxxx......', '...xx.......'],
  plus: ['...xx...', '...xx...', '...xx...', 'xxxxxxxx', 'xxxxxxxx', '...xx...', '...xx...', '...xx...'],
  close: ['xx....xx', 'xxx..xxx', '.xxxxxx.', '..xxxx..', '..xxxx..', '.xxxxxx.', 'xxx..xxx', 'xx....xx'],
  gear: [
    '....xxxx....', '.xx.xxxx.xx.', '.xxxxxxxxxx.', '..xxxxxxxx..', 'xxxx....xxxx', 'xxxx....xxxx',
    'xxxx....xxxx', 'xxxx....xxxx', '..xxxxxxxx..', '.xxxxxxxxxx.', '.xx.xxxx.xx.', '....xxxx....',
  ],
  search: [
    '..xxxxx.....', '.xx...xx....', 'xx.....xx...', 'xx.....xx...', 'xx.....xx...', '.xx...xx....',
    '..xxxxxxx...', '.......xxx..', '........xxx.', '.........xx.',
  ],
  right: ['xx....', '.xx...', '..xx..', '...xx.', '....xx', '....xx', '...xx.', '..xx..', '.xx...', 'xx....'],
  left: ['....xx', '...xx.', '..xx..', '.xx...', 'xx....', 'xx....', '.xx...', '..xx..', '...xx.', '....xx'],
  up: ['....xx....', '...xxxx...', '..xx..xx..', '.xx....xx.', 'xx......xx'],
  down: ['xx......xx', '.xx....xx.', '..xx..xx..', '...xxxx...', '....xx....'],
  trash: [
    '...xxxx...', 'xxxxxxxxxx', '.x......x.', '.x.x..x.x.', '.x.x..x.x.', '.x.x..x.x.', '.x.x..x.x.', '.x......x.', '.xxxxxxxx.',
  ],
  pencil: [
    '.......xx.', '......xxxx', '.....xxxxx', '....xxxxx.', '...xxxxx..', '..xxxxx...', '.xxxxx....', 'xxxxx.....', 'xxxx......', 'xxx.......',
  ],
  snow: ['....x....', '.x..x..x.', '..x.x.x..', '...xxx...', 'xxxxxxxxx', '...xxx...', '..x.x.x..', '.x..x..x.', '....x....'],
  share: [
    '....xx....', '...xxxx...', '..xxxxxx..', '....xx....', '....xx....', 'xx..xx..xx', 'xx......xx', 'xx......xx', 'xxxxxxxxxx', 'xxxxxxxxxx',
  ],
  dots: ['xx', 'xx', '..', 'xx', 'xx', '..', 'xx', 'xx'],
  play: ['xx......', 'xxxx....', 'xxxxxx..', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxx..', 'xxxx....', 'xx......'],
  copy: [
    '...xxxxxxx', '...x.....x', 'xxxxxxx..x', 'x.....x..x', 'x.....x..x', 'x.....x..x', 'x.....xxxx', 'x.....x...', 'x.....x...', 'xxxxxxx...',
  ],
} as const;

export type SpriteName = keyof typeof SPRITES;

/** Avatar templates: H hair, S skin, E eyes, M mouth, J jersey, K jersey stripe, B cap. */
const AVATAR_TEMPLATES = [
  [
    '...HHHHHH...', '..HHHHHHHH..', '..HHSSSSHH..', '..HSSSSSSH..', '..SSESSESS..', '..SSSSSSSS..',
    '..SSSMMSSS..', '...SSSSSS...', '....SSSS....', '..JJJKKJJJ..', '.JJJJKKJJJJ.', '.JJJJKKJJJJ.',
  ],
  [
    '...HHHHHH...', '..HHHHHHHH..', '.HHHSSSSHHH.', '.HHSSSSSSHH.', '.HHSESSESHH.', '.HHSSSSSSHH.',
    '.HHSSMMSSHH.', '.HH.SSSS.HH.', '....SSSS....', '..JJJKKJJJ..', '.JJJJKKJJJJ.', '.JJJJKKJJJJ.',
  ],
  [
    '...BBBBBB...', '..BBBBBBBB..', '..BBBBBBBB..', '.BBSSSSSSBB.', '.BBSESSESBB.', '.BBSSSSSSBB.',
    '..BSSMMSSB..', '...BSSSSB...', '....SSSS....', '..JJJKKJJJ..', '.JJJJKKJJJJ.', '.JJJJKKJJJJ.',
  ],
  [
    '.....HH.....', '.....HH.....', '...SSHHSS...', '..SSSSSSSS..', '..SSESSESS..', '..SSSSSSSS..',
    '..HHSMMSHH..', '...HHHHHH...', '....HHHH....', '..JJJKKJJJ..', '.JJJJKKJJJJ.', '.JJJJKKJJJJ.',
  ],
] as const;

const SKIN = ['#f6c9a0', '#d99a6c', '#a8683f', '#6e4327'];
const HAIR = ['#3a2a1a', '#e9b23c', '#c2452d', '#1d1d2b', '#8a5a2b', '#d8d8e6'];
const JERSEY = ['#d92f5f', '#157a76', '#3567d6', '#f5bd1f', '#7a3fc4', '#2c8443'];
const TILE = ['#ffd9a8', '#b6ecd9', '#c7d6ff', '#ffe58a', '#e3c9ff', '#c9f0b0'];

export const AVATAR_IDS = Array.from({ length: 12 }, (_, i) => `a${i + 1}`);

export function avatarSprite(id: string) {
  const n = Math.max(0, AVATAR_IDS.indexOf(id));
  const jersey = JERSEY[n % JERSEY.length]!;
  return {
    rows: AVATAR_TEMPLATES[n % AVATAR_TEMPLATES.length]!,
    tile: TILE[(n * 5 + 1) % TILE.length]!,
    palette: {
      H: HAIR[(n * 7 + 2) % HAIR.length]!,
      S: SKIN[(n + Math.floor(n / 4)) % SKIN.length]!,
      E: '#1d1d2b',
      M: '#8c2f3c',
      J: jersey,
      K: '#ffffff',
      B: JERSEY[(n + 2) % JERSEY.length]!,
    } as Record<string, string>,
  };
}
