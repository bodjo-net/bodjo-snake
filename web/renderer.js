bodjo.render = function (canvas, ctx, resizeCanvas, dataPushed, field) {
	resizeCanvas(field.width / field.height);

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	for (let x = 0; x < field.width; ++x) {
		for (let y = 0; y < field.height; ++y) {
			drawCell(canvas, ctx, x, y, field);
		}
	}

	for (let player of field.players)
		drawPlayer(canvas, ctx, player, field);
}

const colors = [
	// 700 300
	['#D32F2F', '#E57373'],
	['#C2185B', '#F06292'],
	['#7B1FA2', '#BA68C8'],
	['#512DA8', '#9575CD'],
	['#303F9F', '#7986CB'],
	['#1976D2', '#64B5F6'],
	['#0288D1', '#4FC3F7'],
	['#0097A7', '#4DD0E1'],
	['#00796B', '#4DB6AC'],
	['#388E3C', '#81C784'],
	['#689F38', '#AED581'],
	['#AFB42B', '#DCE775'],
	// ['#FBC02D', '#FFF176'],
	['#E64A19', '#FF8A65'],
	['#FFA000', '#FFD54F'],
	['#F57C00', '#FFB74D'],
	['#5D4037', '#A1887F'],
	['#616161', '#E0E0E0']
];

function drawPlayer(canvas, ctx, player, field) {
	let x = player.snake[player.length-1].x,
		y = player.snake[player.length-1].y;
	let X = Math.ceil(x / field.width * canvas.width),
		Y = Math.ceil(y / field.height * canvas.height),
		S = Math.ceil(canvas.width / field.width);
	let L = S * 0.1,
		F = S * 0.75;
	ctx.lineWidth = L;
	ctx.strokeStyle = 'rgba(255,255,255,0.2)';
	// ctx.strokeRect(X+L/2, Y+L/2, S-L, S-L);

	ctx.fillStyle =   colors[player.id % colors.length][0];
	ctx.strokeStyle = 'rgba(0,0,0,0.5)';//colors[player.id % colors.length][1];
	ctx.lineWidth = F * 0.05;
	ctx.font = '700 ' + F + 'px \'Source Code Pro\'';
	let width = ctx.measureText(player.username).width;

	ctx.fillText(player.username, 
				 pingPong(X+S/2, canvas.width) - width / 2, 
				 pingPong(Y - S*0.1, canvas.height));
	ctx.strokeText(player.username, 
				 pingPong(X+S/2, canvas.width) - width / 2, 
				 pingPong(Y - S*0.1, canvas.height));

	ctx.fillStyle = '#FFFFFF';
	ctx.font = '700 ' + (S*0.6) + 'px \'Source Code Pro\'';
	let nwidth = ctx.measureText(player.length).width;
	ctx.fillText(player.length,
				 X+S/2-nwidth/2, Y+S*0.7);
}

function pingPong(x, len) {
	x = x % len;
	if (x < 0) x = len + x;
	return x;
}

function drawCell(canvas, ctx, x, y, field) {
	let v = x + y * field.width;
	let X = Math.ceil(x / field.width * canvas.width),
		Y = Math.ceil(y / field.height * canvas.height),
		S = Math.ceil(canvas.width / field.width);

	for (let player of field.players) {
		// if (player.snake.indexOf(v) >= 0) {
		for (let i = 0; i < player.snake.length; ++i) {
			if (player.snake[i].x == x &&
				player.snake[i].y == y) {
				// snake element
				ctx.fillStyle = colors[player.id % colors.length][i == player.length - 1 ? 0 : 1];
				ctx.fillRect(X, Y, S, S);
				return;
			}
		}
	}

	ctx.fillStyle = ({' ': '#CFD8DC', '#': '#263238'})[field.rawMap[y][x]];
	ctx.fillRect(X, Y, S, S);

	if (field.bonus.x == x &&
		field.bonus.y == y) {
		ctx.fillStyle = '#F57F17';
		ctx.fillRect(X + S*0.4, Y + S*0.4, S*0.4, S*0.4);
		ctx.fillStyle = '#FBC02D';
		ctx.fillRect(X + S*0.3, Y + S*0.3, S*0.4, S*0.4);
		return;
	}
}