Object.getOwnPropertyNames(Math).forEach(k => global[k] = Math[k]);
let map;
module.exports = (function (port, username, token) {
	let ids = {};

	let url = 'http://localhost:'+port+'?role=player&username='+username+'&token='+token;
	let socket = require('socket.io-client')(url);

	let playing = false;

	socket.on('map', _map => {
		map = _map;
		if (typeof map[0] === 'string')
			map = map.map(row => row.split(''));
		height = map.length;
		width = map[0].length;
	});
		
	socket.on('_scoreboard', players => players.forEach(player => ids[player.id] = player.username))

	socket.on('field', (data) => {
		let field = parseField(data, map, username);
		if (playing && field.me)
			tick(field);
	});

	function toArrayBuffer(buf) {
	    var ab = new ArrayBuffer(buf.length);
	    var view = new Uint8Array(ab);
	    for (var i = 0; i < buf.length; ++i) {
	        view[i] = buf[i];
	    }
	    return ab;
	}
	function parseField(data, map, username) {
		let d = new DataView(toArrayBuffer(data));

		let bonus = d.getUint16(0, true);
		let playersCount = d.getUint8(2);

		let O = {
			width, 
			height,
			players: [], 
			me: null,
			enemies: [],
			bonus: v(bonus)
		};
		let offset = 3;
		for (let i = 0; i < playersCount; ++i) {
			let id = d.getUint8(offset++),
				dir = d.getUint8(offset++),
				len = d.getUint8(offset++);
			let snake = new Array(len);
			for (let j = 0; j < len; ++j) {
				snake[j] = v(d.getUint16(offset, true));
				offset += 2;
			}
			let pO = {
				id,
				username: ids[id] || '...',
				direction: dir,
				length: len,
				snake
			};

			pO.x = snake[len-1].x;
			pO.y = snake[len-1].y;

			if (pO.username == username)
				O.me = pO; 
			else 
				O.enemies.push(pO);
			O.players.push(pO);
		}
		O.rawMap = map;
		O.map = generateMap(map, O);
		return O;
	}
	function generateMap(map, o) {
		let newMap = new Array(map.length);
		for (let y = 0; y < map.length; ++y) {
			newMap[y] = new Array(map[y].length);
			for (let x = 0; x < map[y].length; ++x)
				newMap[y][x] = map[y][x];
		}

		newMap[o.bonus.y][o.bonus.x] = 'b';
		for (let player of o.players) {
			for (let s of player.snake) {
				newMap[s.y][s.x] = o.me&&o.me.id==player.id ? 'm' : 'e';
			}
		}
		return newMap;
	}
	function v(u) {
		return {
			x: u % width,
			y: (u - (u % width)) / width
		};
	}

	socket.on('disconnect', () => {
		playing = false;
	});

	function tick(field) {
		// if (typeof onTick !== 'function') {
		// 	if (!compile()) {
		// 		stop();
		// 		return;
		// 	}
		// }

		let result;
		try {
			result = onTick(field)
		} catch (e) {
			// bodjo.showError(e);
			// stop();
			return;
		}

		if (!Number.isInteger(result) ||
			result < 0 || result > 4) {
			// bodjo.showError('function should return an integer in range [0, 3] \n(');
			// stop();
			return;
		}

		socket.emit('turn', result);
	}

	playing = true;
	socket.emit('join');
});

// == bot logic ==

const UP = 0;
const RIGHT = 1;
const DOWN = 2;
const LEFT = 3;

function onTick(field) {
	if (field.me.x == field.bonus.x) {
	    return (field.me.y < field.bonus.y ? DOWN : UP);
	} else if (field.me.y == field.bonus.y) {
	    return (field.me.x < field.bonus.x ? RIGHT : LEFT);
	} else
	    return field.me.direction;
};