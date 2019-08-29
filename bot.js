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

function matrix(width, height, def) {
    return Array.from({length:height},()=>Array.from({length:width},()=>def))
}
function move(o, d, field) {
    let x = o.x, y = o.y;
	switch (d) {
		case UP:
			if (y <= 0) return {x, y: field.height - 1};
			return {x, y: y - 1};
		case LEFT:
			if (x <= 0) return {x: field.width - 1, y};
			return {x: x - 1, y};
		case DOWN:
			if (y >= field.height-1) return {x, y: 0};
			return {x, y: y + 1};
		case RIGHT:
			if (x >= field.width-1) return {x: 0, y};
			return {x: x + 1, y};
		default:
			return {x, y};
	}
}
function can(field, x, y) {
    return (field.map[y][x] == ' ' || field.map[y][x] == 'b');
}
function canO(field, o) {
    return (field.map[o.y][o.x] == ' ' || field.map[o.y][o.x] == 'b');
}

function onTick(field) {
    let M = matrix(field.width, field.height, -1);
    let cells = [], i = 0, nx, ny;
    cells.push(field.me);
    while (cells.length > 0) {
        let f = false, ncells = [];
        if (i > 15) break;
        for (let cell of cells) {
            M[cell.y][cell.x] = i;
            //ctx.fillText(i, cell.x / field.width * canvas.width,
             //               (cell.y + 0.25) / field.height * canvas.height);
            if (cell.x == field.bonus.x &&
                cell.y == field.bonus.y) {
                f = true;
                break;
            }
                
            // up
            ny = cell.y == 0 ? (field.height-1) : cell.y-1;
            if (M[ny][cell.x] == -1 && can(field, cell.x, ny))
                ncells.push({x: cell.x, y: ny});
            // down
            ny = cell.y == (field.height-1) ? 0 : cell.y+1;
            if (M[ny][cell.x] == -1 && can(field, cell.x, ny))
                ncells.push({x: cell.x, y: ny});
            // left
            nx = cell.x == 0 ? (field.width-1) : cell.x-1;
            if (M[cell.y][nx] == -1 && can(field, nx, cell.y))
                ncells.push({x: nx, y: cell.y});
            // right
            nx = cell.x == (field.width-1) ? 0 : cell.x+1;
            if (M[cell.y][nx] == -1 && can(field, nx, cell.y))
                ncells.push({x: nx, y: cell.y});
        }
        if (f)
            break;
        cells = ncells;
        i++;
    }
    
    let dist = M[field.bonus.y][field.bonus.x];
    if (dist == -1) {
        if (canO(field, move(field.me, UP, field)))
            return UP;
        if (canO(field, move(field.me, DOWN, field)))
            return DOWN;
        if (canO(field, move(field.me, LEFT, field)))
            return LEFT;
        if (canO(field, move(field.me, RIGHT, field)))
            return RIGHT;
    }
    
    let path = [], x = field.bonus.x, y = field.bonus.y, d;
    i = dist;
    while (!(x == field.me.x && y == field.me.y)) {
        path.push({x, y});
        
        // up
        ny = y == 0 ? (field.height-1) : y-1;
        if (M[ny][x] == i-1) {
            y = ny; i--;
            d = DOWN;
            continue;
        }
        
        // down
        ny = y == (field.height-1) ? 0 : y+1;
        if (M[ny][x] == i-1) {
            y = ny; i--;
            d = UP;
            continue;
        }
            
        // left
        nx = x == 0 ? (field.width-1) : x-1;
        if (M[y][nx] == i-1) {
            x = nx; i--;
            d = RIGHT;
            continue;
        }  
        
        // right
        nx = x == (field.width-1) ? 0 : x+1;
        if (M[y][nx] == i-1) {
            x = nx; i--;
            d = LEFT;
            continue;
        }
        
        break;
    }
    
    return d;
};