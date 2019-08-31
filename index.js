let BodjoGame = require('@dkaraush/bodjo-game');
let bodjo = new BodjoGame(promptConfig('config.json'));

const UP = 0;
const RIGHT = 1;
const DOWN = 2;
const LEFT = 3;

const MIN_LENGTH = 3;

const TPS = 7;
let mapString = require('fs').readFileSync('map.txt').toString();

if (mapString[0] == '\n')
	mapString = mapString.substring(1);

let map = mapString.split(/\r\n|\n/g);
let height = map.length,
	width = map[0].length;
let players = {};
let bonus = randomPoint();

bodjo.scoreboard.updateWhenNeeded = false;

function tick() {
	let start = Date.now()

	for (let id in players) {
		let player = players[id];
		if (!player.playing) {
			player.respawnCounter--;
			if (player.respawnCounter <= 0) {
				player.playing = true;
				player = Object.assign(player, spawnSnake(MIN_LENGTH));
			}
			continue;
		}

		let nextPoint = move(o(player.snake[player.length-1]), player.direction);
		if (!can(nextPoint)) {
			players[id].playing = false;
			players[id].respawnCounter = 5;
			continue;
		}

		player.snake.push(v(nextPoint));
		if (bonus != null && player.snake.indexOf(v(bonus)) >= 0) {
			bonus = null;
			player.length++;
			if (bodjo.scoreboard.get(player.socket.username) < player.length)
				bodjo.scoreboard.push(player.socket.username, player.length);
		} else 
			player.snake.shift();
	}

	if (bonus == null)
		bonus = randomPoint();

	let ids = Object.keys(players).filter(id => players[id].playing);
	bodjo.broadcast('field', buff(
		UInt16(v(bonus)),
		UInt8(ids.length),
		Array.from(ids, id => [
			UInt8(id),
			UInt8(players[id].direction),
			UInt8(players[id].length),
			Array.from(players[id].snake, snakeElement => UInt16(snakeElement))
		])
	));

	bodjo.scoreboard.update();

	setTimeout(
		tick, 
		Math.max((1000 / TPS) - (Date.now() - start), 16)
	);
}
tick();

bodjo.on('connect', socket => {
	socket.emit('map', map);
});
bodjo.on('player-connect', (player) => {
	let username = player.username,
		id = player.id,
		playing = false;

	if (typeof bodjo.scoreboard.get(username) === 'undefined')
		bodjo.scoreboard.push(username, 0);


	player.on('join', () => {
		if (playing)
			return;
		players[id] = Object.assign({
			socket: player, 
			playing: true, 
			respawnCounter: 0
		}, spawnSnake(MIN_LENGTH));
		playing = true;
	});

	player.on('leave', () => {
		if (!playing)
			return;
		delete players[id];
		playing = false;
	});

	player.on('turn', direction => {
		if (!playing) return;
		if (Math.abs(players[id].direction - direction) == 2)
			return;
		players[id].direction = direction;
	})

	player.on('disconnect', () => {
		if (playing)
			delete players[id];
	});
});

bodjo.initClient('./web/');
bodjo.start();

bodjo.addBots(__dirname + '/bot.js', 5);

function spawnSnake(length = 3) {

	const maxAttempts = 10;
	let snake = [], direction = UP;

	for (let attempts = 0; attempts < maxAttempts; ++attempts) {
		let point = randomPoint();
		if (point == null)
			return null;

		snake.push(v(point));
		let ok = true;
		for (let i = 1; i < length; ++i) {
			let ok1 = false;
			for (let d = 0, _ = Math.round(Math.random() * 4); d < 4; ++d) {
				let nextPoint = move(point, (d+_)%4);
				if (can(nextPoint) && 
					snake.indexOf(v(nextPoint)) < 0) {
					ok1 = true;
					point = nextPoint;
					direction = (d+_)%4;
					break;
				}
			}
			if (!ok1) {
				snake = [];
				ok = false;
				break;
			}
			snake.push(v(point));
		}

		if (ok)
			break;
	}

	if (snake.length != length) {
		console.log('failed to spawn snake!');
		return null;
	}

	return {
		length,
		snake,
		direction
	};
}
function v(v) {
	if (v == null)
		return width * height;
	return v.x + v.y * width;
}
function o(u) {
	return {
		x: u % width,
		y: (u - (u % width)) / width
	};
}
function randomPoint() {
	let point;
	do {
		point = {
			x: Math.round(Math.random() * (width - 1)),
			y: Math.round(Math.random() * (height - 1))
		}
	} while (!can(point));
	return point;
}
function move(o, direction) {
	let x = o.x, y = o.y;
	switch (direction) {
		case UP:
			if (y <= 0) return {x, y: height - 1};
			return {x, y: y - 1};
		case LEFT:
			if (x <= 0) return {x: width - 1, y};
			return {x: x - 1, y};
		case DOWN:
			if (y >= height-1) return {x, y: 0};
			return {x, y: y + 1};
		case RIGHT:
			if (x >= width-1) return {x: 0, y};
			return {x: x + 1, y};
		default:
			return {x, y};
	}
}
function can(o) {
	let x = o.x, y = o.y;
	if (x < 0 || x >= width || y < 0 || y >= height)
		return false;
	if (map[y][x] == '#')
		return false;
	for (let id in players)
		if (players[id].snake.indexOf(x+y*width) >= 0)
			return false;
	return true;
}

// === Binary ===
function UInt8(n) {
	return new Uint8Array(Array.isArray(n) ? n : [n]).buffer;
}
function UInt16(n) {
	return new Uint16Array(Array.isArray(n) ? n : [n]).buffer;
}
function UInt32(n) {
	return new Uint32Array(Array.isArray(n) ? n : [n]).buffer;
}
function Float32(n) {
	return new Float32Array(Array.isArray(n) ? n : [n]).buffer;
}
function buff() {
	let array = flatten(Array.prototype.slice.apply(arguments));
	let sum = 0, offset = 0;
	for (let i = 0; i < array.length; ++i)
		sum += array[i].byteLength;
	let tmp = new Uint8Array(sum);
	for (let i = 0; i < array.length; ++i) {
		tmp.set(new Uint8Array(array[i]), offset);
		offset += array[i].byteLength;
	}
	return tmp.buffer;
}
function flatten(input) {
	const stack = [...input];
	const res = [];
	while (stack.length) {
		const next = stack.pop();
		if (Array.isArray(next))
			stack.push(...next);
		else
			res.push(next);
	}
	return res.reverse();
}