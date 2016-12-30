Array.prototype.remove = function(obj){
	var index = this.indexOf(obj);
	if (index > -1){
		return this.splice(index, 1);	
	}
	return this;
}

function getRandom(min, max) {
	return Math.random() * (max - min) + min;
}

function distance(from, to) {
	var dx = from.x - to.x;
  	var dy = from.y - to.y;
    var dist = Math.sqrt(dx*dx + dy*dy); 
	return dist;
}

function Engine(options){
	var engine = this;

	engine.loadSprites = function(){
		console.log('Loading Sprites')
		engine.sprites = {};
		var spriteList = [];
		for (var spriteKey of Object.keys(options.spriteSources)){
			spriteList.push(options.spriteSources[spriteKey])	;
		}
		PIXI.loader.add(spriteList).load(function(){
			console.log('Sprites Loaded')
			for (var spriteKey of Object.keys(options.spriteSources)){
				var source = options.spriteSources[spriteKey];
				engine.sprites[spriteKey] = new PIXI.Sprite(PIXI.loader.resources[source].texture);
			}
			console.log('Loaded Sprites:', engine.sprites);
			options.onLoad();
		});
	};

	engine.setup = function (){
		engine.stage = new PIXI.Container(),
		engine.renderer = PIXI.autoDetectRenderer(options.width, options.height);

		// Add to Page
		document.getElementById(options.viewport).appendChild(engine.renderer.view);

		// Load sprites
		engine.loadSprites();
	};

	engine.render = function(){
		engine.renderer.render(engine.stage);
	};

	engine.makeCircle = function(x, y, radius, color){
		var graphic = new PIXI.Graphics();
		graphic.beginFill(color);
		graphic.drawCircle(0, 0, radius);
		graphic.endFill();
		graphic.x = x;
		graphic.y = y;
		return graphic;
	}

	engine.setup();
	return engine;
}

function Player(game, options){
	var player = {};
	player.alive = true;
	player.lives = options.lives || 3;
	player.x = options.x || 0;
	player.y = options.y || 0;
	player.startX = player.x;
	player.startY = player.y;
	player.vx = 0;
	player.vy = 0;
	player.velocity = 25;
	player.invulnerable = false;
	player.graphic = options.sprite;
	player.graphic.width = 30;
	player.graphic.height = 30;
	player.graphic.x = player.x;
	player.graphic.y = player.y;
	player.keys = {
		up: false,
		down: false,
		right: false,
		left: false,
	}

	player.die = function(){
		player.graphic.visible = false;
		player.alive = false;
		player.lives -= 1;
		console.log('lives:', player.lives);
		if (player.lives){
			setTimeout(function(){
				player.alive = true;
				player.x = player.startX;
				player.y = player.startY;
				player.graphic.visible = true;
				player.invulnerable = true;
				setTimeout(function(){
					player.invulnerable = false;
				}, 2000)
			}, 1000)
		}
	}

	player.updateVelocity = function(){
		var keys = player.keys;
		var vx = 0;
		var vy = 0;
		if (keys.left){
			vx -= 1;
		}
		if (keys.right){
			vx += 1;
		}
		if (keys.up){
			vy -= 1;
		}
		if (keys.down){
			vy += 1;
		}
		if (vx != 0 && vy != 0){
			vx = Math.sqrt(.5) * vx;
			vy = Math.sqrt(.5) * vy;
		}
		player.vx = vx * player.velocity;
		player.vy = vy * player.velocity;

		console.log('Velocity:', player.vx, player.vy, player.vx + player.vy);
	}
	player.logic = function(stateInfo){
		player.x = player.x + player.vx * (stateInfo.elapsed / 100);
		player.y = player.y + player.vy * (stateInfo.elapsed / 100);
		player.graphic.x = player.x;
		player.graphic.y = player.y;
	}

	player.game = game;

	// Add sprite 
	game.engine.stage.addChild(player.graphic);
	return player
}

function Bullet(game, opts){
	var bullet = {
		enemy: opts.enemy || true,
		x:opts.x,
		y:opts.y,
		size:opts.size,
		vx: opts.vx || 0,
		vy: opts.vy || 0,
	};

	// Update game with self
	game.bullets.push(bullet);

	// Add graphic
	bullet.graphic = game.engine.makeCircle(bullet.x, bullet.y, opts.size, 0xe74c3c);
	game.engine.stage.addChild(bullet.graphic);

	// Add references
	bullet.game = game;

	// Functions
	bullet.logic = function(stateInfo){
		bullet.x = bullet.x + bullet.vx * (stateInfo.elapsed / 100);
		bullet.y = bullet.y + bullet.vy * (stateInfo.elapsed / 100);
		bullet.graphic.x = bullet.x;
		bullet.graphic.y = bullet.y;

		if (game.isOutsideViewport(bullet.x, bullet.y, bullet.size)){
			game.bullets.remove(bullet);
			game.engine.stage.removeChild(bullet);
			
		}
	}
	return bullet;
}

function Enemy(game, opts){
	var enemy = {};

	enemy.x = opts.x;
	enemy.y = opts.y;
	enemy.size = opts.size;
	enemy.vx = opts.vx;
	enemy.vy = opts.vy;
	enemy.game = game;

	enemy.emitBullet = function(){
		Bullet(enemy.game, {
			x: enemy.x,
			y: enemy.y,
			vy: getRandom(0,20),
			vx: getRandom(-5,5),
			vy: 20,
			size: 2
		})
	}

	enemy.graphic = game.engine.makeCircle(opts.x, opts.y, opts.size, 0x9b59b6);
	game.engine.stage.addChild(enemy.graphic);

	enemy.logic = function(state){
		if (!state.elapsed){
			enemy.lastEmit = state.currentStateTime;
			enemy.emitBullet();
		}
		if (state.currentStateTime - enemy.lastEmit > 500){
			enemy.lastEmit = state.currentStateTime;
			enemy.emitBullet();
		}
	}
	return enemy;
}

(function Game(options){
	var game = {};
	game.width = 900;
	game.height = 700;

	game.spriteSources = {
		player: 'img/ship.png',
	};

	game.start = function(){
		game.engine = new Engine({
			viewport: 'viewport',
			spriteSources: game.spriteSources,
			width: game.width,
			height: game.height,
			onLoad: game.onEngineLoad
		})
	}

	game.onEngineLoad = function(){
		game.sprites = game.engine.sprites;
		game.bullets = [];
		game.player = Player(game, {
			x: game.width / 2,
			y: game.height - 100,
			sprite: game.engine.sprites.player,
		})
		game.enemies = [
			Enemy(game, {x: 100, y: 100, size: 10}),
			Enemy(game, {x: 200, y: 100, size: 10}),
			Enemy(game, {x: 300, y: 100, size: 10}),
			Enemy(game, {x: 400, y: 100, size: 10}),
			Enemy(game, {x: 500, y: 100, size: 10}),
			Enemy(game, {x: 600, y: 100, size: 10}),
			Enemy(game, {x: 700, y: 100, size: 10}),
		]
		game.bindKeys();
		game.loop();
		game.play = true;
	}

	game.bindKeys = function(){
		function playerMoveKey(key, on){
			return function(){
				game.player.keys[key] = on;
				game.player.updateVelocity()
			}
		}
		
		Mousetrap.bind('up', playerMoveKey('up', true), 'keydown');
		Mousetrap.bind('up', playerMoveKey('up', false), 'keyup');	
		Mousetrap.bind('down', playerMoveKey('down', true), 'keydown');
		Mousetrap.bind('down', playerMoveKey('down', false), 'keyup');
		Mousetrap.bind('left', playerMoveKey('left', true), 'keydown');
		Mousetrap.bind('left', playerMoveKey('left', false), 'keyup');
		Mousetrap.bind('right', playerMoveKey('right', true), 'keydown');
		Mousetrap.bind('right', playerMoveKey('right', false), 'keyup');
		Mousetrap.bind('enter', function(){
			game.lastStateUpdate = null;
			game.play = !game.play;
		});
	}

	game.loop = function (){
		requestAnimationFrame(game.loop);	
		if (game.play){
			game.updateState();
			game.engine.render();
		}
	}

	game.isOutsideViewport = function(x, y, size){
		if (x + size < 0 || x - size > game.width){
			return true;
		} else if (y + size < 0 || y - size > game.height) {
			return true;
		}
		return false;
	}

	game.updateState = function(){
		var lastTime = game.lastStateUpdate || (new Date).getTime();
		var currentTime = (new Date).getTime();
		var elapsed = lastTime ? currentTime - lastTime : null;
		var stateInfo = {lastStateTime: lastTime,currentStateTime: currentTime, elapsed: elapsed}

		game.player.logic(stateInfo);
		for (var enemy of game.enemies){
			enemy.logic(stateInfo);
		}
		for (var bullet of game.bullets){
			bullet.logic(stateInfo);
		}
		if (!game.player.invulnerable && game.player.alive){
			for (var bullet of game.bullets){
				if (distance(bullet, game.player) < 10){
					game.player.die();
					break;
				}
			}
		}
		game.lastStateUpdate = currentTime;
	}

	game.start();
})();
