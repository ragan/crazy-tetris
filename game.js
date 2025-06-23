const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);
const BOMB = 8;
const LASER = 9;
// Special-block spawn configuration: percent chance per piece,
// guaranteed at least once per (100 / PROBABILITY) pieces.
const BOMB_PROBABILITY = 25; // percent chance per piece
const LASER_PROBABILITY = 25; // percent chance per piece
const bombProb = BOMB_PROBABILITY / 100;
const laserProb = LASER_PROBABILITY / 100;
const bombInterval = Math.round(100 / BOMB_PROBABILITY);
const laserInterval = Math.round(100 / LASER_PROBABILITY);
let piecesSinceBomb = 0;
let piecesSinceLaser = 0;

function createMatrix(w, h) {
	const matrix = [];
	while (h--) {
		matrix.push(new Array(w).fill(0));
	}
	return matrix;
}

function createPiece(type) {
	switch (type) {
		case 'T': return [[0, 0, 0], [1, 1, 1], [0, 1, 0]];
		case 'O': return [[2, 2], [2, 2]];
		case 'L': return [[0, 3, 0], [0, 3, 0], [0, 3, 3]];
		case 'J': return [[0, 4, 0], [0, 4, 0], [4, 4, 0]];
		case 'I': return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
		case 'S': return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
		case 'Z': return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
	}
}

function drawMatrix(matrix, offset) {
	matrix.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value !== 0) {
				context.fillStyle = colors[value];
				context.fillRect(x + offset.x, y + offset.y, 1, 1);
			}
		});
	});
}

// After bomb explosions, make remaining blocks fall down to fill holes
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
					arena[y][x] = arena[k][x];
					arena[k][x] = 0;
				}
			}
		}
	}
}

function draw() {
	context.fillStyle = '#000';
	context.fillRect(0, 0, canvas.width, canvas.height);
	drawMatrix(arena, { x: 0, y: 0 });
	drawMatrix(player.matrix, player.pos);
}

function collide(arena, player) {
	const [m, o] = [player.matrix, player.pos];
	for (let y = 0; y < m.length; ++y) {
		for (let x = 0; x < m[y].length; ++x) {
			if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
				return true;
			}
		}
	}
	return false;
}

function merge(arena, player) {
	let exploded = false;
	let lasered = false;
	player.matrix.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value !== 0) {
				if (value === BOMB) {
					exploded = true;
					for (let dy = -1; dy <= 1; ++dy) {
						for (let dx = -1; dx <= 1; ++dx) {
							const ax = x + player.pos.x + dx;
							const ay = y + player.pos.y + dy;
							if (arena[ay] && arena[ay][ax] !== undefined) {
								arena[ay][ax] = 0;
							}
						}
					}
				} else if (value === LASER) {
					lasered = true;
					const ay = y + player.pos.y;
					for (let ax = 0; ax < arena[0].length; ++ax) {
						arena[ay][ax] = 0;
					}
				} else {
					arena[y + player.pos.y][x + player.pos.x] = value;
				}
			}
		});
	});
	if (exploded || lasered) {
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
	const pieces = 'TJLOSZI';
	player.matrix = createPiece(pieces[(pieces.length * Math.random()) | 0]);
	player.pos.y = 0;
	player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);
	// Special placement: bomb or laser (never both), random chance or guaranteed interval
	piecesSinceBomb++;
	piecesSinceLaser++;
	let specialType = null;
	if (Math.random() < bombProb || piecesSinceBomb >= bombInterval) {
		specialType = 'bomb';
		piecesSinceBomb = 0;
	} else if (Math.random() < laserProb || piecesSinceLaser >= laserInterval) {
		specialType = 'laser';
		piecesSinceLaser = 0;
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
			player.matrix[y][x] = (specialType === 'bomb' ? BOMB : LASER);
		}
	}
	if (collide(arena, player)) {
		arena.forEach(row => row.fill(0));
		player.score = 0;
		updateScore();
	}
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
	if (event.keyCode === 37) {
		playerMove(-1);
	} else if (event.keyCode === 39) {
		playerMove(1);
	} else if (event.keyCode === 40) {
		playerDrop();
	} else if (event.keyCode === 32) {
		playerHardDrop();
	} else if (event.keyCode === 81) {
		playerRotate(-1);
	} else if (event.keyCode === 87 || event.keyCode === 38) {
		playerRotate(1);
	}
});

const colors = [
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
];

const arena = createMatrix(10, 20);
const player = { pos: { x: 0, y: 0 }, matrix: null, score: 0 };

playerReset();
updateScore();
update();
