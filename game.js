const TetrisGame = (() => {
  const canvas = document.getElementById('tetris');
  if (!canvas) {
    console.error('Canvas element "#tetris" not found');
    return;
  }
  const context = canvas.getContext('2d');
  context.scale(20, 20);
  
  const BOMB = 8;
  const BOMB_TIMER = 3;
  const LASER = 9;
  const EXTRUDER = 10;
  
  const BOMB_PROBABILITY = 0.25;
  const LASER_PROBABILITY = 0.25;
  const EXTRUDER_PROBABILITY = 0.25;

  const KEY = {
    LEFT: 37,
    RIGHT: 39,
    DOWN: 40,
    SPACE: 32,
    Q: 81,
    W: 87,
    UP: 38
  };
  
  const COLORS = [
    null,
    '#FF0D72',
    '#0DC2FF',
    '#0DFF72',
    '#F538FF',
    '#FF8E0D',
    '#FFE138',
    '#3877FF',
    '#FF0000', // bomb
    '#FFFFFF', // laser
    '#00FFFF', // extruder
  ];
  
  let arena = createMatrix(10, 20);
  let bombTimers = createMatrix(10, 20);
  let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    score: 0
  };
  
  let piecesSinceBomb = 0;
  let piecesSinceLaser = 0;
  let piecesSinceExtruder = 0;
  
  function createMatrix(w, h) {
    return Array.from({ length: h }, () => Array(w).fill(0));
  }
  
  const PIECE_SHAPES = {
    T: [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
    O: [[2, 2], [2, 2]],
    L: [[0, 3, 0], [0, 3, 0], [0, 3, 3]],
    J: [[0, 4, 0], [0, 4, 0], [4, 4, 0]],
    I: [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]],
    S: [[0, 6, 6], [6, 6, 0], [0, 0, 0]],
    Z: [[7, 7, 0], [0, 7, 7], [0, 0, 0]]
  };

  function createPiece(type) {
    return PIECE_SHAPES[type];
  }
  
  function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          context.fillStyle = COLORS[value];
          context.fillRect(x + offset.x, y + offset.y, 1, 1);
        }
      });
    });
  }
  
  function applyGravity(arena) {
    const w = arena[0].length;
    const h = arena.length;
    for (let x = 0; x < w; ++x) {
      for (let y = h - 1; y > 0; --y) {
        if (arena[y][x] === 0) {
          let k = y - 1;
          while (k >= 0 && arena[k][x] === 0) {
            k--;
          }
          if (k >= 0) {
            [arena[y][x], arena[k][x]] = [arena[k][x], arena[y][x]];
          }
        }
      }
    }
  }
  
  function tickBombs() {
    let exploded = false;
    for (let y = 0; y < arena.length; y++) {
      for (let x = 0; x < arena[y].length; x++) {
        if (arena[y][x] === BOMB) {
          bombTimers[y][x]--;
          if (bombTimers[y][x] <= 0) {
            exploded = true;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (arena[y + dy] && arena[y + dy][x + dx] !== undefined) {
                  arena[y + dy][x + dx] = 0;
                  bombTimers[y + dy][x + dx] = 0;
                }
              }
            }
          }
        }
      }
    }
    if (exploded) {
      applyGravity(arena);
    }
  }
  
  function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, { x: 0, y: 0 });
    
    context.fillStyle = '#fff';
    context.font = '0.5px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    for (let y = 0; y < arena.length; y++) {
      for (let x = 0; x < arena[y].length; x++) {
        if (arena[y][x] === BOMB && bombTimers[y][x] > 0) {
          context.fillText(bombTimers[y][x], x + 0.5, y + 0.5);
        }
      }
    }
    
    drawMatrix(player.matrix, player.pos);
  }
  
  function collide(arena, player) {
    const [matrix, pos] = [player.matrix, player.pos];
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] === 0) continue;
        const row = arena[y + pos.y];
        if (!row || row[x + pos.x] !== 0) {
          return true;
        }
      }
    }
    return false;
  }
  
  function merge(arena, player) {
    let lasered = false;
    const { matrix, pos } = player;
    
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        const value = matrix[y][x];
        if (!value) continue;
        
        const px = pos.x + x;
        const py = pos.y + y;
        
        switch (value) {
          case BOMB:
            arena[py][px] = BOMB;
            bombTimers[py][px] = BOMB_TIMER;
            break;
          case LASER:
            lasered = true;
            for (let ix = 0; ix < arena[0].length; ix++) {
              arena[py][ix] = 0;
            }
            break;
          case EXTRUDER:
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (arena[py + dy] && arena[py + dy][px + dx] !== undefined) {
                  arena[py + dy][px + dx] = Math.ceil(Math.random() * 7);
                }
              }
            }
            break;
          default:
            arena[py][px] = value;
        }
      }
    }
    
    if (lasered) {
      applyGravity(arena);
    }
  }
  
  function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y > 0; --y) {
      for (let x = 0; x < arena[y].length; ++x) {
        if (arena[y][x] === 0) {
          continue outer;
        }
      }
      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      ++y;
      player.score += rowCount * 10;
      rowCount *= 2;
    }
  }
  
  function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
      player.pos.y--;
      merge(arena, player);
      playerReset();
      arenaSweep();
      updateScore();
    }
    dropCounter = 0;
  }
  
  function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
      player.pos.x -= dir;
    }
  }
  
  function playerHardDrop() {
    while (!collide(arena, player)) {
      player.pos.y++;
    }
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    updateScore();
    dropCounter = 0;
  }
  
  function playerReset() {
    tickBombs();
    
    const pieces = 'TJLOSZI';
    player.matrix = createPiece(pieces[(pieces.length * Math.random()) | 0]);
    player.pos.y = 0;
    player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);
    
    piecesSinceBomb++;
    piecesSinceLaser++;
    piecesSinceExtruder++;
    
    let specialType = null;
    const bombChance = Math.random() < BOMB_PROBABILITY || piecesSinceBomb >= 1 / BOMB_PROBABILITY;
    const laserChance = Math.random() < LASER_PROBABILITY || piecesSinceLaser >= 1 / LASER_PROBABILITY;
    const extruderChance = Math.random() < EXTRUDER_PROBABILITY || piecesSinceExtruder >= 1 / EXTRUDER_PROBABILITY;
    
    if (bombChance) {
      specialType = 'bomb';
      piecesSinceBomb = 0;
    } else if (laserChance) {
      specialType = 'laser';
      piecesSinceLaser = 0;
    } else if (extruderChance) {
      specialType = 'extruder';
      piecesSinceExtruder = 0;
    }
    
    if (specialType) {
      const blocks = [];
      player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            blocks.push({ x, y });
          }
        });
      });
      
      if (blocks.length) {
        const { x, y } = blocks[(blocks.length * Math.random()) | 0];
        player.matrix[y][x] = (
          specialType === 'bomb' ? BOMB
          : specialType === 'laser' ? LASER
          : EXTRUDER
        );
      }
    }
    
    if (collide(arena, player)) {
      gameOver();
    }
  }
  
  function gameOver() {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    updateScore();
  }

  function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
      for (let x = 0; x < y; ++x) {
        [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
      }
    }
    if (dir > 0) {
      matrix.forEach(row => row.reverse());
    } else {
      matrix.reverse();
    }
  }
  
  function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
      player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > player.matrix[0].length) {
        rotate(player.matrix, -dir);
        player.pos.x = pos;
        break;
      }
    }
  }
  
  function updateScore() {
    document.getElementById('score').innerText = player.score;
  }
  
  let dropCounter = 0;
  let dropInterval = 1000;
  let lastTime = 0;
  
  function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    
    if (dropCounter > dropInterval) {
      playerDrop();
    }
    
    draw();
    requestAnimationFrame(update);
  }
  
  document.addEventListener('keydown', event => {
    switch (event.keyCode) {
      case KEY.LEFT:
        playerMove(-1);
        break;
      case KEY.RIGHT:
        playerMove(1);
        break;
      case KEY.DOWN:
        playerDrop();
        break;
      case KEY.SPACE:
        playerHardDrop();
        break;
      case KEY.Q:
        playerRotate(-1);
        break;
      case KEY.W:
      case KEY.UP:
        playerRotate(1);
        break;
    }
  });
  
  // Initialize game
  playerReset();
  updateScore();
  update();
  
  return {
    resetGame: () => {
      arena = createMatrix(10, 20);
      bombTimers = createMatrix(10, 20);
      player = { pos: { x: 0, y: 0 }, matrix: null, score: 0 };
      playerReset();
    }
  };
})();

// Error handling for canvas element
if (!TetrisGame) {
  console.error('Failed to initialize Tetris game');
}
